import { describe, it, expect } from 'vitest';
import { appPool, conTenant } from '../src/db/pool.js';
import * as est from '../src/domain/estructura.js';
import { crearEntidadDemo } from './helpers.js';

// El corazón del requisito multi-tenant: NINGUNA consulta cruza entidades.
describe('Aislamiento multi-tenant (RLS)', () => {
  it('una entidad no ve los datos de otra', async () => {
    const a = await crearEntidadDemo('A');
    const b = await crearEntidadDemo('B');
    const ctxA = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const ctxB = { entidadId: b.entidadId, usuarioId: b.adminUsuarioId };

    await est.crearUnidad(ctxA, { codigo: 'U1', denominacion: 'Unidad de A' });
    await est.crearUnidad(ctxB, { codigo: 'U1', denominacion: 'Unidad de B' });

    const vistasPorA = await est.listarUnidades(ctxA);
    const vistasPorB = await est.listarUnidades(ctxB);

    expect(vistasPorA).toHaveLength(1);
    expect(vistasPorB).toHaveLength(1);
    expect(vistasPorA[0]!.denominacion).toBe('Unidad de A');
    expect(vistasPorB[0]!.denominacion).toBe('Unidad de B');
  });

  it('sin contexto de tenant no se ve NADA (RLS por defecto deniega)', async () => {
    const a = await crearEntidadDemo('C');
    await est.crearUnidad({ entidadId: a.entidadId, usuarioId: null }, { codigo: 'X', denominacion: 'X' });

    // Consulta con el pool de app SIN fijar app.entidad_id.
    const client = await appPool.connect();
    try {
      const r = await client.query('SELECT * FROM unidad_organica');
      expect(r.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it('no se puede insertar una fila con entidad_id de OTRA entidad', async () => {
    const a = await crearEntidadDemo('D');
    const b = await crearEntidadDemo('E');
    // En el contexto de A, intentamos forzar entidad_id = B.
    await expect(
      conTenant({ entidadId: a.entidadId, usuarioId: null }, async (ej) => {
        await ej.query(
          `INSERT INTO unidad_organica (entidad_id, codigo, denominacion) VALUES ($1,'H','Hack')`,
          [b.entidadId],
        );
      }),
    ).rejects.toThrow(); // WITH CHECK de la policy lo rechaza.
  });

  it('leer por id un registro de otra entidad devuelve vacío', async () => {
    const a = await crearEntidadDemo('F');
    const b = await crearEntidadDemo('G');
    const uB = await est.crearUnidad({ entidadId: b.entidadId, usuarioId: null }, { codigo: 'Z', denominacion: 'De B' });

    const encontrado = await conTenant({ entidadId: a.entidadId, usuarioId: null }, async (ej) => {
      const r = await ej.query('SELECT * FROM unidad_organica WHERE id = $1', [uB.id]);
      return r.rows;
    });
    expect(encontrado).toHaveLength(0);
  });
});
