import { conTenant, type Contexto, type Ejecutor } from '../db/pool.js';

// Configuración de jornada y fichaje de la entidad (en entidad.politicas JSONB).
// Minimización: la geocerca es OPCIONAL, puntual y desactivable por la entidad.
export interface Geocerca {
  activa: boolean;
  lat?: number;
  lon?: number;
  radioMetros?: number;
}
export interface PoliticasEntidad {
  // Minutos teóricos de trabajo por día de la semana (0=domingo ... 6=sábado).
  minutosPorDia: Record<number, number>;
  toleranciaMin: number;
  geocerca: Geocerca;
}

const POR_DEFECTO: PoliticasEntidad = {
  // 37,5 h/semana repartidas de lunes a viernes = 450 min/día.
  minutosPorDia: { 0: 0, 1: 450, 2: 450, 3: 450, 4: 450, 5: 450, 6: 0 },
  toleranciaMin: 10,
  geocerca: { activa: false },
};

export async function leerPoliticas(ej: Ejecutor, entidadId: string): Promise<PoliticasEntidad> {
  const r = await ej.query<{ politicas: Record<string, unknown> }>(
    'SELECT politicas FROM entidad WHERE id = $1',
    [entidadId],
  );
  const p = (r.rows[0]?.politicas ?? {}) as Partial<PoliticasEntidad>;
  return {
    minutosPorDia: { ...POR_DEFECTO.minutosPorDia, ...(p.minutosPorDia ?? {}) },
    toleranciaMin: p.toleranciaMin ?? POR_DEFECTO.toleranciaMin,
    geocerca: { ...POR_DEFECTO.geocerca, ...(p.geocerca ?? {}) },
  };
}

// Distancia aproximada (Haversine) en metros para validar geocerca puntual.
export function distanciaMetros(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6_371_000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function minutosTeoricos(pol: PoliticasEntidad, fecha: Date): number {
  return pol.minutosPorDia[fecha.getDay()] ?? 0;
}

/** Minutos teóricos por día de la semana. 0 = domingo. */
export type MinutosPorDia = Record<number, number>;

export interface JornadaTipo {
  id: string;
  codigo: string;
  denominacion: string;
  minutosPorDia: MinutosPorDia;
}

/** Reparto semanal válido: los siete días, minutos entre 0 y 1440. */
export function normalizarMinutosPorDia(entrada: MinutosPorDia): MinutosPorDia {
  const salida: MinutosPorDia = {};
  for (let dia = 0; dia <= 6; dia++) {
    const v = Number(entrada[dia] ?? 0);
    if (!Number.isFinite(v) || v < 0 || v > 1440) {
      throw new ErrorJornada('JORNADA_INVALIDA', `Minutos no válidos para el día ${dia}.`);
    }
    salida[dia] = Math.round(v);
  }
  return salida;
}

export class ErrorJornada extends Error {
  constructor(public codigo: string, mensaje: string) {
    super(mensaje);
  }
}

export function listarJornadas(ctx: Contexto) {
  return conTenant(ctx, async (ej) =>
    (await ej.query(
      `SELECT id, codigo, denominacion, minutos_por_dia, activo,
              (SELECT count(*) FROM persona p WHERE p.jornada_tipo_id = jt.id) AS personas
         FROM jornada_tipo jt ORDER BY denominacion`)).rows);
}

export function crearJornada(
  ctx: Contexto,
  d: { codigo: string; denominacion: string; minutosPorDia: MinutosPorDia },
) {
  return conTenant(ctx, async (ej) => {
    const minutos = normalizarMinutosPorDia(d.minutosPorDia);
    try {
      const r = await ej.query(
        `INSERT INTO jornada_tipo (entidad_id, codigo, denominacion, minutos_por_dia)
         VALUES (app_entidad_id(), $1, $2, $3) RETURNING *`,
        [d.codigo, d.denominacion, JSON.stringify(minutos)],
      );
      return r.rows[0]!;
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ErrorJornada('CODIGO_DUPLICADO', 'Ya existe una jornada con ese código.');
      }
      throw err;
    }
  });
}

export function actualizarJornada(
  ctx: Contexto,
  id: string,
  d: { denominacion?: string; minutosPorDia?: MinutosPorDia; activo?: boolean },
) {
  return conTenant(ctx, async (ej) => {
    const minutos = d.minutosPorDia ? normalizarMinutosPorDia(d.minutosPorDia) : null;
    const r = await ej.query(
      `UPDATE jornada_tipo
          SET denominacion    = COALESCE($2, denominacion),
              minutos_por_dia = COALESCE($3::jsonb, minutos_por_dia),
              activo          = COALESCE($4, activo)
        WHERE id = $1 RETURNING *`,
      [id, d.denominacion ?? null, minutos ? JSON.stringify(minutos) : null, d.activo ?? null],
    );
    if (!r.rows[0]) throw new ErrorJornada('NO_ENCONTRADO', 'Jornada no encontrada.');
    return r.rows[0]!;
  });
}

/**
 * Asigna (o retira, con null) la jornada de una persona.
 *
 * La existencia de la jornada se comprueba a mano, dentro del tenant. No basta
 * con la clave foránea: Postgres valida las claves foráneas al margen de la
 * RLS, así que una entidad podía apuntar a la jornada de otra y la referencia
 * se guardaba tan tranquila. Al leerla, la RLS la ocultaba y la persona caía en
 * la jornada por defecto sin que nadie entendiera por qué.
 */
export function asignarJornada(ctx: Contexto, personaId: string, jornadaTipoId: string | null) {
  return conTenant(ctx, async (ej) => {
    if (jornadaTipoId) {
      const existe = await ej.query('SELECT 1 FROM jornada_tipo WHERE id = $1', [jornadaTipoId]);
      if ((existe.rowCount ?? 0) === 0) {
        throw new ErrorJornada('NO_ENCONTRADO', 'Jornada no encontrada en esta entidad.');
      }
    }
    const r = await ej.query(
      'UPDATE persona SET jornada_tipo_id = $2 WHERE id = $1 RETURNING id, jornada_tipo_id',
      [personaId, jornadaTipoId],
    );
    if (!r.rows[0]) throw new ErrorJornada('NO_ENCONTRADO', 'Persona no encontrada.');
    return r.rows[0]!;
  });
}

/**
 * Jornada teórica que se le presupone a una persona.
 *
 * Es la suya si la tiene asignada y la de la entidad si no. Sin esto, el saldo
 * solo significaba algo para quien trabaja de lunes a viernes: a un agente de
 * policía el fin de semana le contaba todo como festivo y el día que libraba
 * como déficit de una jornada entera.
 *
 * No son cuadrantes: no dice qué día trabaja cada cual, solo cuánto se le
 * presupone cada día de la semana.
 */
export async function jornadaDePersona(
  ej: Ejecutor,
  entidadId: string,
  personaId: string,
): Promise<MinutosPorDia> {
  const r = await ej.query<{ minutos_por_dia: MinutosPorDia | null }>(
    `SELECT jt.minutos_por_dia
       FROM persona p
  LEFT JOIN jornada_tipo jt ON jt.id = p.jornada_tipo_id AND jt.activo
      WHERE p.id = $1`,
    [personaId],
  );
  const propia = r.rows[0]?.minutos_por_dia;
  if (propia) return { ...POR_DEFECTO.minutosPorDia, ...propia };
  const pol = await leerPoliticas(ej, entidadId);
  return pol.minutosPorDia;
}
