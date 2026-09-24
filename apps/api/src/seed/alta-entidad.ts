import { randomBytes } from 'node:crypto';
import { ownerPool, cerrarPools } from '../db/pool.js';
import { hashearPassword } from '../auth/passwords.js';
import { precargarCatalogo } from '../domain/ausencias.js';
import { registrarActividad } from '../domain/registroActividad.js';
import { passwordSchema } from '../validation/schemas.js';

// -----------------------------------------------------------------------------
// Alta de una entidad nueva.
//
// Hasta ahora la única forma de dar de alta un ayuntamiento era el seed de
// demostración: para un cliente real había que escribir SQL a mano contra la
// base de producción. Esto lo convierte en una operación repetible, validada y
// trazada.
//
// Es un script del OPERADOR, no una ruta de la aplicación, y es deliberado.
// Crear una entidad está por encima de cualquier entidad, así que exponerlo por
// HTTP obligaría a inventar un usuario que cruza los límites del tenant: una
// superficie de ataque permanente en un producto cuyo argumento es justamente
// que ninguna entidad alcanza a otra. Quien opera el despliegue ya tiene acceso
// a la base; no hace falta darle además una puerta en la API.
//
// Uso:
//   npm run alta-entidad -- --cif P1234567D --nombre "Ayuntamiento de Ejemplo" \
//                           --admin secretaria@ayuntamiento.es
// -----------------------------------------------------------------------------

export interface Opciones {
  cif: string;
  nombre: string;
  admin: string;
}

function leerArgumentos(argv: string[]): Opciones {
  const v: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) v[a.slice(2)] = argv[++i] ?? '';
  }
  const faltan = ['cif', 'nombre', 'admin'].filter((k) => !v[k]?.trim());
  if (faltan.length) {
    throw new Error(
      `Faltan argumentos: ${faltan.join(', ')}.\n` +
      'Uso: npm run alta-entidad -- --cif P1234567D --nombre "Ayuntamiento de X" --admin correo@dominio.es',
    );
  }
  return { cif: v.cif!.trim().toUpperCase(), nombre: v.nombre!.trim(), admin: v.admin!.trim().toLowerCase() };
}

/**
 * Forma del CIF: letra de tipo + 7 dígitos + carácter de control.
 * Las entidades locales usan la letra P.
 *
 * Se comprueba la FORMA, no el dígito de control. El control es calculable,
 * pero un error mío rechazando un CIF válido dejaría a un cliente real sin
 * poder darse de alta, y ese fallo es peor que aceptar una errata: el CIF se
 * teclea una vez, delante de quien lo conoce, y es el identificador de acceso.
 */
export const FORMA_CIF = /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/;

/** Contraseña inicial fuerte. No se pide por argumento: acabaría en el historial. */
function passwordInicial(): string {
  // 24 caracteres en base64url: muy por encima de la política de 12.
  return randomBytes(18).toString('base64url');
}

export interface ResultadoAlta {
  entidadId: string;
  usuarioId: string;
  password: string;
  tiposPrecargados: number;
}

/** El alta en sí, sin consola: es lo que se puede probar. */
export async function altaEntidad(o: Opciones): Promise<ResultadoAlta> {

  if (!FORMA_CIF.test(o.cif)) {
    throw new Error(
      `El CIF «${o.cif}» no tiene la forma esperada (letra + 7 dígitos + control), ` +
      'p. ej. P4600001A para una entidad local.',
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.admin)) {
    throw new Error(`«${o.admin}» no parece un correo electrónico.`);
  }

  const ya = await ownerPool.query('SELECT id, nombre FROM entidad WHERE cif = $1', [o.cif]);
  if ((ya.rowCount ?? 0) > 0) {
    throw new Error(`Ya existe una entidad con el CIF ${o.cif}: «${ya.rows[0]!.nombre}».`);
  }

  const password = passwordInicial();
  // Se valida contra la misma política que exige la API, no contra otra aparte.
  passwordSchema.parse(password);

  const ent = await ownerPool.query<{ id: string }>(
    'INSERT INTO entidad (cif, nombre) VALUES ($1, $2) RETURNING id',
    [o.cif, o.nombre],
  );
  const entidadId = ent.rows[0]!.id;

  const u = await ownerPool.query<{ id: string }>(
    `INSERT INTO usuario (entidad_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
    [entidadId, o.admin, await hashearPassword(password)],
  );
  const usuarioId = u.rows[0]!.id;

  await ownerPool.query(
    `INSERT INTO usuario_rol (entidad_id, usuario_id, rol_codigo)
     VALUES ($1, $2, 'ADMIN_ENTIDAD')`,
    [entidadId, usuarioId],
  );

  // Catálogo de ausencias del TREBEP, para que la entidad arranque con algo
  // usable y no con una pantalla vacía. Es editable desde Configuración.
  const tipos = await precargarCatalogo({ entidadId, usuarioId: null });

  // El alta queda en el registro de actividad, como cualquier otro cambio.
  await registrarActividad({
    entidadId,
    usuarioId: null,
    accion: 'ALTA_ENTIDAD',
    metodo: 'CLI',
    ruta: 'alta-entidad',
    estadoHttp: null,
    detalle: { cif: o.cif, nombre: o.nombre, admin: o.admin },
  });

  return {
    entidadId,
    usuarioId,
    password,
    tiposPrecargados: Array.isArray(tipos) ? tipos.length : Number(tipos),
  };
}

async function main() {
  const o = leerArgumentos(process.argv.slice(2));
  const r = await altaEntidad(o);

  console.log('\nEntidad dada de alta.\n');
  console.log(`  Entidad      : ${o.nombre}`);
  console.log(`  CIF          : ${o.cif}`);
  console.log(`  Tipos de ausencia precargados: ${r.tiposPrecargados}`);
  console.log('\n  Credenciales del administrador (se muestran UNA sola vez):\n');
  console.log(`    CIF de entidad : ${o.cif}`);
  console.log(`    Correo         : ${o.admin}`);
  console.log(`    Contraseña     : ${r.password}`);
  console.log('\n  Entrégalas por un canal seguro y pide que se cambien en el primer acceso.');
  console.log('  Siguiente paso: unidades, plazas y puestos desde Plantilla.\n');
}

// Solo cuando se invoca como script. Sin esta guarda, importar `altaEntidad`
// desde un test ejecutaría el alta y cerraría los pools de toda la batería.
const invocadoDirectamente = process.argv[1]?.replace(/\\/g, '/').endsWith('alta-entidad.ts');

if (invocadoDirectamente) {
  main()
    .catch((e) => {
      console.error(`\nNo se ha dado de alta nada: ${(e as Error).message}\n`);
      process.exitCode = 1;
    })
    .finally(() => cerrarPools());
}
