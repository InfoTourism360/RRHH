import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ownerPool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

/**
 * Runner de migraciones versionadas. Cada fichero .sql se ejecuta una sola vez,
 * en orden lexicográfico, dentro de su propia transacción, como propietario.
 */
export async function migrar(): Promise<string[]> {
  const client = await ownerPool.connect();
  const aplicadas: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    text PRIMARY KEY,
        aplicada_en timestamptz NOT NULL DEFAULT now()
      )`);

    const ficheros = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const fichero of ficheros) {
      const yaAplicada = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [fichero],
      );
      if ((yaAplicada.rowCount ?? 0) > 0) continue;

      const sql = await readFile(join(MIGRATIONS_DIR, fichero), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
          fichero,
        ]);
        await client.query('COMMIT');
        aplicadas.push(fichero);
        console.log(`✔ migración aplicada: ${fichero}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Fallo en migración ${fichero}: ${(err as Error).message}`);
      }
    }
    return aplicadas;
  } finally {
    client.release();
  }
}

// Ejecución directa: `npm run migrate`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate.ts')) {
  migrar()
    .then((a) =>
      console.log(a.length ? `Aplicadas ${a.length} migraciones.` : 'Sin migraciones pendientes.'),
    )
    .then(() => ownerPool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
