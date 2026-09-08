import { describe, it, expect } from 'vitest';
import { ownerPool } from '../src/db/pool.js';
import { registrarActividad, listarActividad } from '../src/domain/registroActividad.js';
import { crearEntidadDemo } from './helpers.js';

describe('Registro de actividad (ENS)', () => {
  it('registra y aísla por entidad; es append-only', async () => {
    const a = await crearEntidadDemo('ACT_A');
    const b = await crearEntidadDemo('ACT_B');
    await registrarActividad({ entidadId: a.entidadId, usuarioId: a.adminUsuarioId, accion: 'LOGIN_OK', metodo: 'POST', ruta: '/auth/login', estadoHttp: 200 });
    await registrarActividad({ entidadId: b.entidadId, usuarioId: b.adminUsuarioId, accion: 'CAMBIO', metodo: 'POST', ruta: '/estructura/plazas', estadoHttp: 201 });

    const deA = await listarActividad({ entidadId: a.entidadId, usuarioId: a.adminUsuarioId }, '2000-01-01', '2100-01-01');
    const deB = await listarActividad({ entidadId: b.entidadId, usuarioId: b.adminUsuarioId }, '2000-01-01', '2100-01-01');
    expect(deA.every((r) => r.accion === 'LOGIN_OK')).toBe(true);
    expect(deB.every((r) => r.accion === 'CAMBIO')).toBe(true);
    expect(deA.length).toBeGreaterThanOrEqual(1);

    // Inmutable: ni el propietario puede modificar (trigger).
    await expect(
      ownerPool.query(`UPDATE registro_actividad SET accion = 'X' WHERE entidad_id = $1`, [a.entidadId]),
    ).rejects.toThrow(/append-only/i);
  });
});
