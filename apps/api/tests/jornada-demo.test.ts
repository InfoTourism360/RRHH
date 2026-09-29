import { describe, it, expect } from 'vitest';
import { generarEventos } from '../src/seed/jornada-demo.js';
import { repartirPorDia } from '../src/domain/totalizacion.js';

// ---------------------------------------------------------------------------
// El historial de la demostración se enseña delante de gente: si sale un turno
// de 30 horas o alguien fichando en domingo cuando no le toca, la credibilidad
// del producto se va con ello.
// ---------------------------------------------------------------------------

const OFICINA = [{ personaId: '11111111-1111-4111-8111-111111111111', turnos: false }];
const TURNOS = [{ personaId: '22222222-2222-4222-8222-222222222222', turnos: true }];
const HASTA = new Date('2026-06-15T23:59:00+02:00'); // lunes, para fijar el cálculo

const ev = (e: { tipo: string; momento: Date }) => ({ tipo: e.tipo, momento: e.momento }) as never;

describe('Historial de jornada de la demostración', () => {
  it('el personal de oficina no ficha en fin de semana', () => {
    const eventos = generarEventos(OFICINA, 30, HASTA);
    const finde = eventos.filter((e) => [0, 6].includes(e.momento.getDay()));
    expect(finde).toHaveLength(0);
    expect(eventos.length).toBeGreaterThan(0);
  });

  it('los de turnos sí trabajan fines de semana y de noche', () => {
    const eventos = generarEventos(TURNOS, 30, HASTA);
    expect(eventos.some((e) => [0, 6].includes(e.momento.getDay()))).toBe(true);
    expect(eventos.some((e) => e.tipo === 'ENTRADA' && e.momento.getHours() === 22)).toBe(true);
  });

  it('nunca ficha nadie en el futuro', () => {
    for (const p of [OFICINA, TURNOS]) {
      for (const e of generarEventos(p, 30, HASTA)) {
        expect(e.momento.getTime()).toBeLessThanOrEqual(HASTA.getTime());
      }
    }
  });

  it('los tramos son creíbles: ninguna jornada por encima de 12 horas', () => {
    for (const p of [OFICINA, TURNOS]) {
      const { porDia } = repartirPorDia(generarEventos(p, 60, HASTA).map(ev));
      for (const [dia, a] of porDia) {
        expect(a.presencia, `día ${dia}`).toBeLessThanOrEqual(12 * 60);
        // Solo se compara con la presencia en los días cerrados: el día del
        // olvido queda la pausa sin turno que la contenga, que es justo lo que
        // pasa cuando alguien se va sin fichar. La app lo resuelve a cero.
        if (a.presencia > 0) expect(a.pausa, `día ${dia}`).toBeLessThanOrEqual(a.presencia);
      }
    }
  });

  it('deja algún olvido de salida, que es lo que da material a las correcciones', () => {
    const eventos = generarEventos(OFICINA, 60, HASTA);
    const { porDia } = repartirPorDia(eventos.map(ev));
    // Un día con entrada registrada pero sin tramo cerrado.
    expect([...porDia.values()].some((a) => a.presencia === 0)).toBe(true);
  });

  it('es reproducible: dos siembras dan exactamente lo mismo', () => {
    const a = generarEventos([...OFICINA, ...TURNOS], 45, HASTA);
    const b = generarEventos([...OFICINA, ...TURNOS], 45, HASTA);
    expect(a.map((x) => `${x.personaId}${x.tipo}${x.momento.toISOString()}`))
      .toEqual(b.map((x) => `${x.personaId}${x.tipo}${x.momento.toISOString()}`));
  });

  it('el saldo no se dispara: lo trabajado casa con la jornada teórica', () => {
    // Es lo que hace que la demostración parezca un producto y no una maqueta.
    // Si cada día sumara o restara veinte minutos, en tres meses la plantilla
    // entera saldría con decenas de horas de desfase y lo primero que pensaría
    // quien lo mira es que el cómputo está roto.
    const casos: [typeof OFICINA, number][] = [[OFICINA, 450], [TURNOS, 450]];
    for (const [personas, teoricoPorTurno] of casos) {
      const { porDia } = repartirPorDia(generarEventos(personas, 60, HASTA).map(ev));
      const cerrados = [...porDia.values()].filter((a) => a.presencia > 0);
      expect(cerrados.length).toBeGreaterThan(20);
      for (const a of cerrados) {
        const neto = a.presencia - a.pausa;
        // Margen de la variación natural de la hora de salida.
        expect(Math.abs(neto - teoricoPorTurno)).toBeLessThanOrEqual(12);
      }
    }
  });

  it('los de turnos hacen cinco jornadas por semana, no seis', () => {
    const dias = 70;
    const { porDia } = repartirPorDia(generarEventos(TURNOS, dias, HASTA).map(ev));
    const semanas = dias / 7;
    const porSemana = porDia.size / semanas;
    expect(porSemana).toBeGreaterThan(4.5);
    expect(porSemana).toBeLessThan(5.5);
  });

  it('el turno de noche cruza la medianoche de verdad', () => {
    const { porDia } = repartirPorDia(generarEventos(TURNOS, 60, HASTA).map(ev));
    // Con el reparto correcto, el turno de 22:00 imputa sus 7,5 h al día en
    // que empieza, no repartidas entre dos ni perdidas.
    expect([...porDia.values()].some((a) => a.presencia === 450)).toBe(true);
  });
});
