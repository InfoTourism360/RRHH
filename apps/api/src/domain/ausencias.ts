import { conTenant, type Contexto, type Ejecutor } from '../db/pool.js';
import { registrarAuditoria } from '../db/auditoria.js';
import { ErrorDominio } from './estructura.js';
import { contarDias, festivosEnRango, iso, type UnidadComputo } from './calendario.js';

// ---------------------------------------------------------------------------
// Catálogo TREBEP precargable por entidad (editable después). Base: RDL 5/2015
// arts. 48 y 50. Los importes/días concretos los ajusta la entidad.
// ---------------------------------------------------------------------------
interface DefTipo {
  codigo: string; denominacion: string; base: string;
  unidad: UnidadComputo; devengo: 'ANUAL' | 'POR_HECHO';
  consumeSaldo: boolean; justificante: boolean; preaviso: boolean; diasPreaviso: number;
  aprobador: 'RESPONSABLE_UNIDAD' | 'GESTOR_PERSONAL' | 'AUTOMATICO'; solape: boolean;
}
const CATALOGO_TREBEP: DefTipo[] = [
  { codigo: 'VACACIONES', denominacion: 'Vacaciones anuales', base: 'Art. 50 TREBEP', unidad: 'DIAS_HABILES', devengo: 'ANUAL', consumeSaldo: true, justificante: false, preaviso: true, diasPreaviso: 15, aprobador: 'RESPONSABLE_UNIDAD', solape: false },
  { codigo: 'ASUNTOS_PART', denominacion: 'Asuntos particulares', base: 'Art. 48.k TREBEP', unidad: 'DIAS_HABILES', devengo: 'ANUAL', consumeSaldo: true, justificante: false, preaviso: false, diasPreaviso: 0, aprobador: 'RESPONSABLE_UNIDAD', solape: false },
  { codigo: 'FALLEC_FAM', denominacion: 'Fallecimiento/enfermedad grave de familiar', base: 'Art. 48.a TREBEP', unidad: 'DIAS_HABILES', devengo: 'POR_HECHO', consumeSaldo: false, justificante: true, preaviso: false, diasPreaviso: 0, aprobador: 'RESPONSABLE_UNIDAD', solape: false },
  { codigo: 'DEBER_INEXC', denominacion: 'Cumplimiento de deber inexcusable', base: 'Art. 48.j TREBEP', unidad: 'HORAS', devengo: 'POR_HECHO', consumeSaldo: false, justificante: true, preaviso: false, diasPreaviso: 0, aprobador: 'GESTOR_PERSONAL', solape: true },
  { codigo: 'EXAMENES', denominacion: 'Concurrencia a exámenes finales', base: 'Art. 48.d TREBEP', unidad: 'DIAS_HABILES', devengo: 'POR_HECHO', consumeSaldo: false, justificante: true, preaviso: false, diasPreaviso: 0, aprobador: 'RESPONSABLE_UNIDAD', solape: false },
  { codigo: 'TRASLADO_DOM', denominacion: 'Traslado de domicilio habitual', base: 'Art. 48.f TREBEP', unidad: 'DIAS_HABILES', devengo: 'POR_HECHO', consumeSaldo: false, justificante: false, preaviso: false, diasPreaviso: 0, aprobador: 'RESPONSABLE_UNIDAD', solape: false },
  { codigo: 'CONCILIACION', denominacion: 'Conciliación / cuidado de menor', base: 'Arts. 48-49 TREBEP', unidad: 'HORAS', devengo: 'POR_HECHO', consumeSaldo: false, justificante: true, preaviso: false, diasPreaviso: 0, aprobador: 'GESTOR_PERSONAL', solape: true },
  { codigo: 'MATRIMONIO', denominacion: 'Permiso por matrimonio / pareja de hecho', base: 'Convenio/Acuerdo', unidad: 'DIAS_NATURALES', devengo: 'POR_HECHO', consumeSaldo: false, justificante: true, preaviso: true, diasPreaviso: 15, aprobador: 'GESTOR_PERSONAL', solape: false },
];

export function precargarCatalogo(ctx: Contexto) {
  return conTenant(ctx, async (ej) => {
    for (const t of CATALOGO_TREBEP) {
      await ej.query(
        `INSERT INTO tipo_ausencia
           (entidad_id, codigo, denominacion, base_normativa, unidad_computo, devengo,
            consume_saldo, requiere_justificante, requiere_preaviso, dias_preaviso, aprobador, permite_solapamiento)
         VALUES (app_entidad_id(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (entidad_id, codigo) DO NOTHING`,
        [t.codigo, t.denominacion, t.base, t.unidad, t.devengo, t.consumeSaldo,
         t.justificante, t.preaviso, t.diasPreaviso, t.aprobador, t.solape],
      );
    }
    const r = await ej.query('SELECT * FROM tipo_ausencia ORDER BY codigo');
    return r.rows;
  });
}

/** Días de vacaciones según antigüedad (art. 50 TREBEP): 22 hábiles + adicionales. */
export function diasVacacionesPorAntiguedad(anios: number): number {
  if (anios >= 30) return 26;
  if (anios >= 25) return 25;
  if (anios >= 20) return 24;
  if (anios >= 15) return 23;
  return 22;
}

export function listarTipos(ctx: Contexto) {
  return conTenant(ctx, async (ej) => (await ej.query('SELECT * FROM tipo_ausencia WHERE activo ORDER BY codigo')).rows);
}

export function actualizarTipo(ctx: Contexto, id: string, campos: Record<string, unknown>) {
  return conTenant(ctx, async (ej) => {
    const antes = (await ej.query('SELECT * FROM tipo_ausencia WHERE id = $1', [id])).rows[0];
    if (!antes) throw new ErrorDominio('NO_ENCONTRADO', 'Tipo de ausencia no encontrado.');
    const r = await ej.query(
      `UPDATE tipo_ausencia SET
         denominacion = COALESCE($2, denominacion),
         requiere_justificante = COALESCE($3, requiere_justificante),
         requiere_preaviso = COALESCE($4, requiere_preaviso),
         dias_preaviso = COALESCE($5, dias_preaviso),
         aprobador = COALESCE($6, aprobador),
         permite_solapamiento = COALESCE($7, permite_solapamiento),
         activo = COALESCE($8, activo)
       WHERE id = $1 RETURNING *`,
      [id, campos.denominacion ?? null, campos.requiereJustificante ?? null,
       campos.requierePreaviso ?? null, campos.diasPreaviso ?? null, campos.aprobador ?? null,
       campos.permiteSolapamiento ?? null, campos.activo ?? null],
    );
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'MODIFICAR', tabla: 'tipo_ausencia', registroId: id,
      datosAntes: antes, datosDespues: r.rows[0], usuarioId: ctx.usuarioId,
    });
    return r.rows[0]!;
  });
}

async function unidadDePersona(ej: Ejecutor, personaId: string): Promise<string | null> {
  const r = await ej.query<{ unidad_id: string }>(
    `SELECT pu.unidad_id
       FROM relacion_servicio rs
       JOIN puesto pu ON pu.id = rs.puesto_id
      WHERE rs.persona_id = $1 AND rs.cese IS NULL AND rs.ocupa_efectivo
      ORDER BY rs.toma_posesion DESC LIMIT 1`,
    [personaId],
  );
  return r.rows[0]?.unidad_id ?? null;
}

export interface SolicitudInput {
  personaId: string;
  tipoCodigo: string;
  fechaInicio: string;
  fechaFin: string;
  horas?: number | null;
  observaciones?: string | null;
}

export function solicitar(ctx: Contexto, d: SolicitudInput) {
  return conTenant(ctx, async (ej) => {
    const tipo = (await ej.query('SELECT * FROM tipo_ausencia WHERE codigo = $1 AND activo', [d.tipoCodigo])).rows[0];
    if (!tipo) throw new ErrorDominio('TIPO_INVALIDO', 'Tipo de ausencia no válido.');

    const festivos = await festivosEnRango(ej, d.fechaInicio, d.fechaFin);
    const dias = contarDias(d.fechaInicio, d.fechaFin, tipo.unidad_computo, festivos, d.horas);
    if (dias <= 0) throw new ErrorDominio('COMPUTO_CERO', 'El periodo no computa ningún día/hora.');

    // Solapamiento con otras solicitudes vivas de la misma persona.
    if (!tipo.permite_solapamiento) {
      const solapa = await ej.query(
        `SELECT 1 FROM solicitud_ausencia
          WHERE persona_id = $1 AND estado IN ('SOLICITADA','APROBADA')
            AND daterange(fecha_inicio, fecha_fin, '[]') && daterange($2::date, $3::date, '[]') LIMIT 1`,
        [d.personaId, d.fechaInicio, d.fechaFin],
      );
      if ((solapa.rowCount ?? 0) > 0) {
        throw new ErrorDominio('SOLAPAMIENTO', 'Ya tienes una ausencia en fechas solapadas.');
      }
    }

    // Saldo (devengo anual con consumo).
    if (tipo.consume_saldo) {
      const anio = Number(d.fechaInicio.slice(0, 4));
      const disp = await disponibleSaldo(ej, d.personaId, tipo.id, anio);
      if (dias > disp) throw new ErrorDominio('SIN_SALDO', `Saldo insuficiente: disponible ${disp}, solicitado ${dias}.`);
    }

    const automatico = tipo.aprobador === 'AUTOMATICO';
    const r = await ej.query(
      `INSERT INTO solicitud_ausencia
         (entidad_id, persona_id, tipo_ausencia_id, fecha_inicio, fecha_fin, horas,
          dias_computados, estado, observaciones, resuelta_en, resuelto_por, motivo_resolucion)
       VALUES (app_entidad_id(),$1,$2,$3,$4,$5,$6,$7,$8,
               CASE WHEN $7='APROBADA' THEN now() END, NULL,
               CASE WHEN $7='APROBADA' THEN 'Aprobación automática' END)
       RETURNING *`,
      [d.personaId, tipo.id, d.fechaInicio, d.fechaFin, d.horas ?? null, dias,
       automatico ? 'APROBADA' : 'SOLICITADA', d.observaciones ?? null],
    );
    const sol = r.rows[0]!;

    // Notifica al responsable de la unidad (si procede).
    if (!automatico) {
      const unidadId = await unidadDePersona(ej, d.personaId);
      if (unidadId) {
        const resp = await ej.query<{ persona_id: string | null }>(
          `SELECT u.persona_id FROM v_responsable_unidad v
             JOIN usuario u ON u.id = v.usuario_id
            WHERE v.unidad_id = $1 LIMIT 1`,
          [unidadId],
        );
        const pid = resp.rows[0]?.persona_id;
        if (pid) {
          await ej.query(
            `INSERT INTO notificacion (entidad_id, persona_id, tipo, mensaje, datos)
             VALUES (app_entidad_id(),$1,'AUSENCIA_PENDIENTE',$2,$3)`,
            [pid, `Nueva solicitud de ausencia pendiente de tu validación (${tipo.denominacion}).`,
             JSON.stringify({ solicitudId: sol.id })],
          );
        }
      }
    }

    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CREAR', tabla: 'solicitud_ausencia', registroId: sol.id as string,
      datosDespues: sol, usuarioId: ctx.usuarioId,
    });
    return sol;
  });
}

async function disponibleSaldo(ej: Ejecutor, personaId: string, tipoId: string, anio: number): Promise<number> {
  const asig = await ej.query<{ dias_asignados: string }>(
    `SELECT dias_asignados FROM saldo_ausencia WHERE persona_id = $1 AND tipo_ausencia_id = $2 AND anio = $3`,
    [personaId, tipoId, anio],
  );
  const asignado = Number(asig.rows[0]?.dias_asignados ?? 0);
  const cons = await ej.query<{ total: string }>(
    `SELECT COALESCE(SUM(dias_computados),0) AS total FROM solicitud_ausencia
      WHERE persona_id = $1 AND tipo_ausencia_id = $2 AND estado = 'APROBADA'
        AND extract(year FROM fecha_inicio) = $3`,
    [personaId, tipoId, anio],
  );
  return asignado - Number(cons.rows[0]?.total ?? 0);
}

function resolver(ctx: Contexto, id: string, aprobar: boolean, motivo?: string) {
  return conTenant(ctx, async (ej) => {
    const sol = (await ej.query('SELECT * FROM solicitud_ausencia WHERE id = $1', [id])).rows[0];
    if (!sol) throw new ErrorDominio('NO_ENCONTRADO', 'Solicitud no encontrada.');
    if (sol.estado !== 'SOLICITADA') throw new ErrorDominio('ESTADO_INVALIDO', 'La solicitud ya está resuelta.');
    if (!aprobar && (!motivo || motivo.trim().length < 3)) {
      throw new ErrorDominio('MOTIVO_REQUERIDO', 'La denegación requiere motivo.');
    }
    const r = await ej.query(
      `UPDATE solicitud_ausencia
          SET estado = $2, resuelta_en = now(), resuelto_por = $3, motivo_resolucion = $4
        WHERE id = $1 RETURNING *`,
      [id, aprobar ? 'APROBADA' : 'DENEGADA', ctx.usuarioId ?? null, motivo ?? null],
    );
    await ej.query(
      `INSERT INTO notificacion (entidad_id, persona_id, tipo, mensaje, datos)
       VALUES (app_entidad_id(),$1,$2,$3,$4)`,
      [sol.persona_id, aprobar ? 'AUSENCIA_APROBADA' : 'AUSENCIA_DENEGADA',
       aprobar ? 'Tu solicitud de ausencia ha sido aprobada.' : `Tu solicitud ha sido denegada. Motivo: ${motivo}`,
       JSON.stringify({ solicitudId: id })],
    );
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: aprobar ? 'APROBAR' : 'DENEGAR', tabla: 'solicitud_ausencia', registroId: id,
      motivo: motivo ?? null, datosAntes: sol, datosDespues: r.rows[0], usuarioId: ctx.usuarioId,
    });
    return r.rows[0]!;
  });
}
export const aprobar = (ctx: Contexto, id: string) => resolver(ctx, id, true);
export const denegar = (ctx: Contexto, id: string, motivo: string) => resolver(ctx, id, false, motivo);

export function cancelar(ctx: Contexto, id: string, personaId: string) {
  return conTenant(ctx, async (ej) => {
    const sol = (await ej.query('SELECT * FROM solicitud_ausencia WHERE id = $1', [id])).rows[0];
    if (!sol) throw new ErrorDominio('NO_ENCONTRADO', 'Solicitud no encontrada.');
    if (sol.persona_id !== personaId) throw new ErrorDominio('NO_AUTORIZADO', 'Solo puedes cancelar tus solicitudes.');
    if (!['SOLICITADA', 'APROBADA'].includes(sol.estado)) throw new ErrorDominio('ESTADO_INVALIDO', 'No cancelable.');
    const r = await ej.query(
      `UPDATE solicitud_ausencia SET estado = 'CANCELADA' WHERE id = $1 RETURNING *`, [id]);
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CANCELAR', tabla: 'solicitud_ausencia', registroId: id,
      datosAntes: sol, datosDespues: r.rows[0], usuarioId: ctx.usuarioId,
    });
    return r.rows[0]!;
  });
}

export function misSolicitudes(ctx: Contexto, personaId: string) {
  return conTenant(ctx, async (ej) =>
    (await ej.query(
      `SELECT s.*, t.denominacion AS tipo FROM solicitud_ausencia s
         JOIN tipo_ausencia t ON t.id = s.tipo_ausencia_id
        WHERE s.persona_id = $1 ORDER BY s.fecha_inicio DESC`, [personaId])).rows);
}

/** Solicitudes pendientes de validación en la unidad del responsable. */
export function pendientesUnidad(ctx: Contexto, unidadId: string | null) {
  return conTenant(ctx, async (ej) =>
    (await ej.query(
      `SELECT s.*, p.nombre, p.apellido1, t.denominacion AS tipo
         FROM solicitud_ausencia s
         JOIN persona p ON p.id = s.persona_id
         JOIN tipo_ausencia t ON t.id = s.tipo_ausencia_id
         JOIN relacion_servicio rs ON rs.persona_id = s.persona_id AND rs.cese IS NULL AND rs.ocupa_efectivo
         JOIN puesto pu ON pu.id = rs.puesto_id
        WHERE s.estado = 'SOLICITADA' AND ($1::uuid IS NULL OR pu.unidad_id = $1)
        ORDER BY s.solicitada_en`, [unidadId])).rows);
}

/** Calendario de equipo: ausencias aprobadas de la unidad (para ver solapes). */
export function calendarioEquipo(ctx: Contexto, unidadId: string, desde: string, hasta: string) {
  return conTenant(ctx, async (ej) =>
    (await ej.query(
      `SELECT s.persona_id, p.nombre, p.apellido1, s.fecha_inicio, s.fecha_fin, t.denominacion AS tipo
         FROM solicitud_ausencia s
         JOIN persona p ON p.id = s.persona_id
         JOIN tipo_ausencia t ON t.id = s.tipo_ausencia_id
         JOIN relacion_servicio rs ON rs.persona_id = s.persona_id AND rs.cese IS NULL AND rs.ocupa_efectivo
         JOIN puesto pu ON pu.id = rs.puesto_id
        WHERE s.estado = 'APROBADA' AND pu.unidad_id = $1
          AND daterange(s.fecha_inicio, s.fecha_fin, '[]') && daterange($2::date,$3::date,'[]')
        ORDER BY s.fecha_inicio`, [unidadId, desde, hasta])).rows);
}

export function saldos(ctx: Contexto, personaId: string, anio: number) {
  return conTenant(ctx, async (ej) => {
    const tipos = (await ej.query(`SELECT * FROM tipo_ausencia WHERE consume_saldo AND activo`)).rows;
    const out = [];
    for (const t of tipos) {
      const asignado = Number(
        (await ej.query('SELECT dias_asignados FROM saldo_ausencia WHERE persona_id=$1 AND tipo_ausencia_id=$2 AND anio=$3',
          [personaId, t.id, anio])).rows[0]?.dias_asignados ?? 0);
      const consumido = Number(
        (await ej.query(
          `SELECT COALESCE(SUM(dias_computados),0) c FROM solicitud_ausencia
            WHERE persona_id=$1 AND tipo_ausencia_id=$2 AND estado='APROBADA' AND extract(year FROM fecha_inicio)=$3`,
          [personaId, t.id, anio])).rows[0]?.c ?? 0);
      out.push({ tipo: t.codigo, denominacion: t.denominacion, anio, asignado, consumido, disponible: asignado - consumido });
    }
    return out;
  });
}

export function asignarSaldo(ctx: Contexto, d: { personaId: string; tipoCodigo: string; anio: number; dias: number }) {
  return conTenant(ctx, async (ej) => {
    const t = (await ej.query('SELECT id FROM tipo_ausencia WHERE codigo=$1', [d.tipoCodigo])).rows[0];
    if (!t) throw new ErrorDominio('TIPO_INVALIDO', 'Tipo no válido.');
    const r = await ej.query(
      `INSERT INTO saldo_ausencia (entidad_id, persona_id, tipo_ausencia_id, anio, dias_asignados)
       VALUES (app_entidad_id(),$1,$2,$3,$4)
       ON CONFLICT (entidad_id, persona_id, tipo_ausencia_id, anio)
       DO UPDATE SET dias_asignados = EXCLUDED.dias_asignados RETURNING *`,
      [d.personaId, t.id, d.anio, d.dias]);
    return r.rows[0]!;
  });
}

/** Fechas (ISO) cubiertas por ausencias APROBADAS: integra con el cómputo de jornada. */
export function diasAusenciaAprobada(ctx: Contexto, personaId: string, desde: string, hasta: string): Promise<Set<string>> {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query<{ fecha_inicio: string; fecha_fin: string }>(
      `SELECT fecha_inicio, fecha_fin FROM solicitud_ausencia
        WHERE persona_id=$1 AND estado='APROBADA'
          AND daterange(fecha_inicio, fecha_fin, '[]') && daterange($2::date,$3::date,'[]')`,
      [personaId, desde, hasta]);
    const set = new Set<string>();
    for (const row of r.rows) {
      const d = new Date(`${row.fecha_inicio}T00:00:00`);
      const fin = new Date(`${row.fecha_fin}T00:00:00`);
      while (d <= fin) { set.add(iso(d)); d.setDate(d.getDate() + 1); }
    }
    return set;
  });
}
