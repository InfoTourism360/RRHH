import { describe, it, expect } from 'vitest';
import * as est from '../src/domain/estructura.js';
import {
  listarJornadas, crearJornada, actualizarJornada, asignarJornada, normalizarMinutosPorDia,
} from '../src/domain/jornada.js';
import { totalizar } from '../src/domain/totalizacion.js';
import { conTenant } from '../src/db/pool.js';
import { crearEntidadDemo } from './helpers.js';

// ---------------------------------------------------------------------------
// Jornada teórica por colectivo. Antes había una sola para toda la entidad, así
// que el saldo solo significaba algo para quien trabaja de lunes a viernes en
// horario de oficina: a un agente de policía el fin de semana le contaba todo
// como festivo y el día que libraba como déficit de una jornada entera.
// ---------------------------------------------------------------------------

let doc = 70000000;
const siguienteDoc = () => `${doc++}J`;

/** 37,5 h repartidas en los siete días: el reparto medio de quien va a turnos. */
const TURNOS = { 0: 321, 1: 321, 2: 321, 3: 321, 4: 321, 5: 321, 6: 321 };

async function personaEn(entidadId: string) {
  return est.crearPersona({ entidadId, usuarioId: null }, {
    tipoDocumento: 'DNI', numDocumento: siguienteDoc(), nombre: 'Agente', apellido1: 'Turno',
  });
}

async function insertarEvento(entidadId: string, personaId: string, tipo: string, iso: string) {
  return conTenant({ entidadId, usuarioId: null }, async (ej) => {
    await ej.query(
      `INSERT INTO fichaje_evento (entidad_id, persona_id, tipo, origen, momento_servidor)
       VALUES (app_entidad_id(), $1, $2, 'QUIOSCO', $3)`,
      [personaId, tipo, iso],
    );
  });
}

describe('Jornadas tipo', () => {
  it('se crean, se listan y se pueden desactivar', async () => {
    const a = await crearEntidadDemo('JT1');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };

    const j = await crearJornada(ctx, {
      codigo: 'TURNOS', denominacion: 'Turnos rotatorios', minutosPorDia: TURNOS,
    });
    expect(j.codigo).toBe('TURNOS');

    const lista = await listarJornadas(ctx);
    expect(lista.map((x) => x.codigo)).toContain('TURNOS');

    await actualizarJornada(ctx, j.id as string, { activo: false });
    expect((await listarJornadas(ctx)).find((x) => x.id === j.id)?.activo).toBe(false);
  });

  it('no admite dos jornadas con el mismo código en la entidad', async () => {
    const a = await crearEntidadDemo('JT2');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    await crearJornada(ctx, { codigo: 'OFICINA', denominacion: 'Oficina', minutosPorDia: TURNOS });
    await expect(crearJornada(ctx, { codigo: 'OFICINA', denominacion: 'Otra', minutosPorDia: TURNOS }))
      .rejects.toMatchObject({ codigo: 'CODIGO_DUPLICADO' });
  });

  it('rechaza repartos imposibles', () => {
    expect(() => normalizarMinutosPorDia({ ...TURNOS, 3: 2000 })).toThrow(/no válidos/i);
    expect(() => normalizarMinutosPorDia({ ...TURNOS, 3: -1 })).toThrow(/no válidos/i);
    // Los días que falten se cuentan como cero, no como error.
    expect(normalizarMinutosPorDia({ 1: 450 })).toEqual({ 0: 0, 1: 450, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  });

  it('una jornada de otra entidad no es visible ni asignable', async () => {
    const a = await crearEntidadDemo('JT3');
    const b = await crearEntidadDemo('JT4');
    const ctxA = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const ctxB = { entidadId: b.entidadId, usuarioId: b.adminUsuarioId };

    const deB = await crearJornada(ctxB, { codigo: 'SOLO_B', denominacion: 'B', minutosPorDia: TURNOS });
    expect((await listarJornadas(ctxA)).map((x) => x.id)).not.toContain(deB.id);

    const pA = await personaEn(a.entidadId);
    // La RLS impide referenciar una fila de otra entidad.
    await expect(asignarJornada(ctxA, pA.id as string, deB.id as string))
      .rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });
});

describe('El saldo con jornada propia', () => {
  it('sin jornada asignada, el policía de fin de semana sale con saldo absurdo', async () => {
    // Retrato del problema: es el comportamiento heredado, con la jornada de
    // oficina aplicada a quien no la tiene.
    const a = await crearEntidadDemo('JT5');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const p = await personaEn(a.entidadId);
    const id = p.id as string;

    // Dos turnos de 8 h: sábado y domingo. Libra el lunes.
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-04-04T08:00:00+02:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-04-04T16:00:00+02:00');
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-04-05T08:00:00+02:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-04-05T16:00:00+02:00');

    const t = await totalizar(ctx, id, '2026-04-04', '2026-04-05');
    // Con la jornada de oficina, sábado y domingo tienen teórico 0: las 16 h
    // se cuentan enteras como exceso.
    expect(t.totales.teoricoMin).toBe(0);
    expect(t.totales.saldoMin).toBe(960);
  });

  it('con jornada de turnos, el saldo del mismo trabajo es razonable', async () => {
    const a = await crearEntidadDemo('JT6');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const p = await personaEn(a.entidadId);
    const id = p.id as string;

    const j = await crearJornada(ctx, {
      codigo: 'TURNOS', denominacion: 'Turnos rotatorios', minutosPorDia: TURNOS,
    });
    await asignarJornada(ctx, id, j.id as string);

    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-04-04T08:00:00+02:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-04-04T16:00:00+02:00');
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-04-05T08:00:00+02:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-04-05T16:00:00+02:00');

    const t = await totalizar(ctx, id, '2026-04-04', '2026-04-05');
    expect(t.totales.trabajadoMin).toBe(960);
    // Ahora sábado y domingo sí tienen jornada presupuesta: 321 min cada uno.
    expect(t.totales.teoricoMin).toBe(642);
    expect(t.totales.saldoMin).toBe(318);
    // Y dejan de tratarse como festivos, que era lo que inflaba las horas.
    expect(t.dias.every((d) => !d.esFestivo)).toBe(true);
  });

  it('retirar la asignación devuelve a la jornada de la entidad', async () => {
    const a = await crearEntidadDemo('JT7');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const p = await personaEn(a.entidadId);
    const id = p.id as string;
    const j = await crearJornada(ctx, { codigo: 'T', denominacion: 'T', minutosPorDia: TURNOS });

    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-04-04T08:00:00+02:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-04-04T16:00:00+02:00');

    await asignarJornada(ctx, id, j.id as string);
    expect((await totalizar(ctx, id, '2026-04-04', '2026-04-04')).totales.teoricoMin).toBe(321);

    await asignarJornada(ctx, id, null);
    expect((await totalizar(ctx, id, '2026-04-04', '2026-04-04')).totales.teoricoMin).toBe(0);
  });

  it('una jornada desactivada deja de aplicarse', async () => {
    const a = await crearEntidadDemo('JT8');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const p = await personaEn(a.entidadId);
    const id = p.id as string;
    const j = await crearJornada(ctx, { codigo: 'T', denominacion: 'T', minutosPorDia: TURNOS });
    await asignarJornada(ctx, id, j.id as string);

    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-04-06T08:00:00+02:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-04-06T16:00:00+02:00');
    expect((await totalizar(ctx, id, '2026-04-06', '2026-04-06')).totales.teoricoMin).toBe(321);

    await actualizarJornada(ctx, j.id as string, { activo: false });
    // Vuelve a la de la entidad: el lunes son 450.
    expect((await totalizar(ctx, id, '2026-04-06', '2026-04-06')).totales.teoricoMin).toBe(450);
  });
});
