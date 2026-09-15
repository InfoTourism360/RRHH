import type { DatosNomina } from './nomina.js';

/**
 * Recibo de salarios de EJEMPLO. Sirve para una sola cosa: enseñar el formato
 * del documento antes de que la entidad tenga importes reales.
 *
 * No es un valor por defecto. Nunca debe rellenar huecos de una nómina emitida
 * para una persona concreta: un papel con el nombre y el NIF de alguien real y
 * el domicilio o el número de inscripción en la Seguridad Social de otra
 * entidad no es un borrador, es un documento falso.
 *
 * Los importes son inventados y el PDF sale rotulado como tal.
 */
export const NOMINA_EJEMPLO: DatosNomina = {
  empresa: {
    nombre: 'ENTIDAD DE EJEMPLO',
    domicilio: 'Domicilio de la entidad',
    cif: 'P0000000A',
    numInscripSS: '00/0000000/00',
  },
  trabajador: {
    nombre: 'APELLIDOS, NOMBRE',
    categoria: 'Técnico de Administración General',
    antiguedad: '01/02/2018',
    numAfiliacion: '000000000000',
    grupoCotizacion: '07',
    nif: '00000000T',
  },
  periodo: {
    desdeDia: 1,
    hastaDia: 31,
    mes: 'AGOSTO',
    anio: 2018,
    totalDias: 30,
  },
  devengos: [
    { cuantia: 30, concepto: 'SALARIO BASE', importe: 26.12, total: 783.74 },
    { cuantia: 30, concepto: 'COMP. DEDICACION', importe: 3.52, total: 105.70 },
    { cuantia: 30, concepto: 'MEJ VOLUNTARIA', importe: 13.29, total: 398.70 },
    { cuantia: 30, concepto: 'P. NO COMPETENCIA', importe: 3.00, total: 90.00 },
    { cuantia: 30, concepto: 'P.P.Paga Extra', importe: 4.35, total: 130.62 },
  ],
  deducciones: [
    { cuantia: '4,70', concepto: 'Cont.Comunes', deduccion: 70.91 },
    { cuantia: '1,55', concepto: 'Desempleo', deduccion: 23.39 },
    { cuantia: '0,10', concepto: 'For.Profesional', deduccion: 1.51 },
    { cuantia: '10,80', concepto: 'I.R.P.F.', deduccion: 162.95 },
  ],
  bases: {
    remuneracionMensual: 1378.14,
    prorrataPagasExtras: 130.62,
    baseContingenciasComunes: 1508.76,
    tipoContingenciasComunes: 23.60,
    aportacionEmpresaContingenciasComunes: 356.07,
    tipoATEP: 1.70,
    aportacionEmpresaATEP: 25.65,
    baseDesempleo: 1508.76,
    tipoDesempleo: 5.50,
    aportacionEmpresaDesempleo: 82.98,
    baseFormacion: 1508.76,
    tipoFormacion: 0.60,
    aportacionEmpresaFormacion: 9.05,
    baseFogasa: 1508.76,
    tipoFogasa: 0.20,
    aportacionEmpresaFogasa: 3.02,
    baseIRPF: 1508.76,
  },
};
