import { describe, it, expect } from 'vitest';
import { altaEntidad, FORMA_CIF } from '../src/seed/alta-entidad.js';
import { login } from '../src/auth/service.js';
import { listarTipos } from '../src/domain/ausencias.js';
import * as est from '../src/domain/estructura.js';
import { ownerPool } from '../src/db/pool.js';

// ---------------------------------------------------------------------------
// Alta de una entidad. Antes solo existía el seed de demostración: para un
// cliente real había que escribir SQL a mano contra la base de producción.
// ---------------------------------------------------------------------------

// Base aleatoria por ejecución: la tabla de entidades es compartida y persiste
// entre pasadas, así que un contador fijo haría que el test solo pasara la
// primera vez. Ya ocurrió.
let n = Math.floor(Math.random() * 9_000_000) + 1_000_000;
/** CIF de entidad local con forma válida, distinto en cada llamada. */
const siguienteCif = () => `P${String(n++).padStart(7, '0')}A`;
/** Correo único, por la misma razón. */
const correo = (p: string) => `${p}-${n}-${Math.random().toString(36).slice(2, 8)}@alta.test`;

describe('Forma del CIF', () => {
  it('acepta la de una entidad local', () => {
    expect(FORMA_CIF.test('P4600001A')).toBe(true);
    expect(FORMA_CIF.test('P1234567D')).toBe(true);
  });

  it('rechaza erratas de longitud, de letra y de control', () => {
    expect(FORMA_CIF.test('P460001A')).toBe(false);   // un dígito de menos
    expect(FORMA_CIF.test('P46000012A')).toBe(false); // de más
    expect(FORMA_CIF.test('Z4600001A')).toBe(false);  // letra de tipo inexistente
    expect(FORMA_CIF.test('P4600001Z')).toBe(false);  // control fuera de rango
    expect(FORMA_CIF.test('46000012')).toBe(false);   // sin letra
    expect(FORMA_CIF.test('')).toBe(false);
  });
});

describe('Alta de entidad', () => {
  it('deja la entidad lista para trabajar y su administrador puede entrar', async () => {
    const cif = siguienteCif();
    const admin = correo('secretaria');
    const r = await altaEntidad({ cif, nombre: 'Ayuntamiento de Alta', admin });

    expect(r.entidadId).toBeTruthy();
    // Arranca con el catálogo de ausencias del TREBEP, no con una pantalla vacía.
    expect(r.tiposPrecargados).toBeGreaterThan(0);

    const { sesion } = await login({ cif, email: admin, password: r.password });
    expect(sesion.entidadId).toBe(r.entidadId);
    expect(sesion.roles.map((x) => x.rol)).toEqual(['ADMIN_ENTIDAD']);

    const ctx = { entidadId: r.entidadId, usuarioId: r.usuarioId };
    expect((await listarTipos(ctx)).length).toBe(r.tiposPrecargados);
    // Y sin plantilla: la carga es el siguiente paso, no algo inventado.
    expect(await est.listarPersonas(ctx)).toHaveLength(0);
  });

  it('la contraseña inicial cumple la política y no se repite', async () => {
    const a = await altaEntidad({ cif: siguienteCif(), nombre: 'A', admin: correo('a') });
    const b = await altaEntidad({ cif: siguienteCif(), nombre: 'B', admin: correo('b') });
    expect(a.password.length).toBeGreaterThanOrEqual(12);
    expect(a.password).not.toBe(b.password);
  });

  it('no crea nada si el CIF ya existe', async () => {
    const cif = siguienteCif();
    await altaEntidad({ cif, nombre: 'Primera', admin: correo('p') });
    await expect(altaEntidad({ cif, nombre: 'Segunda', admin: correo('s') }))
      .rejects.toThrow(/ya existe/i);

    const r = await ownerPool.query('SELECT count(*)::int AS n FROM entidad WHERE cif = $1', [cif]);
    expect(r.rows[0]!.n).toBe(1);
  });

  it('rechaza el CIF mal formado antes de tocar la base', async () => {
    const antes = await ownerPool.query<{ n: number }>('SELECT count(*)::int AS n FROM entidad');
    await expect(altaEntidad({ cif: 'NOESUNCIF', nombre: 'X', admin: 'x@alta.test' }))
      .rejects.toThrow(/forma esperada/i);
    const despues = await ownerPool.query<{ n: number }>('SELECT count(*)::int AS n FROM entidad');
    expect(despues.rows[0]!.n).toBe(antes.rows[0]!.n);
  });

  it('rechaza un correo que no lo es', async () => {
    await expect(altaEntidad({ cif: siguienteCif(), nombre: 'X', admin: 'sin-arroba' }))
      .rejects.toThrow(/correo/i);
  });

  it('la entidad nueva no alcanza los datos de otra', async () => {
    const a = await altaEntidad({ cif: siguienteCif(), nombre: 'A', admin: correo('ia') });
    const b = await altaEntidad({ cif: siguienteCif(), nombre: 'B', admin: correo('ib') });

    const ctxA = { entidadId: a.entidadId, usuarioId: a.usuarioId };
    await est.crearPersona(ctxA, {
      tipoDocumento: 'DNI', numDocumento: `${n++}Q`, nombre: 'Solo', apellido1: 'DeA',
    });

    const ctxB = { entidadId: b.entidadId, usuarioId: b.usuarioId };
    expect(await est.listarPersonas(ctxB)).toHaveLength(0);
    expect(await est.listarPersonas(ctxA)).toHaveLength(1);
  });

  it('el alta queda registrada en el log de actividad', async () => {
    const cif = siguienteCif();
    const r = await altaEntidad({ cif, nombre: 'Trazada', admin: correo('t') });
    const traza = await ownerPool.query(
      `SELECT accion FROM registro_actividad WHERE entidad_id = $1 AND accion = 'ALTA_ENTIDAD'`,
      [r.entidadId],
    );
    expect(traza.rowCount).toBe(1);
  });
});
