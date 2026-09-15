import { describe, it, expect } from 'vitest';
import { cabeceraNomina, SIN_DATO } from '../src/domain/export/nomina.js';
import { NOMINA_EJEMPLO } from '../src/domain/export/nomina-ejemplo.js';

// ---------------------------------------------------------------------------
// El recibo de salarios puede llevar importes de ejemplo mientras no se
// calculen, y sale rotulado como tal. Lo que no puede llevar nunca es una
// identificación inventada: un papel con el nombre y el NIF de alguien real y
// el domicilio o el número de Seguridad Social de otra entidad no es un
// borrador, es un documento falso.
// ---------------------------------------------------------------------------

const ENTIDAD = { nombre: 'Ayuntamiento de Prueba', cif: 'P9999999Z' };
const PERSONA = {
  nombre: 'Lucía', apellido1: 'Ferrer', apellido2: 'Ruiz',
  num_documento: '12345678Z',
  denominacion_puesto: 'Administrativa',
  toma_posesion: '2019-03-01',
};

describe('Cabecera del recibo de salarios', () => {
  it('usa los datos reales de la entidad y de la persona', () => {
    const { datosParciales } = cabeceraNomina(ENTIDAD, PERSONA, { mes: 'marzo', anio: 2026 });
    expect(datosParciales.empresa?.nombre).toBe('AYUNTAMIENTO DE PRUEBA');
    expect(datosParciales.empresa?.cif).toBe('P9999999Z');
    expect(datosParciales.trabajador?.nombre).toBe('FERRER RUIZ, LUCÍA');
    expect(datosParciales.trabajador?.nif).toBe('12345678Z');
    expect(datosParciales.trabajador?.categoria).toBe('Administrativa');
  });

  it('no copia del ejemplo ningún dato identificativo', () => {
    const { datosParciales } = cabeceraNomina(ENTIDAD, PERSONA);
    // Estos cuatro no se guardan todavía: deben salir a la vista como ausentes,
    // nunca con el valor del ejemplo.
    expect(datosParciales.empresa?.domicilio).toBe(SIN_DATO);
    expect(datosParciales.empresa?.numInscripSS).toBe(SIN_DATO);
    expect(datosParciales.trabajador?.numAfiliacion).toBe(SIN_DATO);
    expect(datosParciales.trabajador?.grupoCotizacion).toBe(SIN_DATO);

    const emitido = JSON.stringify(datosParciales);
    for (const inventado of [
      NOMINA_EJEMPLO.empresa.domicilio,
      NOMINA_EJEMPLO.empresa.numInscripSS,
      NOMINA_EJEMPLO.empresa.cif,
      NOMINA_EJEMPLO.trabajador.numAfiliacion,
      NOMINA_EJEMPLO.trabajador.nif,
      NOMINA_EJEMPLO.trabajador.nombre,
    ]) {
      expect(emitido).not.toContain(inventado);
    }
  });

  it('sin entidad ni persona, deja los huecos a la vista en vez de rellenarlos', () => {
    const { datosParciales } = cabeceraNomina(undefined, undefined);
    expect(datosParciales.empresa?.nombre).toBe(SIN_DATO);
    expect(datosParciales.empresa?.cif).toBe(SIN_DATO);
    expect(datosParciales.trabajador?.nombre).toBe(SIN_DATO);
    expect(datosParciales.trabajador?.nif).toBe(SIN_DATO);
    expect(datosParciales.trabajador?.antiguedad).toBe(SIN_DATO);
  });

  it('el ejemplo no lleva identificadores que puedan pasar por reales', () => {
    expect(NOMINA_EJEMPLO.empresa.cif).toMatch(/^P0{7}A$/);
    expect(NOMINA_EJEMPLO.trabajador.numAfiliacion).toMatch(/^0+$/);
    expect(NOMINA_EJEMPLO.empresa.numInscripSS).toMatch(/^0+\/0+\/0+$/);
  });
});
