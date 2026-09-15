import { describe, it, expect } from 'vitest';
import * as est from '../src/domain/estructura.js';
import { conTenant } from '../src/db/pool.js';
import { totalizar, jornadaDelDia, repartirPorDia } from '../src/domain/totalizacion.js';
import { ficharSchema } from '../src/validation/schemas.js';
import { crearEntidadDemo } from './helpers.js';

// ---------------------------------------------------------------------------
// Turnos que cruzan la medianoche. Los tiene cualquier ayuntamiento con policía
// local o bomberos, y antes se perdían enteros: la ENTRADA de las 22:00 no
// encontraba salida en su día, la SALIDA de las 06:00 no encontraba entrada en
// el suyo, y las ocho horas se iban a cero en ambos.
// ---------------------------------------------------------------------------

let doc = 60000000;
const siguienteDoc = () => `${doc++}N`;

async function personaEn(entidadId: string) {
  return est.crearPersona({ entidadId, usuarioId: null }, {
    tipoDocumento: 'DNI', numDocumento: siguienteDoc(), nombre: 'Turno', apellido1: 'Noche',
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

const ev = (tipo: string, iso: string) => ({ tipo, momento: new Date(iso) }) as never;

describe('Reparto de tramos por día (unitario)', () => {
  it('imputa el turno de noche al día en que empieza', () => {
    const { porDia } = repartirPorDia([
      ev('ENTRADA', '2026-02-10T22:00:00+01:00'),
      ev('SALIDA', '2026-02-11T06:00:00+01:00'),
    ]);
    expect(porDia.get('2026-02-10')?.presencia).toBe(480); // 8 h completas
    expect(porDia.has('2026-02-11')).toBe(false);          // el día 11 no inicia turno
  });

  it('la pausa de madrugada se descuenta del turno que la contiene', () => {
    const { porDia } = repartirPorDia([
      ev('ENTRADA', '2026-02-10T22:00:00+01:00'),
      ev('INICIO_PAUSA', '2026-02-11T02:00:00+01:00'),
      ev('FIN_PAUSA', '2026-02-11T02:30:00+01:00'),
      ev('SALIDA', '2026-02-11T06:00:00+01:00'),
    ]);
    // Si la pausa se imputara al día del reloj, el 11 saldría en negativo.
    expect(porDia.get('2026-02-10')).toEqual({ presencia: 480, pausa: 30 });
    expect(porDia.has('2026-02-11')).toBe(false);
  });

  it('deja el día a la vista cuando se olvidó fichar la salida', () => {
    const { porDia, entradaAbierta } = repartirPorDia([
      ev('ENTRADA', '2026-03-02T08:00:00+01:00'),
    ]);
    expect(porDia.get('2026-03-02')).toEqual({ presencia: 0, pausa: 0 });
    expect(entradaAbierta).not.toBeNull();
  });

  it('no inventa un tramo cuando pasan más de 24 h sin salida', () => {
    const { porDia } = repartirPorDia([
      ev('ENTRADA', '2026-03-02T08:00:00+01:00'),
      ev('SALIDA', '2026-03-05T08:00:00+01:00'),
    ]);
    expect(porDia.get('2026-03-02')?.presencia).toBe(0);
  });
});

describe('Turno de noche, de extremo a extremo', () => {
  it('totaliza las 8 horas en el día de inicio', async () => {
    const a = await crearEntidadDemo('NOC1');
    const p = await personaEn(a.entidadId);
    const id = p.id as string;
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-02-10T22:00:00+01:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-02-11T06:00:00+01:00');

    const t = await totalizar({ entidadId: a.entidadId, usuarioId: null }, id, '2026-02-10', '2026-02-11');
    expect(t.totales.trabajadoMin).toBe(480);
    expect(t.dias).toHaveLength(1);
    expect(t.dias[0]!.fecha).toBe('2026-02-10');
    expect(t.dias[0]!.trabajadoMin).toBe(480);
  });

  it('cierra el turno aunque la salida caiga fuera del rango pedido', async () => {
    // El rango termina el mismo día que empieza el turno: la salida es del día
    // siguiente y la consulta tiene que alcanzarla igualmente.
    const a = await crearEntidadDemo('NOC2');
    const p = await personaEn(a.entidadId);
    const id = p.id as string;
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-02-10T22:00:00+01:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-02-11T06:00:00+01:00');

    const t = await totalizar({ entidadId: a.entidadId, usuarioId: null }, id, '2026-02-10', '2026-02-10');
    expect(t.totales.trabajadoMin).toBe(480);
  });

  it('la jornada en curso de madrugada ve el turno abierto desde la víspera', async () => {
    const a = await crearEntidadDemo('NOC3');
    const p = await personaEn(a.entidadId);
    const id = p.id as string;
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-02-10T22:00:00+01:00');

    const j = await jornadaDelDia({ entidadId: a.entidadId, usuarioId: null }, id, '2026-02-11');
    expect(j.abiertaDesde).not.toBeNull();
    expect(new Date(j.abiertaDesde!).toISOString()).toBe(new Date('2026-02-10T22:00:00+01:00').toISOString());
  });

  // -------------------------------------------------------------------------
  // Cambio de hora. Lo que tiene que constar en el registro de jornada es el
  // tiempo realmente trabajado, no lo que marcaba el reloj de pared: la noche
  // de marzo se trabaja una hora menos y la de octubre una hora más, aunque en
  // ambas se fiche "de 22:00 a 06:00". Que se pague igual o distinto es cosa
  // del convenio, no del registro.
  // -------------------------------------------------------------------------

  it('la noche en que se adelanta el reloj cuenta 7 horas, no 8', async () => {
    const a = await crearEntidadDemo('DST1');
    const p = await personaEn(a.entidadId);
    const id = p.id as string;
    // 29-03-2026: a las 02:00 se pasa a las 03:00 (CET → CEST).
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-03-28T22:00:00+01:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-03-29T06:00:00+02:00');

    const t = await totalizar({ entidadId: a.entidadId, usuarioId: null }, id, '2026-03-28', '2026-03-29');
    expect(t.totales.trabajadoMin).toBe(420);
    expect(t.dias[0]!.fecha).toBe('2026-03-28');
  });

  it('la noche en que se atrasa el reloj cuenta 9 horas, no 8', async () => {
    const a = await crearEntidadDemo('DST2');
    const p = await personaEn(a.entidadId);
    const id = p.id as string;
    // 25-10-2026: a las 03:00 se vuelve a las 02:00 (CEST → CET).
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-10-24T22:00:00+02:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-10-25T06:00:00+01:00');

    const t = await totalizar({ entidadId: a.entidadId, usuarioId: null }, id, '2026-10-24', '2026-10-25');
    expect(t.totales.trabajadoMin).toBe(540);
    expect(t.dias[0]!.fecha).toBe('2026-10-24');
  });

  it('la pausa de la madrugada del cambio también sale en tiempo real', async () => {
    const a = await crearEntidadDemo('DST3');
    const p = await personaEn(a.entidadId);
    const id = p.id as string;
    // La pausa empieza a la 01:45 CET y termina a las 03:15 CEST: media hora
    // real, aunque el reloj de pared diga hora y media.
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-03-28T22:00:00+01:00');
    await insertarEvento(a.entidadId, id, 'INICIO_PAUSA', '2026-03-29T01:45:00+01:00');
    await insertarEvento(a.entidadId, id, 'FIN_PAUSA', '2026-03-29T03:15:00+02:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-03-29T06:00:00+02:00');

    const t = await totalizar({ entidadId: a.entidadId, usuarioId: null }, id, '2026-03-28', '2026-03-29');
    expect(t.dias).toHaveLength(1);
    expect(t.dias[0]!.trabajadoMin).toBe(390); // 420 de presencia − 30 de pausa
  });

  it('el día del cambio de hora tiene jornada teórica normal', async () => {
    // Guarda contra un NaN: la jornada teórica se calcula sobre la medianoche
    // local del día, y ese día dura 23 o 25 horas.
    const a = await crearEntidadDemo('DST4');
    const p = await personaEn(a.entidadId);
    const id = p.id as string;
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2026-03-30T08:00:00+02:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2026-03-30T15:30:00+02:00');

    const t = await totalizar({ entidadId: a.entidadId, usuarioId: null }, id, '2026-03-30', '2026-03-30');
    expect(Number.isFinite(t.dias[0]!.teoricoMin)).toBe(true);
    expect(t.dias[0]!.teoricoMin).toBe(450);
    expect(t.dias[0]!.trabajadoMin).toBe(450);
  });

  it('no admite una hora local sin zona, que en octubre es ambigua', () => {
    const marca = (momentoCliente: string) =>
      ficharSchema.safeParse({ tipo: 'ENTRADA', origen: 'WEB', momentoCliente }).success;

    // El 25-10-2026 las 02:30 ocurren dos veces: sin zona no hay forma de saber
    // a cuál de las dos se refiere, así que no se acepta.
    expect(marca('2026-10-25T02:30:00')).toBe(false);
    // Las dos formas inequívocas sí, y son instantes distintos.
    expect(marca('2026-10-25T02:30:00+02:00')).toBe(true);
    expect(marca('2026-10-25T02:30:00+01:00')).toBe(true);
    expect(marca('2026-10-25T00:30:00Z')).toBe(true);
    expect(new Date('2026-10-25T02:30:00+02:00').getTime())
      .not.toBe(new Date('2026-10-25T02:30:00+01:00').getTime());
  });

  it('la jornada diurna normal no cambia', async () => {
    const a = await crearEntidadDemo('NOC4');
    const p = await personaEn(a.entidadId);
    const id = p.id as string;
    await insertarEvento(a.entidadId, id, 'ENTRADA', '2025-03-03T08:00:00+01:00');
    await insertarEvento(a.entidadId, id, 'INICIO_PAUSA', '2025-03-03T11:00:00+01:00');
    await insertarEvento(a.entidadId, id, 'FIN_PAUSA', '2025-03-03T11:20:00+01:00');
    await insertarEvento(a.entidadId, id, 'SALIDA', '2025-03-03T15:00:00+01:00');

    const t = await totalizar({ entidadId: a.entidadId, usuarioId: null }, id, '2025-03-03', '2025-03-03');
    expect(t.dias).toHaveLength(1);
    expect(t.dias[0]!.trabajadoMin).toBe(400); // 7 h menos 20 min de pausa
  });
});
