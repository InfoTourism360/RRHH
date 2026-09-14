import { conTenant, type Contexto } from '../db/pool.js';

/**
 * RPT — Relación de Puestos de Trabajo (art. 74 TREBEP).
 *
 * Vista de consulta y exportación sobre el modelo PLAZA → PUESTO → OCUPANTE.
 * No escribe nada: la RPT se edita desde «Plantilla», aquí solo se lee.
 */

/**
 * Estado de cobertura de un puesto.
 *
 * La distinción que importa es RESERVADO vs. VACANTE. `relacion_servicio`
 * marca con `ocupa_efectivo = false` al titular que conserva el puesto
 * mientras está en excedencia con reserva, servicios especiales o comisión de
 * servicios. Ese puesto no tiene ocupante efectivo, pero **no es vacante**: no
 * puede incluirse en una oferta de empleo público ni sacarse a concurso,
 * porque su titular tiene derecho a volver.
 *
 * Contarlo como vacante es el error caro de este dominio, así que se separa.
 */
export type EstadoPuesto = 'OCUPADO' | 'OCUPADO_CON_RESERVA' | 'RESERVADO' | 'VACANTE';

export interface FilaRPT {
  puesto_id: string;
  codigo: string;
  denominacion: string;
  unidad_codigo: string;
  unidad: string;
  plaza_codigo: string;
  grupo_codigo: string;
  grupo: string;
  escala: string | null;
  subescala: string | null;
  nivel_cd: number;
  /** Complemento específico anual. NULL = sin consignar (no es lo mismo que 0). */
  complemento_esp: string | null;
  forma_provision: string | null;
  tipo_jornada: string | null;
  adscripcion: string | null;
  estado: EstadoPuesto;
  ocupante: string | null;
  ocupante_tipo: string | null;
  ocupante_situacion: string | null;
  /** Titular que conserva la reserva del puesto, si lo hay. */
  reserva_de: string | null;
  reserva_situacion: string | null;
}

export interface FiltrosRPT {
  unidadId?: string;
  grupoCodigo?: string;
  /** Solo puestos realmente ofertables (excluye los reservados). */
  soloVacantes?: boolean;
}

const SQL = `
  SELECT pu.id AS puesto_id, pu.codigo, pu.denominacion,
         u.codigo AS unidad_codigo, u.denominacion AS unidad,
         pl.codigo AS plaza_codigo, pl.grupo_codigo,
         g.denominacion AS grupo, e.denominacion AS escala, pl.subescala,
         pu.nivel_cd, pu.complemento_esp,
         fp.denominacion AS forma_provision,
         tj.denominacion AS tipo_jornada,
         pu.adscripcion,
         CASE
           WHEN oc.nombre IS NOT NULL AND rv.nombre IS NOT NULL THEN 'OCUPADO_CON_RESERVA'
           WHEN oc.nombre IS NOT NULL THEN 'OCUPADO'
           WHEN rv.nombre IS NOT NULL THEN 'RESERVADO'
           ELSE 'VACANTE'
         END AS estado,
         oc.nombre AS ocupante, oc.tipo AS ocupante_tipo, oc.situacion AS ocupante_situacion,
         rv.nombre AS reserva_de, rv.situacion AS reserva_situacion
    FROM puesto pu
    JOIN plaza pl            ON pl.id = pu.plaza_id
    JOIN unidad_organica u   ON u.id = pu.unidad_id
    JOIN cat_grupo_clasificacion g ON g.codigo = pl.grupo_codigo
    LEFT JOIN cat_escala e          ON e.codigo = pl.escala_codigo
    LEFT JOIN cat_forma_provision fp ON fp.codigo = pu.forma_provision
    LEFT JOIN cat_tipo_jornada tj    ON tj.codigo = pu.tipo_jornada
    -- Ocupante efectivo: quien está hoy en el puesto (titular o interino).
    LEFT JOIN LATERAL (
      SELECT p.nombre || ' ' || p.apellido1 || COALESCE(' ' || p.apellido2, '') AS nombre,
             tr.denominacion AS tipo, sa.denominacion AS situacion
        FROM relacion_servicio rs
        JOIN persona p ON p.id = rs.persona_id
        JOIN cat_tipo_relacion tr ON tr.codigo = rs.tipo_codigo
        JOIN cat_situacion_administrativa sa ON sa.codigo = rs.situacion_codigo
       WHERE rs.puesto_id = pu.id AND rs.cese IS NULL AND rs.ocupa_efectivo
       ORDER BY rs.toma_posesion DESC
       LIMIT 1
    ) oc ON true
    -- Titular ausente que conserva la reserva del puesto.
    LEFT JOIN LATERAL (
      SELECT p.nombre || ' ' || p.apellido1 || COALESCE(' ' || p.apellido2, '') AS nombre,
             sa.denominacion AS situacion
        FROM relacion_servicio rs
        JOIN persona p ON p.id = rs.persona_id
        JOIN cat_situacion_administrativa sa ON sa.codigo = rs.situacion_codigo
       WHERE rs.puesto_id = pu.id AND rs.cese IS NULL
         AND NOT rs.ocupa_efectivo AND sa.reserva_puesto
       ORDER BY rs.toma_posesion DESC
       LIMIT 1
    ) rv ON true
   WHERE pu.vigencia_hasta IS NULL
     AND pl.vigencia_hasta IS NULL
     AND ($1::uuid IS NULL OR pu.unidad_id = $1::uuid)
     AND ($2::text IS NULL OR pl.grupo_codigo = $2::text)
   ORDER BY u.codigo, pu.nivel_cd DESC, pu.codigo
`;

export function consultarRPT(ctx: Contexto, f: FiltrosRPT = {}): Promise<FilaRPT[]> {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query<FilaRPT>(SQL, [f.unidadId ?? null, f.grupoCodigo ?? null]);
    return f.soloVacantes ? r.rows.filter((x) => x.estado === 'VACANTE') : r.rows;
  });
}

export interface ResumenRPT {
  total: number;
  ocupados: number;
  /** Ofertables de verdad: sin ocupante y sin reserva. */
  vacantes: number;
  /** Sin ocupante efectivo pero con titular que vuelve: NO ofertables. */
  reservados: number;
  /** Puestos sin complemento específico consignado. */
  sinComplemento: number;
}

export function resumirRPT(filas: FilaRPT[]): ResumenRPT {
  return {
    total: filas.length,
    ocupados: filas.filter((f) => f.estado === 'OCUPADO' || f.estado === 'OCUPADO_CON_RESERVA').length,
    vacantes: filas.filter((f) => f.estado === 'VACANTE').length,
    reservados: filas.filter((f) => f.estado === 'RESERVADO').length,
    sinComplemento: filas.filter((f) => f.complemento_esp === null).length,
  };
}
