import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

// Postgres devuelve NUMERIC/BIGINT como string por defecto; para importes lo
// dejamos así (evita pérdida de precisión). Las fechas DATE las tratamos como
// string 'YYYY-MM-DD' para no arrastrar husos horarios en cómputos de jornada.
pg.types.setTypeParser(1082, (v) => v); // date -> string

// Pool de la APLICACIÓN (rol NOBYPASSRLS). Todo el runtime pasa por aquí.
export const appPool = new Pool({ connectionString: env.DATABASE_URL_APP, max: 10 });

// Pool del PROPIETARIO. Solo migraciones y provisioning (alta de entidad).
export const ownerPool = new Pool({ connectionString: env.DATABASE_URL_OWNER, max: 4 });

export interface Contexto {
  entidadId: string;
  usuarioId?: string | null;
}

export type Ejecutor = {
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ) => Promise<pg.QueryResult<T>>;
};

/**
 * Ejecuta `fn` dentro de una transacción con el contexto de tenant fijado por
 * SET LOCAL. Es el ÚNICO camino para tocar datos de tenant desde la app: sin
 * contexto, la RLS no deja ver ni escribir nada. SET LOCAL solo vive dentro
 * de la transacción, así que no se filtra entre peticiones.
 */
export async function conTenant<T>(
  ctx: Contexto,
  fn: (ej: Ejecutor) => Promise<T>,
): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    // set_config(..., true) => ámbito de transacción (local).
    await client.query('SELECT set_config($1,$2,true), set_config($3,$4,true)', [
      'app.entidad_id',
      ctx.entidadId,
      'app.usuario_id',
      ctx.usuarioId ?? '',
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cerrarPools(): Promise<void> {
  await Promise.allSettled([appPool.end(), ownerPool.end()]);
}
