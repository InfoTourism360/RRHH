import type { Ejecutor } from '../db/pool.js';

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
