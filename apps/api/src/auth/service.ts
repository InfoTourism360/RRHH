import { ownerPool } from '../db/pool.js';
import { env } from '../config/env.js';
import { hashearPassword, verificarPassword } from './passwords.js';
import { verificarTotp } from './mfa.js';
import { descifrar } from './crypto.js';
import { hashToken, nuevoToken } from './tokens.js';

/**
 * La AUTENTICACIÓN resuelve a qué tenant pertenece la petición, por lo que sus
 * lecturas (entidad/usuario/sesión por credenciales o token) usan el pool
 * propietario. A partir de ese punto TODO el acceso a datos de negocio pasa por
 * `conTenant` (pool de app, sujeto a RLS). Es la única excepción y está acotada.
 */

export class ErrorAuth extends Error {
  constructor(public codigo: string, mensaje: string) {
    super(mensaje);
  }
}

export interface SesionActiva {
  sesionId: string;
  entidadId: string;
  usuarioId: string;
  personaId: string | null;
  roles: { rol: string; unidadId: string | null }[];
}

async function personaDeUsuario(usuarioId: string): Promise<string | null> {
  const r = await ownerPool.query<{ persona_id: string | null }>(
    'SELECT persona_id FROM usuario WHERE id = $1',
    [usuarioId],
  );
  return r.rows[0]?.persona_id ?? null;
}

export async function login(params: {
  cif: string;
  email: string;
  password: string;
  totp?: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; sesion: SesionActiva }> {
  const ent = await ownerPool.query<{ id: string }>(
    'SELECT id FROM entidad WHERE cif = $1 AND activo',
    [params.cif],
  );
  const entidadId = ent.rows[0]?.id;
  // Mensaje genérico para no revelar si existe la entidad/usuario.
  if (!entidadId) throw new ErrorAuth('CREDENCIALES', 'Credenciales inválidas.');

  const u = await ownerPool.query<{
    id: string;
    password_hash: string;
    mfa_activo: boolean;
    mfa_totp_secret: Buffer | null;
    intentos_fallidos: number;
    bloqueado_hasta: Date | null;
    activo: boolean;
  }>(
    `SELECT id, password_hash, mfa_activo, mfa_totp_secret, intentos_fallidos,
            bloqueado_hasta, activo
       FROM usuario WHERE entidad_id = $1 AND email = $2`,
    [entidadId, params.email],
  );
  const usuario = u.rows[0];
  if (!usuario || !usuario.activo) throw new ErrorAuth('CREDENCIALES', 'Credenciales inválidas.');

  if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > new Date()) {
    throw new ErrorAuth('BLOQUEADO', 'Cuenta bloqueada temporalmente por intentos fallidos.');
  }

  const ok = await verificarPassword(usuario.password_hash, params.password);
  if (!ok) {
    await registrarFallo(usuario.id, usuario.intentos_fallidos);
    throw new ErrorAuth('CREDENCIALES', 'Credenciales inválidas.');
  }

  if (usuario.mfa_activo) {
    if (!params.totp) throw new ErrorAuth('MFA_REQUERIDO', 'Se requiere código MFA.');
    const secreto = usuario.mfa_totp_secret ? descifrar(usuario.mfa_totp_secret) : '';
    if (!secreto || !verificarTotp(secreto, params.totp)) {
      await registrarFallo(usuario.id, usuario.intentos_fallidos);
      throw new ErrorAuth('MFA_INVALIDO', 'Código MFA inválido.');
    }
  }

  // Éxito: resetea el contador y crea sesión.
  await ownerPool.query(
    'UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1',
    [usuario.id],
  );

  const { token, hash } = nuevoToken();
  const expira = new Date(Date.now() + env.SESSION_TTL_HORAS * 3600_000);
  const s = await ownerPool.query<{ id: string }>(
    `INSERT INTO sesion (entidad_id, usuario_id, token_hash, expira_en, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [entidadId, usuario.id, hash, expira, params.ip ?? null, params.userAgent ?? null],
  );

  return {
    token,
    sesion: {
      sesionId: s.rows[0]!.id,
      entidadId,
      usuarioId: usuario.id,
      personaId: await personaDeUsuario(usuario.id),
      roles: await cargarRoles(entidadId, usuario.id),
    },
  };
}

/** Autenticación de QUIOSCO: identificación por DNI / identificador / correo + PIN (nunca biometría). */
export async function autenticarQuiosco(params: {
  cif: string;
  identificador?: string;
  dni?: string;
  email?: string;
  pin: string;
}): Promise<{ entidadId: string; usuarioId: string; personaId: string }> {
  const valor = (params.identificador ?? params.dni ?? params.email ?? '').trim();
  if (!valor) throw new ErrorAuth('CREDENCIALES', 'Identificador no proporcionado.');

  const ent = await ownerPool.query<{ id: string }>(
    'SELECT id FROM entidad WHERE cif = $1 AND activo',
    [params.cif],
  );
  const entidadId = ent.rows[0]?.id;
  if (!entidadId) throw new ErrorAuth('CREDENCIALES', 'Credenciales de quiosco inválidas.');

  // Búsqueda flexible: coincide con email del usuario o con el DNI/NIE de la persona asociada.
  const u = await ownerPool.query<{
    id: string;
    pin_hash: string | null;
    persona_id: string | null;
    activo: boolean;
    pin_intentos_fallidos: number;
    pin_bloqueado_hasta: Date | null;
  }>(
    `SELECT u.id, u.pin_hash, u.persona_id, u.activo,
            u.pin_intentos_fallidos, u.pin_bloqueado_hasta
       FROM usuario u
  LEFT JOIN persona p ON p.id = u.persona_id
      WHERE u.entidad_id = $1
        AND (
          u.email = $2
          OR p.num_documento = $2
          OR regexp_replace(p.num_documento, '[^a-zA-Z0-9]', '', 'g')::citext = regexp_replace($2, '[^a-zA-Z0-9]', '', 'g')::citext
        )
      LIMIT 1`,
    [entidadId, valor],
  );
  const usuario = u.rows[0];
  if (!usuario || !usuario.activo || !usuario.pin_hash || !usuario.persona_id) {
    throw new ErrorAuth('CREDENCIALES', 'Credenciales de quiosco inválidas.');
  }

  // Se dice abiertamente que está bloqueado, y no un error genérico: quien
  // tiene que fichar está delante del terminal y necesita saber que la salida
  // es esperar o entrar por la web. Lo que se revela —que ese documento
  // corresponde a alguien de la plantilla— ya lo saben sus compañeros.
  if (usuario.pin_bloqueado_hasta && usuario.pin_bloqueado_hasta > new Date()) {
    throw new ErrorAuth(
      'BLOQUEADO',
      'PIN bloqueado temporalmente por intentos fallidos. Ficha desde la web con tu contraseña.',
    );
  }

  if (!(await verificarPassword(usuario.pin_hash, params.pin))) {
    await registrarFalloPin(usuario.id, usuario.pin_intentos_fallidos);
    throw new ErrorAuth('CREDENCIALES', 'Credenciales de quiosco inválidas.');
  }

  if (usuario.pin_intentos_fallidos > 0) {
    await ownerPool.query(
      'UPDATE usuario SET pin_intentos_fallidos = 0, pin_bloqueado_hasta = NULL WHERE id = $1',
      [usuario.id],
    );
  }
  return { entidadId, usuarioId: usuario.id, personaId: usuario.persona_id };
}

/**
 * Cuenta el fallo del PIN y bloquea el quiosco al llegar al tope. Es un
 * contador propio: no toca `intentos_fallidos`, para que nadie pueda dejar a
 * un compañero sin acceso web probando PIN en el terminal.
 */
async function registrarFalloPin(usuarioId: string, intentosPrevios: number): Promise<void> {
  const intentos = intentosPrevios + 1;
  const bloquear = intentos >= env.MAX_INTENTOS_PIN;
  await ownerPool.query(
    `UPDATE usuario
        SET pin_intentos_fallidos = $2,
            pin_bloqueado_hasta = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval
                                       ELSE pin_bloqueado_hasta END
      WHERE id = $1`,
    [usuarioId, intentos, bloquear, String(env.BLOQUEO_PIN_MINUTOS)],
  );
}

/** Establece/actualiza el PIN de quiosco del usuario (hash Argon2id). */
export async function establecerPin(usuarioId: string, pin: string): Promise<void> {
  // Cambiar el PIN levanta el bloqueo: es la vía de la que dispone el
  // administrador para desatascar a quien se ha quedado fuera del quiosco.
  await ownerPool.query(
    `UPDATE usuario
        SET pin_hash = $2, pin_intentos_fallidos = 0, pin_bloqueado_hasta = NULL
      WHERE id = $1`,
    [usuarioId, await hashearPassword(pin)],
  );
}

async function registrarFallo(usuarioId: string, intentosPrevios: number): Promise<void> {
  const intentos = intentosPrevios + 1;
  const bloquear = intentos >= env.MAX_INTENTOS_LOGIN;
  await ownerPool.query(
    `UPDATE usuario
        SET intentos_fallidos = $2,
            bloqueado_hasta = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval ELSE bloqueado_hasta END
      WHERE id = $1`,
    [usuarioId, intentos, bloquear, String(env.BLOQUEO_MINUTOS)],
  );
}

async function cargarRoles(
  entidadId: string,
  usuarioId: string,
): Promise<{ rol: string; unidadId: string | null }[]> {
  const r = await ownerPool.query<{ rol_codigo: string; unidad_id: string | null }>(
    `SELECT rol_codigo, unidad_id FROM usuario_rol
      WHERE entidad_id = $1 AND usuario_id = $2
        AND (vigencia_hasta IS NULL OR vigencia_hasta >= CURRENT_DATE)`,
    [entidadId, usuarioId],
  );
  return r.rows.map((x) => ({ rol: x.rol_codigo, unidadId: x.unidad_id }));
}

/** Resuelve la sesión a partir del token (Bearer). Aplica expiración e inactividad. */
export async function resolverSesion(token: string): Promise<SesionActiva | null> {
  const s = await ownerPool.query<{
    id: string;
    entidad_id: string;
    usuario_id: string;
    expira_en: Date;
    visto_en: Date;
    revocada_en: Date | null;
  }>(
    `SELECT id, entidad_id, usuario_id, expira_en, visto_en, revocada_en
       FROM sesion WHERE token_hash = $1`,
    [hashToken(token)],
  );
  const ses = s.rows[0];
  if (!ses || ses.revocada_en) return null;

  const ahora = new Date();
  if (ses.expira_en <= ahora) return null;
  const inactMs = env.SESSION_INACTIVIDAD_MINUTOS * 60_000;
  if (ahora.getTime() - ses.visto_en.getTime() > inactMs) {
    await ownerPool.query('UPDATE sesion SET revocada_en = now() WHERE id = $1', [ses.id]);
    return null;
  }
  await ownerPool.query('UPDATE sesion SET visto_en = now() WHERE id = $1', [ses.id]);

  return {
    sesionId: ses.id,
    entidadId: ses.entidad_id,
    usuarioId: ses.usuario_id,
    personaId: await personaDeUsuario(ses.usuario_id),
    roles: await cargarRoles(ses.entidad_id, ses.usuario_id),
  };
}

export async function logout(token: string): Promise<void> {
  await ownerPool.query(
    'UPDATE sesion SET revocada_en = now() WHERE token_hash = $1 AND revocada_en IS NULL',
    [hashToken(token)],
  );
}
