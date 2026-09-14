import { describe, it, expect } from 'vitest';
import * as est from '../src/domain/estructura.js';
import { consultarRPT, resumirRPT } from '../src/domain/rpt.js';
import { rptCSV } from '../src/domain/export/rpt.js';
import { crearEntidadDemo } from './helpers.js';

async function montarPuesto(entidadId: string, sufijo: string, complementoEsp?: number) {
  const ctx = { entidadId, usuarioId: null };
  const unidad = await est.crearUnidad(ctx, { codigo: `U${sufijo}`, denominacion: 'Unidad' });
  const plaza = await est.crearPlaza(ctx, {
    codigo: `PL${sufijo}`, denominacion: 'Plaza', grupoCodigo: 'A2', escalaCodigo: 'GENERAL',
  });
  const puesto = await est.crearPuesto(ctx, {
    plazaId: plaza.id as string, unidadId: unidad.id as string,
    codigo: `PT${sufijo}`, denominacion: 'Puesto', nivelCd: 22,
    complementoEsp: complementoEsp ?? null, formaProvision: 'CONCURSO',
  });
  return { ctx, puesto };
}

const META = { entidadNombre: 'Demo', entidadCif: 'X', generadoEn: new Date('2026-01-01') };

describe('RPT: estado de cobertura de los puestos', () => {
  it('un puesto sin ocupante ni reserva es VACANTE', async () => {
    const a = await crearEntidadDemo('RPT1');
    const { ctx } = await montarPuesto(a.entidadId, '1');
    const filas = await consultarRPT(ctx);
    expect(filas).toHaveLength(1);
    expect(filas[0]!.estado).toBe('VACANTE');
    expect(resumirRPT(filas).vacantes).toBe(1);
  });

  it('un puesto con ocupante efectivo es OCUPADO y lo nombra', async () => {
    const a = await crearEntidadDemo('RPT2');
    const { ctx, puesto } = await montarPuesto(a.entidadId, '2');
    const p = await est.crearPersona(ctx, {
      tipoDocumento: 'DNI', numDocumento: '00000001R', nombre: 'Ana', apellido1: 'García', apellido2: 'Ruiz',
    });
    await est.crearRelacion(ctx, {
      personaId: p.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_CARRERA', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: '2020-01-01',
    });
    const filas = await consultarRPT(ctx);
    expect(filas[0]!.estado).toBe('OCUPADO');
    expect(filas[0]!.ocupante).toBe('Ana García Ruiz');
  });

  /**
   * El caso que justifica todo esto: el titular se va con reserva del puesto y
   * nadie lo cubre. No hay ocupante efectivo, pero ofertarlo sería ilegal.
   */
  it('titular con reserva y sin sustituto es RESERVADO, no VACANTE', async () => {
    const a = await crearEntidadDemo('RPT3');
    const { ctx, puesto } = await montarPuesto(a.entidadId, '3');
    const tit = await est.crearPersona(ctx, {
      tipoDocumento: 'DNI', numDocumento: '00000002W', nombre: 'Tit', apellido1: 'Ular',
    });
    const rel = await est.crearRelacion(ctx, {
      personaId: tit.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_CARRERA', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: '2019-01-01',
    });
    await est.cambiarSituacion(ctx, rel.id as string, {
      situacionCodigo: 'EXCEDENCIA_CUID', desde: '2024-01-01', ocupaEfectivo: false,
      motivo: 'Cuidado de familiar',
    });

    const filas = await consultarRPT(ctx);
    expect(filas[0]!.estado).toBe('RESERVADO');
    expect(filas[0]!.reserva_de).toBe('Tit Ular');

    const r = resumirRPT(filas);
    expect(r.reservados).toBe(1);
    expect(r.vacantes).toBe(0); // no es ofertable

    // Y el filtro de vacantes tampoco debe devolverlo.
    expect(await consultarRPT(ctx, { soloVacantes: true })).toHaveLength(0);
  });

  it('titular con reserva cubierto por interino es OCUPADO_CON_RESERVA', async () => {
    const a = await crearEntidadDemo('RPT4');
    const { ctx, puesto } = await montarPuesto(a.entidadId, '4');
    const tit = await est.crearPersona(ctx, {
      tipoDocumento: 'DNI', numDocumento: '00000003A', nombre: 'Tit', apellido1: 'Ular',
    });
    const rel = await est.crearRelacion(ctx, {
      personaId: tit.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_CARRERA', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: '2019-01-01',
    });
    await est.cambiarSituacion(ctx, rel.id as string, {
      situacionCodigo: 'EXCEDENCIA_CUID', desde: '2024-01-01', ocupaEfectivo: false, motivo: 'x',
    });
    const inter = await est.crearPersona(ctx, {
      tipoDocumento: 'DNI', numDocumento: '00000004G', nombre: 'Int', apellido1: 'Erino',
    });
    await est.crearRelacion(ctx, {
      personaId: inter.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_INTERINO', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: '2024-01-02',
    });

    const filas = await consultarRPT(ctx);
    expect(filas[0]!.estado).toBe('OCUPADO_CON_RESERVA');
    expect(filas[0]!.ocupante).toBe('Int Erino');
    expect(filas[0]!.reserva_de).toBe('Tit Ular');
    expect(resumirRPT(filas).vacantes).toBe(0);
  });

  it('excedencia voluntaria (sin reserva) sí deja el puesto VACANTE', async () => {
    const a = await crearEntidadDemo('RPT5');
    const { ctx, puesto } = await montarPuesto(a.entidadId, '5');
    const p = await est.crearPersona(ctx, {
      tipoDocumento: 'DNI', numDocumento: '00000005M', nombre: 'Vol', apellido1: 'Untaria',
    });
    const rel = await est.crearRelacion(ctx, {
      personaId: p.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_CARRERA', situacionCodigo: 'SERV_ACTIVO', tomaPosesion: '2019-01-01',
    });
    // EXCEDENCIA_VOL tiene reserva_puesto = false en el catálogo.
    await est.cambiarSituacion(ctx, rel.id as string, {
      situacionCodigo: 'EXCEDENCIA_VOL', desde: '2024-01-01', ocupaEfectivo: false, motivo: 'x',
    });
    const filas = await consultarRPT(ctx);
    expect(filas[0]!.estado).toBe('VACANTE');
    expect(filas[0]!.reserva_de).toBeNull();
  });
});

describe('RPT: exportación CSV', () => {
  it('deja el específico vacío si no está consignado y lo avisa', async () => {
    const a = await crearEntidadDemo('RPT6');
    const { ctx } = await montarPuesto(a.entidadId, '6'); // sin complementoEsp
    const filas = await consultarRPT(ctx);
    const resumen = resumirRPT(filas);
    expect(resumen.sinComplemento).toBe(1);

    const csv = rptCSV(filas, resumen, META);
    expect(csv).toContain('# AVISO: 1 puesto(s) sin complemento específico');
    // La columna sale vacía, nunca como 0,00.
    expect(csv).not.toContain('0,00');
  });

  it('escribe los importes con coma decimal y escapa los separadores', async () => {
    const a = await crearEntidadDemo('RPT7');
    const ctx = { entidadId: a.entidadId, usuarioId: null };
    const unidad = await est.crearUnidad(ctx, { codigo: 'U7', denominacion: 'Obras; y Servicios' });
    const plaza = await est.crearPlaza(ctx, {
      codigo: 'PL7', denominacion: 'Plaza', grupoCodigo: 'C1', escalaCodigo: 'GENERAL',
    });
    await est.crearPuesto(ctx, {
      plazaId: plaza.id as string, unidadId: unidad.id as string,
      codigo: 'PT7', denominacion: 'Puesto', nivelCd: 16, complementoEsp: 8412.5,
    });
    const filas = await consultarRPT(ctx);
    const csv = rptCSV(filas, resumirRPT(filas), META);
    expect(csv).toContain('8412,50');
    // La unidad lleva `;`: debe ir entrecomillada para no romper columnas.
    expect(csv).toContain('"Obras; y Servicios"');
  });
});
