import { migrar } from '../src/db/migrate.js';
import { ownerPool } from '../src/db/pool.js';

// Aplica migraciones una vez antes de toda la suite.
export default async function () {
  await migrar();
  return async () => {
    await ownerPool.end();
  };
}
