import { ownerPool } from '../db/pool.js';
import { env } from '../config/env.js';
import { verificarPassword } from './passwords.js';
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
  roles: { rol: string; unidadId: string | null }[];
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
      roles: await cargarRoles(entidadId, usuario.id),
    },
  };
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
    roles: await cargarRoles(ses.entidad_id, ses.usuario_id),
  };
}

export async function logout(token: string): Promise<void> {
  await ownerPool.query(
    'UPDATE sesion SET revocada_en = now() WHERE token_hash = $1 AND revocada_en IS NULL',
    [hashToken(token)],
  );
}
