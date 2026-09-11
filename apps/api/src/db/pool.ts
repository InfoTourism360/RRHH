import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

// Postgres devuelve NUMERIC/BIGINT como string por defecto; para importes lo
// dejamos así (evita pérdida de precisión). Las fechas DATE las tratamos como
// string 'YYYY-MM-DD' para no arrastrar husos horarios en cómputos de jornada.
pg.types.setTypeParser(1082, (v) => v); // date -> string

// Tiempos de espera: sin ellos, una caída de la base de datos deja las
// peticiones colgadas hasta que corta el proxy (se comprobó: 60 s y un 504 en
// lugar de un fallo inmediato). Con esto, el error llega rápido y legible.
const TIEMPOS = {
  connectionTimeoutMillis: 5_000, // abrir conexión
  idleTimeoutMillis: 30_000,      // devolver conexiones ociosas
  query_timeout: 15_000,          // corte en cliente
  statement_timeout: 15_000,      // corte en servidor
};

// Pool de la APLICACIÓN (rol NOBYPASSRLS). Todo el runtime pasa por aquí.
export const appPool = new Pool({ connectionString: env.DATABASE_URL_APP, max: 10, ...TIEMPOS });

// Pool del PROPIETARIO. Solo migraciones y provisioning (alta de entidad).
export const ownerPool = new Pool({ connectionString: env.DATABASE_URL_OWNER, max: 4, ...TIEMPOS });

// Un error del pool (p. ej. la BD se reinicia) no debe tumbar el proceso.
for (const pool of [appPool, ownerPool]) {
  pool.on('error', (e) => console.error('pool postgres:', e.message));
}

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
