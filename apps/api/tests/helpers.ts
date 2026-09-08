import { randomUUID } from 'node:crypto';
import { ownerPool } from '../src/db/pool.js';
import { hashearPassword } from '../src/auth/passwords.js';

export interface EntidadDemo {
  entidadId: string;
  cif: string;
  adminEmail: string;
  adminPassword: string;
  adminUsuarioId: string;
}

/** Crea una entidad aislada para un test, con un admin. Usa el pool propietario. */
export async function crearEntidadDemo(prefijo: string): Promise<EntidadDemo> {
  const cif = `T${Math.floor(Math.random() * 1e8)}Z`.slice(0, 9);
  const ent = await ownerPool.query<{ id: string }>(
    'INSERT INTO entidad (cif, nombre) VALUES ($1, $2) RETURNING id',
    [cif, `Entidad ${prefijo}`],
  );
  const entidadId = ent.rows[0]!.id;
  const adminEmail = `admin-${prefijo}-${randomUUID().slice(0, 8)}@test.es`;
  const adminPassword = 'Test1234!';
  const hash = await hashearPassword(adminPassword);
  const u = await ownerPool.query<{ id: string }>(
    'INSERT INTO usuario (entidad_id, email, password_hash) VALUES ($1,$2,$3) RETURNING id',
    [entidadId, adminEmail, hash],
  );
  const adminUsuarioId = u.rows[0]!.id;
  await ownerPool.query(
    `INSERT INTO usuario_rol (entidad_id, usuario_id, rol_codigo) VALUES ($1,$2,'ADMIN_ENTIDAD')`,
    [entidadId, adminUsuarioId],
  );
  return { entidadId, cif, adminEmail, adminPassword, adminUsuarioId };
}
