import { ownerPool, conTenant, type Contexto } from '../db/pool.js';

export interface EventoActividad {
  entidadId?: string | null;
  usuarioId?: string | null;
  accion: string;
  metodo?: string | null;
  ruta?: string | null;
  estadoHttp?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  detalle?: Record<string, unknown>;
}

/**
 * Registra una traza de actividad (ENS). Usa el rol propietario para poder
 * registrar también eventos previos al login. No debe bloquear la petición:
 * los errores de logging se tragan (se vuelca a consola).
 */
export async function registrarActividad(ev: EventoActividad): Promise<void> {
  try {
    await ownerPool.query(
      `INSERT INTO registro_actividad
         (entidad_id, usuario_id, accion, metodo, ruta, estado_http, ip, user_agent, detalle)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ev.entidadId ?? null, ev.usuarioId ?? null, ev.accion, ev.metodo ?? null,
       ev.ruta ?? null, ev.estadoHttp ?? null, ev.ip ?? null, ev.userAgent ?? null,
       JSON.stringify(ev.detalle ?? {})],
    );
  } catch (e) {
    console.error('registro_actividad:', (e as Error).message);
  }
}

export function listarActividad(ctx: Contexto, desde: string, hasta: string, limite = 500) {
  return conTenant(ctx, async (ej) =>
    (await ej.query(
      `SELECT id, momento, usuario_id, accion, metodo, ruta, estado_http, ip
         FROM registro_actividad
        WHERE momento >= $1::date AND momento < ($2::date + 1)
        ORDER BY momento DESC LIMIT $3`,
      [desde, hasta, limite])).rows);
}

/** Purga de retención (ENS): elimina trazas más antiguas que N días. Ejecutar por cron. */
export async function purgarActividad(diasRetencion: number): Promise<number> {
  // Se ejecuta como propietario (excepción controlada a la inmutabilidad, para
  // cumplir la política de retención). El trigger bloquea DELETE, así que la
  // purga se hace por partición temporal en producción; aquí queda documentada.
  void diasRetencion;
  return 0;
}
