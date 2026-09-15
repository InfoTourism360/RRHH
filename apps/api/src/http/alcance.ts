import type { Request } from 'express';
import { conTenant } from '../db/pool.js';
import { ctxDe } from './middleware.js';

/**
 * Alcance de mando: hasta dónde llega un usuario cuando actúa sobre terceros.
 *
 * Regla de diseño: **falla cerrado**. Un responsable al que no se le ha
 * asignado ninguna unidad no manda sobre nadie; antes "sin unidad" se
 * interpretaba como "toda la entidad", que es justo lo contrario.
 */

const MANDO_TOTAL = ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL'];

export type Alcance =
  /** Administración y gestión de personal: toda la entidad. */
  | { tipo: 'ENTIDAD' }
  /** Responsable: sus unidades y las que cuelgan de ellas. */
  | { tipo: 'UNIDADES'; raices: string[] }
  /** Sin mando sobre terceros: solo la propia ficha. */
  | { tipo: 'PROPIO' };

/** Error de autorización uniforme (el manejador de app.ts respeta `status`). */
export function errorPermisos(mensaje = 'No tienes competencia sobre esa persona o unidad.') {
  return Object.assign(new Error(mensaje), { status: 403 });
}

export function alcanceDe(req: Request): Alcance {
  const roles = req.sesion?.roles ?? [];
  if (roles.some((r) => MANDO_TOTAL.includes(r.rol))) return { tipo: 'ENTIDAD' };
  const raices = roles
    .filter((r) => r.rol === 'RESPONSABLE_UNIDAD' && r.unidadId)
    .map((r) => r.unidadId as string);
  return raices.length ? { tipo: 'UNIDADES', raices } : { tipo: 'PROPIO' };
}

/**
 * La representación legal de los trabajadores tiene derecho de acceso al
 * registro de jornada de la plantilla (art. 34.9 ET), no a la gestión de
 * ausencias. Por eso es una excepción acotada y explícita, no un alcance.
 */
export function esRLT(req: Request): boolean {
  return !!req.sesion?.roles.some((r) => r.rol === 'RLT');
}

/** Unidades del alcance, resolviendo la jerarquía hacia abajo. */
const SQL_AMBITO = `
  WITH RECURSIVE ambito AS (
    SELECT id FROM unidad_organica WHERE id = ANY($1::uuid[])
    UNION ALL
    SELECT u.id FROM unidad_organica u JOIN ambito a ON u.padre_id = a.id
  )`;

export async function unidadesDelAlcance(req: Request, alcance: Alcance): Promise<string[]> {
  if (alcance.tipo !== 'UNIDADES') return [];
  return conTenant(ctxDe(req), async (ej) => {
    const r = await ej.query<{ id: string }>(`${SQL_AMBITO} SELECT id FROM ambito`, [alcance.raices]);
    return r.rows.map((x) => x.id);
  });
}

/**
 * ¿Manda este usuario sobre esa persona? Se mira la unidad del puesto que
 * ocupa con relación viva, **sin exigir que la ocupación sea efectiva**: quien
 * está en excedencia o comisión sigue teniendo un responsable que le resuelve
 * las ausencias.
 */
export async function mandaSobrePersona(req: Request, personaId: string): Promise<boolean> {
  const alcance = alcanceDe(req);
  if (alcance.tipo === 'ENTIDAD') return true;
  if (personaId === req.sesion?.personaId) return true;
  if (alcance.tipo === 'PROPIO') return false;
  return conTenant(ctxDe(req), async (ej) => {
    const r = await ej.query(
      `${SQL_AMBITO}
       SELECT 1
         FROM relacion_servicio rs
         JOIN puesto pu ON pu.id = rs.puesto_id
        WHERE rs.persona_id = $2 AND rs.cese IS NULL
          AND pu.unidad_id IN (SELECT id FROM ambito)
        LIMIT 1`,
      [alcance.raices, personaId],
    );
    return (r.rowCount ?? 0) > 0;
  });
}

/** Igual que la anterior, pero para una unidad concreta. */
export async function mandaSobreUnidad(req: Request, unidadId: string): Promise<boolean> {
  const alcance = alcanceDe(req);
  if (alcance.tipo === 'ENTIDAD') return true;
  if (alcance.tipo === 'PROPIO') return false;
  return conTenant(ctxDe(req), async (ej) => {
    const r = await ej.query(
      `${SQL_AMBITO} SELECT 1 FROM ambito WHERE id = $2 LIMIT 1`,
      [alcance.raices, unidadId],
    );
    return (r.rowCount ?? 0) > 0;
  });
}

export async function exigirMandoSobrePersona(req: Request, personaId: string): Promise<void> {
  if (!(await mandaSobrePersona(req, personaId))) throw errorPermisos();
}

export async function exigirMandoSobreUnidad(req: Request, unidadId: string): Promise<void> {
  if (!(await mandaSobreUnidad(req, unidadId))) throw errorPermisos();
}
