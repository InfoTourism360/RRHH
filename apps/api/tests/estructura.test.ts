import { describe, it, expect } from 'vitest';
import * as est from '../src/domain/estructura.js';
import { crearEntidadDemo } from './helpers.js';

async function montarPuesto(entidadId: string) {
  const ctx = { entidadId, usuarioId: null };
  const unidad = await est.crearUnidad(ctx, { codigo: 'U', denominacion: 'Unidad' });
  const plaza = await est.crearPlaza(ctx, {
    codigo: 'PL1', denominacion: 'Plaza 1', grupoCodigo: 'A2', escalaCodigo: 'GENERAL',
  });
  const puesto = await est.crearPuesto(ctx, {
    plazaId: plaza.id as string, unidadId: unidad.id as string,
    codigo: 'PT1', denominacion: 'Puesto 1', nivelCd: 22,
  });
  return { ctx, plaza, puesto };
}

describe('Estructura organizativa: vigencias y ocupación', () => {
  it('una plaza sin ocupante figura como vacante', async () => {
    const a = await crearEntidadDemo('EST1');
    await montarPuesto(a.entidadId);
    const plazas = await est.listarPlazas({ entidadId: a.entidadId, usuarioId: null });
    expect(plazas[0]!.vacante).toBe(true);
    expect(Number(plazas[0]!.ocupantes_vigentes)).toBe(0);
  });

  it('al tomar posesión la plaza deja de estar vacante', async () => {
    const a = await crearEntidadDemo('EST2');
    const { ctx, puesto } = await montarPuesto(a.entidadId);
    const persona = await est.crearPersona(ctx, {
      tipoDocumento: 'DNI', numDocumento: '00000001R', nombre: 'Ana', apellido1: 'García',
    });
    await est.crearRelacion(ctx, {
      personaId: persona.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_CARRERA', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: '2020-01-01',
    });
    const plazas = await est.listarPlazas(ctx);
    expect(plazas[0]!.vacante).toBe(false);
  });

  it('impide dos ocupantes efectivos solapados en el mismo puesto', async () => {
    const a = await crearEntidadDemo('EST3');
    const { ctx, puesto } = await montarPuesto(a.entidadId);
    const p1 = await est.crearPersona(ctx, { tipoDocumento: 'DNI', numDocumento: '00000002W', nombre: 'P1', apellido1: 'Uno' });
    const p2 = await est.crearPersona(ctx, { tipoDocumento: 'DNI', numDocumento: '00000003A', nombre: 'P2', apellido1: 'Dos' });
    await est.crearRelacion(ctx, {
      personaId: p1.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_CARRERA', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: '2020-01-01',
    });
    await expect(
      est.crearRelacion(ctx, {
        personaId: p2.id as string, puestoId: puesto.id as string,
        tipoCodigo: 'FUNC_INTERINO', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: '2021-01-01',
      }),
    ).rejects.toMatchObject({ codigo: 'SOLAPE_OCUPACION' });
  });

  it('excedencia con reserva libera el puesto para un interino (versionando la relación)', async () => {
    const a = await crearEntidadDemo('EST4');
    const { ctx, puesto } = await montarPuesto(a.entidadId);
    const titular = await est.crearPersona(ctx, { tipoDocumento: 'DNI', numDocumento: '00000004G', nombre: 'Tit', apellido1: 'Ular' });
    const rel = await est.crearRelacion(ctx, {
      personaId: titular.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_CARRERA', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: '2019-01-01',
    });
    await est.cambiarSituacion(ctx, rel.id as string, {
      situacionCodigo: 'EXCEDENCIA_CUID', desde: '2024-01-01', ocupaEfectivo: false,
      motivo: 'Cuidado de familiar',
    });
    // Ahora un interino puede ocupar efectivamente el puesto.
    const interino = await est.crearPersona(ctx, { tipoDocumento: 'DNI', numDocumento: '00000005M', nombre: 'Int', apellido1: 'Erino' });
    const relInt = await est.crearRelacion(ctx, {
      personaId: interino.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_INTERINO', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: '2024-01-02',
    });
    expect(relInt.id).toBeTruthy();
    // El histórico de la relación del titular tiene dos versiones.
    const rels = await est.listarRelaciones(ctx, { personaId: titular.id as string });
    expect(rels).toHaveLength(2);
  });
});
