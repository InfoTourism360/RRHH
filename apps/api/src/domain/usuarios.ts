import { conTenant, type Contexto } from '../db/pool.js';
import { registrarAuditoria } from '../db/auditoria.js';
import { hashearPassword } from '../auth/passwords.js';
import { ErrorDominio } from './estructura.js';

// ---------------------------------------------------------------------------
// Gestión de accesos. Es la pieza que permite dar de alta a la plantilla de una
// entidad sin tocar la base de datos. Solo el administrador de la entidad opera
// aquí (segregación de funciones): el gestor de personal no reparte accesos.
// Nunca se devuelve el hash de la contraseña ni la semilla MFA.
// ---------------------------------------------------------------------------

const CAMPOS = `u.id, u.email, u.persona_id, u.activo, u.mfa_activo,
                (u.pin_hash IS NOT NULL) AS tiene_pin,
                u.intentos_fallidos, u.bloqueado_hasta, u.creado_en`;

export function listarUsuarios(ctx: Contexto) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `SELECT ${CAMPOS},
              p.nombre, p.apellido1, p.apellido2, p.num_documento,
              COALESCE(
                (SELECT array_agg(ur.rol_codigo ORDER BY ur.rol_codigo)
                   FROM usuario_rol ur
                  WHERE ur.usuario_id = u.id
                    AND (ur.vigencia_hasta IS NULL OR ur.vigencia_hasta >= CURRENT_DATE)),
                '{}') AS roles,
              COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                          'rol', ur.rol_codigo,
                          'unidadId', ur.unidad_id,
                          'unidad', uo.denominacion) ORDER BY ur.rol_codigo)
                   FROM usuario_rol ur
                   LEFT JOIN unidad_organica uo ON uo.id = ur.unidad_id
                  WHERE ur.usuario_id = u.id
                    AND (ur.vigencia_hasta IS NULL OR ur.vigencia_hasta >= CURRENT_DATE)),
                '[]'::jsonb) AS asignaciones
         FROM usuario u
         LEFT JOIN persona p ON p.id = u.persona_id
        ORDER BY u.email`,
    );
    return r.rows;
  });
}

interface UsuarioCreado { id: string; email: string; persona_id: string | null; activo: boolean }

/** Rol asignado, acotado a una unidad cuando el rol lo requiere. */
export interface AsignacionRol {
  rol: string;
  unidadId: string | null;
}

export interface UsuarioInput {
  email: string;
  password: string;
  personaId?: string | null;
  roles: AsignacionRol[];
}

export function crearUsuario(ctx: Contexto, d: UsuarioInput) {
  return conTenant(ctx, async (ej) => {
    // La persona, si se indica, debe existir en la entidad (la RLS ya lo acota)
    // y no puede tener ya un acceso: un empleado, un usuario.
    if (d.personaId) {
      const yaTiene = await ej.query('SELECT 1 FROM usuario WHERE persona_id = $1', [d.personaId]);
      if ((yaTiene.rowCount ?? 0) > 0) {
        throw new ErrorDominio('PERSONA_CON_ACCESO', 'Esa persona ya tiene un usuario.');
      }
    }
    let creado;
    try {
      const r = await ej.query<UsuarioCreado>(
        `INSERT INTO usuario (entidad_id, persona_id, email, password_hash)
         VALUES (app_entidad_id(), $1, $2, $3)
         RETURNING id, email, persona_id, activo`,
        [d.personaId ?? null, d.email, await hashearPassword(d.password)],
      );
      creado = r.rows[0]!;
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ErrorDominio('EMAIL_DUPLICADO', 'Ya existe un usuario con ese correo en la entidad.');
      }
      throw err;
    }

    for (const a of d.roles) {
      await ej.query(
        `INSERT INTO usuario_rol (entidad_id, usuario_id, rol_codigo, unidad_id)
         VALUES (app_entidad_id(), $1, $2, $3) ON CONFLICT DO NOTHING`,
        [creado.id, a.rol, a.unidadId],
      );
    }

    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CREAR', tabla: 'usuario', registroId: creado.id as string,
      datosDespues: { ...creado, roles: d.roles }, usuarioId: ctx.usuarioId,
    });
    return { ...creado, roles: d.roles };
  });
}

/** Activa o desactiva un acceso. No se borra: queda el histórico. */
export function cambiarEstado(ctx: Contexto, id: string, activo: boolean, motivo: string) {
  return conTenant(ctx, async (ej) => {
    if (id === ctx.usuarioId) {
      throw new ErrorDominio('AUTO_BLOQUEO', 'No puedes desactivar tu propio usuario.');
    }
    const antes = (await ej.query('SELECT id, email, activo FROM usuario WHERE id = $1', [id])).rows[0];
    if (!antes) throw new ErrorDominio('NO_ENCONTRADO', 'Usuario no encontrado.');
    const r = await ej.query(
      `UPDATE usuario SET activo = $2 WHERE id = $1 RETURNING id, email, activo`, [id, activo]);
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: activo ? 'ACTIVAR' : 'DESACTIVAR', tabla: 'usuario', registroId: id,
      motivo, datosAntes: antes, datosDespues: r.rows[0], usuarioId: ctx.usuarioId,
    });
    return r.rows[0]!;
  });
}

/** Restablece la contraseña y desbloquea la cuenta. */
export function restablecerPassword(ctx: Contexto, id: string, password: string) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `UPDATE usuario
          SET password_hash = $2, intentos_fallidos = 0, bloqueado_hasta = NULL
        WHERE id = $1 RETURNING id, email`,
      [id, await hashearPassword(password)],
    );
    if (!r.rows[0]) throw new ErrorDominio('NO_ENCONTRADO', 'Usuario no encontrado.');
    // La contraseña nunca entra en el log; solo el hecho de haberla restablecido.
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'RESTABLECER_PASSWORD', tabla: 'usuario', registroId: id,
      datosDespues: { email: r.rows[0].email }, usuarioId: ctx.usuarioId,
    });
    return r.rows[0]!;
  });
}

/** Sustituye el conjunto de roles vigentes del usuario. */
export function fijarRoles(ctx: Contexto, id: string, roles: AsignacionRol[]) {
  return conTenant(ctx, async (ej) => {
    const antes = (await ej.query(
      'SELECT rol_codigo, unidad_id FROM usuario_rol WHERE usuario_id = $1', [id]))
      .rows.map((x) => ({ rol: x.rol_codigo, unidadId: x.unidad_id }));
    await ej.query('DELETE FROM usuario_rol WHERE usuario_id = $1', [id]);
    for (const a of roles) {
      await ej.query(
        `INSERT INTO usuario_rol (entidad_id, usuario_id, rol_codigo, unidad_id)
         VALUES (app_entidad_id(), $1, $2, $3)`, [id, a.rol, a.unidadId]);
    }
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'MODIFICAR_ROLES', tabla: 'usuario', registroId: id,
      datosAntes: { roles: antes }, datosDespues: { roles }, usuarioId: ctx.usuarioId,
    });
    return { id, roles };
  });
}

/** Catálogo de roles asignables. */
export function listarRoles(ctx: Contexto) {
  return conTenant(ctx, async (ej) =>
    (await ej.query('SELECT codigo, denominacion FROM rol ORDER BY codigo')).rows);
}
