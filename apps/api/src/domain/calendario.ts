import { conTenant, type Contexto, type Ejecutor } from '../db/pool.js';
import { registrarAuditoria } from '../db/auditoria.js';

export type UnidadComputo = 'DIAS_NATURALES' | 'DIAS_HABILES' | 'HORAS';

function* rangoFechas(desde: string, hasta: string): Generator<Date> {
  const d = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  while (d <= fin) {
    yield new Date(d);
    d.setDate(d.getDate() + 1);
  }
}

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Conjunto de festivos (cualquier ámbito) de la entidad en un rango. */
export async function festivosEnRango(ej: Ejecutor, desde: string, hasta: string): Promise<Set<string>> {
  const r = await ej.query<{ fecha: string }>(
    `SELECT fecha FROM calendario_festivo WHERE fecha >= $1::date AND fecha <= $2::date`,
    [desde, hasta],
  );
  return new Set(r.rows.map((x) => x.fecha));
}

/** Cuenta días según la unidad de cómputo, excluyendo findes y festivos en hábiles. */
export function contarDias(
  desde: string,
  hasta: string,
  unidad: UnidadComputo,
  festivos: Set<string>,
  horas?: number | null,
): number {
  if (unidad === 'HORAS') return horas ?? 0;
  let n = 0;
  for (const d of rangoFechas(desde, hasta)) {
    if (unidad === 'DIAS_NATURALES') {
      n++;
    } else {
      const finde = d.getDay() === 0 || d.getDay() === 6;
      if (!finde && !festivos.has(iso(d))) n++;
    }
  }
  return n;
}

// ---------------------------- Festivos: CRUD --------------------------------
export function listarFestivos(ctx: Contexto, anio: number) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `SELECT * FROM calendario_festivo
        WHERE fecha >= make_date($1,1,1) AND fecha <= make_date($1,12,31) ORDER BY fecha`,
      [anio],
    );
    return r.rows;
  });
}

export function crearFestivo(ctx: Contexto, d: { fecha: string; denominacion: string; ambito: string }) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `INSERT INTO calendario_festivo (entidad_id, fecha, denominacion, ambito)
       VALUES (app_entidad_id(), $1,$2,$3) RETURNING *`,
      [d.fecha, d.denominacion, d.ambito],
    );
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CREAR', tabla: 'calendario_festivo', registroId: r.rows[0]!.id as string,
      datosDespues: r.rows[0], usuarioId: ctx.usuarioId,
    });
    return r.rows[0]!;
  });
}
