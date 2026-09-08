import { conTenant, type Contexto, type Ejecutor } from '../db/pool.js';
import { registrarAuditoria } from '../db/auditoria.js';

// -----------------------------------------------------------------------------
// Nota de modelo: las tablas operativas guardan el estado vigente + su ciclo de
// vida (vigencia_desde/hasta). El HISTÓRICO completo y la trazabilidad de cada
// cambio viven en el log inmutable `auditoria` (datos_antes/datos_despues), que
// es el sistema de registro. La ocupación (relacion_servicio) sí se versiona por
// filas sucesivas. "Baja" = cerrar vigencia, nunca DELETE físico.
// -----------------------------------------------------------------------------

export class ErrorDominio extends Error {
  constructor(public codigo: string, mensaje: string) {
    super(mensaje);
  }
}

async function obtenerFila<T extends Record<string, unknown>>(
  ej: Ejecutor,
  tabla: string,
  id: string,
): Promise<T> {
  const r = await ej.query<T>(`SELECT * FROM ${tabla} WHERE id = $1`, [id]);
  const fila = r.rows[0];
  if (!fila) throw new ErrorDominio('NO_ENCONTRADO', `${tabla} ${id} no encontrado.`);
  return fila;
}

// ============================ UNIDAD ORGÁNICA ================================
export interface UnidadInput {
  padreId?: string | null;
  codigo: string;
  denominacion: string;
}

export function crearUnidad(ctx: Contexto, d: UnidadInput) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `INSERT INTO unidad_organica (entidad_id, padre_id, codigo, denominacion)
       VALUES (app_entidad_id(), $1, $2, $3) RETURNING *`,
      [d.padreId ?? null, d.codigo, d.denominacion],
    );
    const fila = r.rows[0]!;
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CREAR', tabla: 'unidad_organica', registroId: fila.id as string,
      datosDespues: fila, usuarioId: ctx.usuarioId,
    });
    return fila;
  });
}

export function actualizarUnidad(ctx: Contexto, id: string, d: Partial<UnidadInput>) {
  return conTenant(ctx, async (ej) => {
    const antes = await obtenerFila(ej, 'unidad_organica', id);
    const r = await ej.query(
      `UPDATE unidad_organica
          SET padre_id = COALESCE($2, padre_id),
              codigo = COALESCE($3, codigo),
              denominacion = COALESCE($4, denominacion)
        WHERE id = $1 RETURNING *`,
      [id, d.padreId ?? null, d.codigo ?? null, d.denominacion ?? null],
    );
    const fila = r.rows[0]!;
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'MODIFICAR', tabla: 'unidad_organica', registroId: id,
      datosAntes: antes, datosDespues: fila, usuarioId: ctx.usuarioId,
    });
    return fila;
  });
}

export function listarUnidades(ctx: Contexto) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query('SELECT * FROM unidad_organica ORDER BY codigo');
    return r.rows;
  });
}

// ================================= PLAZA ====================================
export interface PlazaInput {
  codigo: string;
  denominacion: string;
  grupoCodigo: string;
  escalaCodigo?: string | null;
  subescala?: string | null;
  clase?: string | null;
  dotacion?: number;
}

export function crearPlaza(ctx: Contexto, d: PlazaInput) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `INSERT INTO plaza (entidad_id, codigo, denominacion, grupo_codigo,
                          escala_codigo, subescala, clase, dotacion)
       VALUES (app_entidad_id(), $1,$2,$3,$4,$5,$6, COALESCE($7,1)) RETURNING *`,
      [d.codigo, d.denominacion, d.grupoCodigo, d.escalaCodigo ?? null,
       d.subescala ?? null, d.clase ?? null, d.dotacion ?? null],
    );
    const fila = r.rows[0]!;
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CREAR', tabla: 'plaza', registroId: fila.id as string,
      datosDespues: fila, usuarioId: ctx.usuarioId,
    });
    return fila;
  });
}

export function listarPlazas(ctx: Contexto) {
  return conTenant(ctx, async (ej) => {
    // Une el estado de vacancia derivado (nunca almacenado).
    const r = await ej.query(
      `SELECT p.*, e.ocupantes_vigentes, e.vacante
         FROM plaza p
         LEFT JOIN v_plaza_estado e ON e.plaza_id = p.id
        WHERE p.vigencia_hasta IS NULL
        ORDER BY p.codigo`,
    );
    return r.rows;
  });
}

// ================================= PUESTO ===================================
export interface PuestoInput {
  plazaId: string;
  unidadId: string;
  codigo: string;
  denominacion: string;
  nivelCd: number;
  complementoEsp?: number | null;
  formaProvision?: string | null;
  tipoJornada?: string | null;
  adscripcion?: string | null;
}

export function crearPuesto(ctx: Contexto, d: PuestoInput) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `INSERT INTO puesto (entidad_id, plaza_id, unidad_id, codigo, denominacion,
                           nivel_cd, complemento_esp, forma_provision, tipo_jornada, adscripcion)
       VALUES (app_entidad_id(), $1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.plazaId, d.unidadId, d.codigo, d.denominacion, d.nivelCd,
       d.complementoEsp ?? null, d.formaProvision ?? null, d.tipoJornada ?? null,
       d.adscripcion ?? null],
    );
    const fila = r.rows[0]!;
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CREAR', tabla: 'puesto', registroId: fila.id as string,
      datosDespues: fila, usuarioId: ctx.usuarioId,
    });
    return fila;
  });
}

export function listarPuestos(ctx: Contexto) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `SELECT * FROM puesto WHERE vigencia_hasta IS NULL ORDER BY codigo`,
    );
    return r.rows;
  });
}

// ================================= PERSONA ==================================
export interface PersonaInput {
  tipoDocumento: 'DNI' | 'NIE' | 'PASAPORTE';
  numDocumento: string;
  nombre: string;
  apellido1: string;
  apellido2?: string | null;
  emailCorp?: string | null;
  telefono?: string | null;
}

export function crearPersona(ctx: Contexto, d: PersonaInput) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `INSERT INTO persona (entidad_id, tipo_documento, num_documento, nombre,
                            apellido1, apellido2, email_corp, telefono)
       VALUES (app_entidad_id(), $1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.tipoDocumento, d.numDocumento, d.nombre, d.apellido1,
       d.apellido2 ?? null, d.emailCorp ?? null, d.telefono ?? null],
    );
    const fila = r.rows[0]!;
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CREAR', tabla: 'persona', registroId: fila.id as string,
      datosDespues: fila, usuarioId: ctx.usuarioId,
    });
    return fila;
  });
}

export function listarPersonas(ctx: Contexto) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `SELECT * FROM persona WHERE vigencia_hasta IS NULL ORDER BY apellido1, apellido2, nombre`,
    );
    return r.rows;
  });
}

// ============================ RELACIÓN DE SERVICIO ==========================
export interface RelacionInput {
  personaId: string;
  puestoId: string;
  tipoCodigo: string;
  situacionCodigo: string;
  tomaPosesion: string; // YYYY-MM-DD
  ocupaEfectivo?: boolean;
}

export function crearRelacion(ctx: Contexto, d: RelacionInput) {
  return conTenant(ctx, async (ej) => {
    try {
      const r = await ej.query(
        `INSERT INTO relacion_servicio (entidad_id, persona_id, puesto_id, tipo_codigo,
                                        situacion_codigo, toma_posesion, ocupa_efectivo)
         VALUES (app_entidad_id(), $1,$2,$3,$4,$5, COALESCE($6,true)) RETURNING *`,
        [d.personaId, d.puestoId, d.tipoCodigo, d.situacionCodigo, d.tomaPosesion,
         d.ocupaEfectivo ?? null],
      );
      const fila = r.rows[0]!;
      await registrarAuditoria(ej, ctx.entidadId, {
        accion: 'CREAR', tabla: 'relacion_servicio', registroId: fila.id as string,
        datosDespues: fila, usuarioId: ctx.usuarioId,
      });
      return fila;
    } catch (err) {
      if ((err as { code?: string }).code === '23P01') {
        throw new ErrorDominio('SOLAPE_OCUPACION',
          'Ya existe un ocupante efectivo del puesto en fechas solapadas.');
      }
      throw err;
    }
  });
}

/** Cese: cierra la relación con fecha. No borra la fila (histórico). */
export function cesarRelacion(ctx: Contexto, id: string, cese: string, motivo: string) {
  return conTenant(ctx, async (ej) => {
    const antes = await obtenerFila(ej, 'relacion_servicio', id);
    const r = await ej.query(
      `UPDATE relacion_servicio SET cese = $2 WHERE id = $1 AND cese IS NULL RETURNING *`,
      [id, cese],
    );
    if (!r.rows[0]) throw new ErrorDominio('YA_CESADA', 'La relación ya estaba cesada.');
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CERRAR_VIGENCIA', tabla: 'relacion_servicio', registroId: id,
      motivo, datosAntes: antes, datosDespues: r.rows[0], usuarioId: ctx.usuarioId,
    });
    return r.rows[0];
  });
}

/**
 * Cambio de situación administrativa (p. ej. pasar a excedencia/comisión).
 * Cierra la relación vigente y crea una nueva versión: NUNCA sobrescribe.
 */
export function cambiarSituacion(
  ctx: Contexto,
  id: string,
  d: { situacionCodigo: string; desde: string; ocupaEfectivo: boolean; motivo: string },
) {
  return conTenant(ctx, async (ej) => {
    const antes = await obtenerFila<Record<string, string | boolean>>(ej, 'relacion_servicio', id);
    // Cierra la versión anterior el día previo al cambio.
    await ej.query(
      `UPDATE relacion_servicio SET cese = ($2::date - 1) WHERE id = $1 AND cese IS NULL`,
      [id, d.desde],
    );
    const r = await ej.query(
      `INSERT INTO relacion_servicio (entidad_id, persona_id, puesto_id, tipo_codigo,
                                      situacion_codigo, toma_posesion, ocupa_efectivo)
       VALUES (app_entidad_id(), $1,$2,$3,$4,$5,$6) RETURNING *`,
      [antes.persona_id, antes.puesto_id, antes.tipo_codigo, d.situacionCodigo,
       d.desde, d.ocupaEfectivo],
    );
    const nueva = r.rows[0]!;
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CAMBIO_SITUACION', tabla: 'relacion_servicio', registroId: nueva.id as string,
      motivo: d.motivo, datosAntes: antes, datosDespues: nueva, usuarioId: ctx.usuarioId,
    });
    return nueva;
  });
}

export function listarRelaciones(ctx: Contexto, filtro?: { personaId?: string; puestoId?: string }) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `SELECT * FROM relacion_servicio
        WHERE ($1::uuid IS NULL OR persona_id = $1)
          AND ($2::uuid IS NULL OR puesto_id = $2)
        ORDER BY toma_posesion DESC`,
      [filtro?.personaId ?? null, filtro?.puestoId ?? null],
    );
    return r.rows;
  });
}

export function historialAuditoria(ctx: Contexto, tabla: string, registroId: string) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `SELECT id, ocurrido_en, usuario_id, accion, motivo, datos_antes, datos_despues
         FROM auditoria WHERE tabla = $1 AND registro_id = $2 ORDER BY id`,
      [tabla, registroId],
    );
    return r.rows;
  });
}
