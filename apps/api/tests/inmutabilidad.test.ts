import { describe, it, expect } from 'vitest';
import { conTenant, ownerPool } from '../src/db/pool.js';
import * as est from '../src/domain/estructura.js';
import { crearEntidadDemo } from './helpers.js';

describe('Auditoría append-only (inmutabilidad)', () => {
  it('crear una unidad deja un evento de auditoría', async () => {
    const a = await crearEntidadDemo('AUD');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const u = await est.crearUnidad(ctx, { codigo: 'AU', denominacion: 'Aud' });
    const hist = await est.historialAuditoria(ctx, 'unidad_organica', u.id as string);
    expect(hist).toHaveLength(1);
    expect(hist[0]!.accion).toBe('CREAR');
  });

  // Capa 1 (privilegios): el rol de app ni siquiera tiene UPDATE/DELETE sobre
  // auditoria (REVOKE), así que Postgres deniega antes de llegar al trigger.
  it('el rol de aplicación NO puede hacer UPDATE sobre auditoria', async () => {
    const a = await crearEntidadDemo('AUD2');
    const ctx = { entidadId: a.entidadId, usuarioId: null };
    await est.crearUnidad(ctx, { codigo: 'AU2', denominacion: 'Aud2' });
    await expect(
      conTenant(ctx, async (ej) => {
        await ej.query(`UPDATE auditoria SET motivo = 'manipulado' WHERE tabla = 'unidad_organica'`);
      }),
    ).rejects.toThrow(/append-only|permission denied/i);
  });

  it('el rol de aplicación NO puede hacer DELETE sobre auditoria', async () => {
    const a = await crearEntidadDemo('AUD3');
    const ctx = { entidadId: a.entidadId, usuarioId: null };
    await est.crearUnidad(ctx, { codigo: 'AU3', denominacion: 'Aud3' });
    await expect(
      conTenant(ctx, async (ej) => {
        await ej.query(`DELETE FROM auditoria WHERE tabla = 'unidad_organica'`);
      }),
    ).rejects.toThrow(/append-only|permission denied/i);
  });

  // Capa 2 (trigger): backstop incluso para un rol CON privilegios (propietario).
  // Los superusuarios saltan la RLS, pero NO los triggers.
  it('el trigger bloquea UPDATE aunque el rol tenga privilegios', async () => {
    const a = await crearEntidadDemo('AUD_TRG_U');
    await est.crearUnidad({ entidadId: a.entidadId, usuarioId: null }, { codigo: 'T', denominacion: 'T' });
    await expect(
      ownerPool.query(`UPDATE auditoria SET motivo = 'x' WHERE entidad_id = $1`, [a.entidadId]),
    ).rejects.toThrow(/append-only/i);
  });

  it('el trigger bloquea DELETE aunque el rol tenga privilegios', async () => {
    const a = await crearEntidadDemo('AUD_TRG_D');
    await est.crearUnidad({ entidadId: a.entidadId, usuarioId: null }, { codigo: 'T', denominacion: 'T' });
    await expect(
      ownerPool.query(`DELETE FROM auditoria WHERE entidad_id = $1`, [a.entidadId]),
    ).rejects.toThrow(/append-only/i);
  });

  it('el histórico de un cambio conserva datos_antes y datos_despues', async () => {
    const a = await crearEntidadDemo('AUD4');
    const ctx = { entidadId: a.entidadId, usuarioId: null };
    const u = await est.crearUnidad(ctx, { codigo: 'AU4', denominacion: 'Antes' });
    await est.actualizarUnidad(ctx, u.id as string, { denominacion: 'Después' });
    const hist = await est.historialAuditoria(ctx, 'unidad_organica', u.id as string);
    expect(hist).toHaveLength(2);
    const mod = hist.find((h) => h.accion === 'MODIFICAR')!;
    expect(mod.datos_antes.denominacion).toBe('Antes');
    expect(mod.datos_despues.denominacion).toBe('Después');
  });
});
