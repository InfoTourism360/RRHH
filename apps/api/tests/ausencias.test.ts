import { describe, it, expect } from 'vitest';
import * as est from '../src/domain/estructura.js';
import * as aus from '../src/domain/ausencias.js';
import { contarDias } from '../src/domain/calendario.js';
import { totalizar } from '../src/domain/totalizacion.js';
import { crearEntidadDemo } from './helpers.js';

async function setup(prefijo: string) {
  const a = await crearEntidadDemo(prefijo);
  const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
  await aus.precargarCatalogo(ctx);
  const persona = await est.crearPersona(ctx, {
    tipoDocumento: 'DNI', numDocumento: `${Math.floor(Math.random() * 1e7)}Z`.slice(0, 9),
    nombre: 'Emp', apellido1: 'Leado',
  });
  await aus.asignarSaldo(ctx, { personaId: persona.id as string, tipoCodigo: 'VACACIONES', anio: 2025, dias: 22 });
  return { a, ctx, personaId: persona.id as string };
}

describe('Ausencias: motor de reglas y flujo', () => {
  it('contarDias hábiles excluye findes y festivos (unitario)', () => {
    expect(contarDias('2025-03-03', '2025-03-09', 'DIAS_HABILES', new Set())).toBe(5);
    expect(contarDias('2025-03-03', '2025-03-09', 'DIAS_HABILES', new Set(['2025-03-05']))).toBe(4);
    expect(contarDias('2025-03-03', '2025-03-09', 'DIAS_NATURALES', new Set())).toBe(7);
    expect(contarDias('2025-03-03', '2025-03-03', 'HORAS', new Set(), 4)).toBe(4);
  });

  it('solicitar vacaciones computa días hábiles y descuenta saldo al aprobar', async () => {
    const { ctx, personaId } = await setup('AUSV');
    const sol = await aus.solicitar(ctx, {
      personaId, tipoCodigo: 'VACACIONES', fechaInicio: '2025-03-03', fechaFin: '2025-03-07',
    });
    expect(Number(sol.dias_computados)).toBe(5);
    expect(sol.estado).toBe('SOLICITADA');

    let saldo = await aus.saldos(ctx, personaId, 2025);
    const vac = () => saldo.find((s) => s.tipo === 'VACACIONES')!;
    expect(vac().disponible).toBe(22); // aún no aprobada

    await aus.aprobar(ctx, sol.id as string);
    saldo = await aus.saldos(ctx, personaId, 2025);
    expect(vac().consumido).toBe(5);
    expect(vac().disponible).toBe(17);
  });

  it('impide solicitudes solapadas', async () => {
    const { ctx, personaId } = await setup('AUSS');
    await aus.solicitar(ctx, { personaId, tipoCodigo: 'VACACIONES', fechaInicio: '2025-04-07', fechaFin: '2025-04-11' });
    await expect(
      aus.solicitar(ctx, { personaId, tipoCodigo: 'VACACIONES', fechaInicio: '2025-04-09', fechaFin: '2025-04-15' }),
    ).rejects.toMatchObject({ codigo: 'SOLAPAMIENTO' });
  });

  it('rechaza si no hay saldo suficiente', async () => {
    const { ctx, personaId } = await setup('AUSN');
    await aus.asignarSaldo(ctx, { personaId, tipoCodigo: 'VACACIONES', anio: 2025, dias: 2 });
    await expect(
      aus.solicitar(ctx, { personaId, tipoCodigo: 'VACACIONES', fechaInicio: '2025-05-05', fechaFin: '2025-05-09' }),
    ).rejects.toMatchObject({ codigo: 'SIN_SALDO' });
  });

  it('la denegación exige motivo y cambia el estado', async () => {
    const { ctx, personaId } = await setup('AUSD');
    const sol = await aus.solicitar(ctx, { personaId, tipoCodigo: 'VACACIONES', fechaInicio: '2025-06-02', fechaFin: '2025-06-03' });
    const den = await aus.denegar(ctx, sol.id as string, 'Necesidades del servicio');
    expect(den.estado).toBe('DENEGADA');
    expect(den.motivo_resolucion).toBe('Necesidades del servicio');
  });

  it('una ausencia aprobada neutraliza el saldo de jornada de esos días', async () => {
    const { ctx, personaId } = await setup('AUSI');
    const sol = await aus.solicitar(ctx, { personaId, tipoCodigo: 'VACACIONES', fechaInicio: '2025-03-03', fechaFin: '2025-03-04' });
    await aus.aprobar(ctx, sol.id as string);
    const diasAusencia = await aus.diasAusenciaAprobada(ctx, personaId, '2025-03-03', '2025-03-04');
    const t = await totalizar(ctx, personaId, '2025-03-03', '2025-03-04', undefined, diasAusencia);
    expect(t.dias).toHaveLength(2);
    expect(t.dias.every((d) => d.esAusencia && d.saldoMin === 0)).toBe(true);
  });
});
