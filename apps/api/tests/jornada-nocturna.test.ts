import { describe, it, expect } from 'vitest';
import * as est from '../src/domain/estructura.js';
import { conTenant } from '../src/db/pool.js';
import { totalizar, jornadaDelDia, repartirPorDia } from '../src/domain/totalizacion.js';
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
