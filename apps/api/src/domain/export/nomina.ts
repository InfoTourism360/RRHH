import PDFDocument from 'pdfkit';
import { conTenant, type Contexto } from '../../db/pool.js';
import { NOMINA_EJEMPLO } from './nomina-ejemplo.js';

export interface ConceptoNomina {
  cuantia?: string | number;
  concepto: string;
  importe?: number;
  deduccion?: number;
  total?: number;
}

export interface DatosNomina {
  empresa: {
    nombre: string;
    domicilio: string;
    cif: string;
    numInscripSS: string;
  };
  trabajador: {
    nombre: string;
    categoria: string;
    antiguedad: string;
    numAfiliacion: string;
    grupoCotizacion: string;
    nif: string;
  };
  periodo: {
    desdeDia: number;
    hastaDia: number;
    mes: string;
    anio: number;
    totalDias: number;
  };
  devengos: Array<{
    cuantia?: string | number;
    concepto: string;
    importe: number;
    total: number;
  }>;
  deducciones: Array<{
    cuantia?: string | number;
    concepto: string;
    deduccion: number;
  }>;
  bases: {
    remuneracionMensual: number;
    prorrataPagasExtras: number;
    baseContingenciasComunes: number;
    tipoContingenciasComunes: number;
    aportacionEmpresaContingenciasComunes: number;
    tipoATEP: number;
    aportacionEmpresaATEP: number;
    baseDesempleo: number;
    tipoDesempleo: number;
    aportacionEmpresaDesempleo: number;
    baseFormacion: number;
    tipoFormacion: number;
    aportacionEmpresaFormacion: number;
    baseFogasa: number;
    tipoFogasa: number;
    aportacionEmpresaFogasa: number;
    baseIRPF: number;
  };
}


function fmtNum(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generarNominaPDF(datosParciales?: Partial<DatosNomina>): Promise<Buffer> {
  const datos: DatosNomina = {
    empresa: { ...NOMINA_EJEMPLO.empresa, ...datosParciales?.empresa },
    trabajador: { ...NOMINA_EJEMPLO.trabajador, ...datosParciales?.trabajador },
    periodo: { ...NOMINA_EJEMPLO.periodo, ...datosParciales?.periodo },
    devengos: datosParciales?.devengos ?? NOMINA_EJEMPLO.devengos,
    deducciones: datosParciales?.deducciones ?? NOMINA_EJEMPLO.deducciones,
    bases: { ...NOMINA_EJEMPLO.bases, ...datosParciales?.bases },
  };

  // Los importes solo son reales si los aporta quien llama. Si no, salen del
  // ejemplo, y entonces el papel no puede presentarse como una nómina: lleva
  // nombre y NIF de una persona pero cifras inventadas.
  const importesFicticios =
    !datosParciales?.devengos && !datosParciales?.deducciones && !datosParciales?.bases;

  const totalDevengado = datos.devengos.reduce((acc, d) => acc + d.total, 0);
  const totalDeducir = datos.deducciones.reduce((acc, d) => acc + d.deduccion, 0);
  const liquido = totalDevengado - totalDeducir;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Configuración general
    const x0 = 40;
    const wTotal = 515;
    const strokeColor = '#000000';
    doc.lineWidth(0.8);
    doc.strokeColor(strokeColor);
    doc.fillColor('#000000');

    // Helper para dibujar rectángulos con borde
    const box = (x: number, y: number, w: number, h: number) => {
      doc.rect(x, y, w, h).stroke();
    };

    // Helper para líneas
    const lineH = (x1: number, x2: number, y: number) => {
      doc.moveTo(x1, y).lineTo(x2, y).stroke();
    };
    const lineV = (x: number, y1: number, y2: number) => {
      doc.moveTo(x, y1).lineTo(x, y2).stroke();
    };

    // =========================================================================
    // 1. CABECERA: EMPRESA y TRABAJADOR
    // =========================================================================
    const yHeader = 38;
    const hHeader = 66;
    const wBox = (wTotal - 8) / 2; // ~253.5
    const xEmpresa = x0;
    const xTrabajador = x0 + wBox + 8;

    // Caja Empresa
    box(xEmpresa, yHeader, wBox, hHeader);
    lineH(xEmpresa, xEmpresa + wBox, yHeader + 22);
    lineH(xEmpresa, xEmpresa + wBox, yHeader + 44);
    lineV(xEmpresa + 90, yHeader + 44, yHeader + hHeader);

    // Texto Empresa
    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('EMPRESA', xEmpresa + 5, yHeader + 4);
    doc.font('Courier').fontSize(8);
    doc.text(datos.empresa.nombre, xEmpresa + 5, yHeader + 13);

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('Domicilio', xEmpresa + 5, yHeader + 25);
    doc.font('Courier').fontSize(8);
    doc.text(datos.empresa.domicilio, xEmpresa + 60, yHeader + 25);

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('C.I.F.', xEmpresa + 5, yHeader + 47);
    doc.font('Courier').fontSize(8);
    doc.text(datos.empresa.cif, xEmpresa + 5, yHeader + 56);

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('Nº Inscrip. S.S.', xEmpresa + 95, yHeader + 47);
    doc.font('Courier').fontSize(8);
    doc.text(datos.empresa.numInscripSS, xEmpresa + 95, yHeader + 56);

    // Caja Trabajador
    box(xTrabajador, yHeader, wBox, hHeader);
    lineH(xTrabajador, xTrabajador + wBox, yHeader + 22);
    lineH(xTrabajador, xTrabajador + wBox, yHeader + 44);
    lineV(xTrabajador + 145, yHeader + 22, yHeader + 44); // Categoría / Antigüedad
    lineV(xTrabajador + 125, yHeader + 44, yHeader + hHeader); // Nº Afiliación
    lineV(xTrabajador + 155, yHeader + 44, yHeader + hHeader); // G.C
    // N.I.F.

    // Texto Trabajador
    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('TRABAJADOR', xTrabajador + 5, yHeader + 4);
    doc.font('Courier').fontSize(8);
    doc.text(datos.trabajador.nombre, xTrabajador + 5, yHeader + 13);

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('Categoría', xTrabajador + 5, yHeader + 25);
    doc.font('Courier').fontSize(7.5);
    doc.text(datos.trabajador.categoria, xTrabajador + 5, yHeader + 34, { width: 135, lineBreak: false });

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('Antigüedad', xTrabajador + 150, yHeader + 25);
    doc.font('Courier').fontSize(8);
    doc.text(datos.trabajador.antiguedad, xTrabajador + 150, yHeader + 34);

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('Nº Afiliación', xTrabajador + 5, yHeader + 47);
    doc.font('Courier').fontSize(8);
    doc.text(datos.trabajador.numAfiliacion, xTrabajador + 5, yHeader + 56);

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('G.C', xTrabajador + 130, yHeader + 47);
    doc.font('Courier').fontSize(8);
    doc.text(datos.trabajador.grupoCotizacion, xTrabajador + 130, yHeader + 56);

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('N.I.F.', xTrabajador + 160, yHeader + 47);
    doc.font('Courier').fontSize(8);
    doc.text(datos.trabajador.nif, xTrabajador + 160, yHeader + 56);

    // =========================================================================
    // 2. PERIODO DE LIQUIDACIÓN
    // =========================================================================
    const yPeriodo = yHeader + hHeader + 5; // ~109
    const hPeriodo = 34;
    box(x0, yPeriodo, wTotal, hPeriodo);

    const xColPeriodo2 = x0 + 240;
    const xColPeriodo3 = x0 + 365;
    lineV(xColPeriodo2, yPeriodo, yPeriodo + hPeriodo);
    lineV(xColPeriodo3, yPeriodo, yPeriodo + hPeriodo);

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('Periodo de Liquidación', x0 + 6, yPeriodo + 4);
    doc.font('Courier').fontSize(8.5);
    doc.text(
      `Del ${datos.periodo.desdeDia}  al ${datos.periodo.hastaDia} de ${datos.periodo.mes}         ${datos.periodo.anio}`,
      x0 + 6,
      yPeriodo + 18,
    );

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('Total Días', xColPeriodo2 + 6, yPeriodo + 4, { width: xColPeriodo3 - xColPeriodo2 - 12, align: 'center' });
    doc.font('Courier').fontSize(8.5);
    doc.text(String(datos.periodo.totalDias), xColPeriodo2 + 6, yPeriodo + 18, {
      width: xColPeriodo3 - xColPeriodo2 - 12,
      align: 'center',
    });

    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('Importe Total', xColPeriodo3 + 6, yPeriodo + 4, { width: wTotal - (xColPeriodo3 - x0) - 12, align: 'center' });
    doc.font('Courier').fontSize(8.5);
    doc.text(fmtNum(liquido), xColPeriodo3 + 6, yPeriodo + 18, {
      width: wTotal - (xColPeriodo3 - x0) - 16,
      align: 'right',
    });

    // =========================================================================
    // 3. TABLA DE CONCEPTOS (DEVENGOS Y DEDUCCIONES)
    // =========================================================================
    const yTabla = yPeriodo + hPeriodo + 6; // ~149
    const hTabla = 265;
    const hCabTabla = 16;
    box(x0, yTabla, wTotal, hTabla);
    lineH(x0, x0 + wTotal, yTabla + hCabTabla);

    // Columnas
    const xC1 = x0; // Cuantía (ancho ~60)
    const xC2 = x0 + 65; // Conceptos (ancho ~175)
    const xC3 = x0 + 240; // Importe (ancho ~70)
    const xC4 = x0 + 310; // Deducción (ancho ~85)
    const xC5 = x0 + 395; // TOTALES (ancho ~120)

    lineV(xC2, yTabla, yTabla + hTabla);
    lineV(xC3, yTabla, yTabla + hTabla);
    lineV(xC4, yTabla, yTabla + hTabla);
    lineV(xC5, yTabla, yTabla + hTabla);

    // Cabeceras de columnas
    doc.font('Courier').fontSize(7.5);
    doc.text('Cuantía', xC1 + 4, yTabla + 4, { width: 57, align: 'center' });
    doc.text('Conceptos', xC2 + 10, yTabla + 4);
    doc.text('Importe', xC3 + 4, yTabla + 4, { width: 62, align: 'right' });
    doc.text('Deducción', xC4 + 4, yTabla + 4, { width: 77, align: 'right' });
    doc.text('TOTALES', xC5 + 4, yTabla + 4, { width: 111, align: 'right' });

    // Filas de Devengos
    let curY = yTabla + hCabTabla + 8;
    const rowHeight = 12;

    doc.font('Courier').fontSize(8);
    for (const dev of datos.devengos) {
      if (dev.cuantia !== undefined) {
        doc.text(String(dev.cuantia), xC1 + 4, curY, { width: 57, align: 'center' });
      }
      doc.text(dev.concepto, xC2 + 8, curY);
      doc.text(fmtNum(dev.importe), xC3 + 4, curY, { width: 62, align: 'right' });
      doc.text(fmtNum(dev.total), xC5 + 4, curY, { width: 111, align: 'right' });
      curY += rowHeight;
    }

    // Filas de Deducciones
    for (const ded of datos.deducciones) {
      if (ded.cuantia !== undefined) {
        doc.text(String(ded.cuantia), xC1 + 4, curY, { width: 57, align: 'center' });
      }
      doc.text(ded.concepto, xC2 + 8, curY);
      doc.text(fmtNum(ded.deduccion), xC4 + 4, curY, { width: 77, align: 'right' });
      curY += rowHeight;
    }

    // =========================================================================
    // 4. TOTALES (TOTAL DEVENGADO, TOTAL DEDUCIR, LÍQUIDO A PERCIBIR)
    // =========================================================================
    const yTotales = yTabla + hTabla + 6; // ~420
    const hTotales = 36;
    box(x0, yTotales, wTotal, hTotales);

    const xTot2 = x0 + 170;
    const xTot3 = x0 + 340;
    lineV(xTot2, yTotales, yTotales + hTotales);
    lineV(xTot3, yTotales, yTotales + hTotales);

    // Total Devengado
    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('Total Devengado', x0 + 6, yTotales + 5, { width: 158, align: 'center' });
    doc.font('Courier').fontSize(9);
    doc.text(fmtNum(totalDevengado), x0 + 6, yTotales + 20, { width: 158, align: 'center' });

    // Total Deducir
    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('Total Deducir', xTot2 + 6, yTotales + 5, { width: 158, align: 'center' });
    doc.font('Courier').fontSize(9);
    doc.text(fmtNum(totalDeducir), xTot2 + 6, yTotales + 20, { width: 158, align: 'center' });

    // Líquido a percibir
    doc.font('Courier-Bold').fontSize(8.5);
    doc.text('LÍQUIDO A PERCIBIR', xTot3 + 6, yTotales + 5, { width: wTotal - (xTot3 - x0) - 12, align: 'center' });
    doc.font('Courier').fontSize(9);
    doc.text(fmtNum(liquido), xTot3 + 6, yTotales + 20, { width: wTotal - (xTot3 - x0) - 12, align: 'center' });

    // =========================================================================
    // 5. DETERMINACIÓN DE BASES DE COTIZACIÓN
    // =========================================================================
    const yBases = yTotales + hTotales + 6; // ~462
    const hBases = 142;
    box(x0, yBases, wTotal, hBases);

    // Título de bases
    doc.font('Courier-Bold').fontSize(5.5);
    doc.text(
      'DETERMINACIÓN DE LAS BASES DE COTIZACIÓN A LA SEGURIDAD SOCIAL Y CONCEPTOS RECAUDACIÓN CONJUNTA Y DE LA BASE SUJETA A RETENCIÓN DEL IRPF Y APORTACIÓN DE EMPRESA',
      x0 + 4,
      yBases + 3,
      { width: wTotal - 8, align: 'left' },
    );

    // Subcabeceras
    const ySubCab = yBases + 15;
    doc.font('Courier').fontSize(6.5);
    doc.text('CONCEPTO', x0 + 100, ySubCab);
    doc.text('BASE', x0 + 290, ySubCab, { width: 50, align: 'right' });
    doc.text('TIPO', x0 + 350, ySubCab, { width: 35, align: 'right' });
    doc.text('APORTACIÓN EMPRESA', x0 + 395, ySubCab, { width: 105, align: 'right' });

    // Filas de bases
    let bY = ySubCab + 9;
    const bLineH = 8.8;

    const b = datos.bases;

    // 1. Contingencias comunes
    doc.font('Courier').fontSize(6.5);
    doc.text('1. Contingencias comunes', x0 + 5, bY);
    bY += bLineH;

    doc.text('Importe remuneración mensual................', x0 + 20, bY);
    // Subrayado bajo remuneración mensual
    doc.text(fmtNum(b.remuneracionMensual), x0 + 200, bY, { width: 60, align: 'right' });
    lineH(x0 + 195, x0 + 265, bY + 8);
    bY += bLineH;

    doc.text('Importe prorrata paga extraordinarias.......', x0 + 20, bY);
    doc.text(fmtNum(b.prorrataPagasExtras), x0 + 200, bY, { width: 60, align: 'right' });
    lineH(x0 + 195, x0 + 265, bY + 8);
    bY += bLineH;

    doc.text('TOTAL.......................................', x0 + 140, bY);
    doc.text(fmtNum(b.baseContingenciasComunes), x0 + 280, bY, { width: 60, align: 'right' });
    lineH(x0 + 285, x0 + 345, bY + 8);
    doc.text(fmtNum(b.tipoContingenciasComunes), x0 + 350, bY, { width: 35, align: 'right' });
    doc.text(fmtNum(b.aportacionEmpresaContingenciasComunes), x0 + 430, bY, { width: 70, align: 'right' });
    lineH(x0 + 435, x0 + 505, bY + 8);
    bY += bLineH + 1;

    // 2. Contingencias profesionales
    doc.text('2. Conting. profesionales', x0 + 5, bY);
    doc.text('AT Y EP.....................................', x0 + 140, bY);
    doc.text(fmtNum(b.tipoATEP), x0 + 350, bY, { width: 35, align: 'right' });
    doc.text(fmtNum(b.aportacionEmpresaATEP), x0 + 430, bY, { width: 70, align: 'right' });
    lineH(x0 + 435, x0 + 505, bY + 8);
    bY += bLineH;

    doc.text('y conceptos recaudac.', x0 + 15, bY);
    doc.text('Desempleo...................................', x0 + 140, bY);
    doc.text(fmtNum(b.baseDesempleo), x0 + 280, bY, { width: 60, align: 'right' });
    lineH(x0 + 285, x0 + 345, bY + 8);
    doc.text(fmtNum(b.tipoDesempleo), x0 + 350, bY, { width: 35, align: 'right' });
    doc.text(fmtNum(b.aportacionEmpresaDesempleo), x0 + 430, bY, { width: 70, align: 'right' });
    lineH(x0 + 435, x0 + 505, bY + 8);
    bY += bLineH;

    doc.text('conjunta...............', x0 + 15, bY);
    doc.text('Formación Profesional.......................', x0 + 140, bY);
    doc.text(fmtNum(b.tipoFormacion), x0 + 350, bY, { width: 35, align: 'right' });
    doc.text(fmtNum(b.aportacionEmpresaFormacion), x0 + 430, bY, { width: 70, align: 'right' });
    lineH(x0 + 435, x0 + 505, bY + 8);
    bY += bLineH;

    doc.text('Fondo Garantía Salarial.....................', x0 + 140, bY);
    doc.text(fmtNum(b.tipoFogasa), x0 + 350, bY, { width: 35, align: 'right' });
    doc.text(fmtNum(b.aportacionEmpresaFogasa), x0 + 430, bY, { width: 70, align: 'right' });
    lineH(x0 + 435, x0 + 505, bY + 8);
    bY += bLineH;

    // 3. Horas extras
    doc.text('3. Cotización adicional horas extraordinarias.....', x0 + 5, bY);
    bY += bLineH;

    // 4. Base sujeta IRPF
    doc.text('4. Base sujeta a retención de I.R.P.F............', x0 + 5, bY);
    doc.text(fmtNum(b.baseIRPF), x0 + 280, bY, { width: 60, align: 'right' });
    lineH(x0 + 285, x0 + 345, bY + 8);

    // =========================================================================
    // 6. FIRMAS Y SELLOS
    // =========================================================================
    const yFirmas = yBases + hBases + 10; // ~618
    const hFirmas = 85;
    box(x0, yFirmas, wTotal, hFirmas);

    const xDivFirmas = x0 + 235;
    lineV(xDivFirmas, yFirmas, yFirmas + hFirmas);

    doc.font('Courier').fontSize(8);
    doc.text('Firma y sello Empresa:', x0 + 10, yFirmas + 10);
    doc.text(`Recibí Trabajador:${datos.periodo.mes}         ${datos.periodo.anio}`, xDivFirmas + 10, yFirmas + 10);

    // =========================================================================
    // 7. MARCA DE DEMOSTRACIÓN
    // =========================================================================
    if (importesFicticios) {
      doc.font('Courier-Bold').fontSize(7.5).fillColor('#000000');
      doc.text(
        'DOCUMENTO DE DEMOSTRACIÓN · Los importes son ficticios y no corresponden a una nómina real.',
        x0, yFirmas + hFirmas + 8, { width: wTotal, align: 'center' },
      );

      // Diagonal translúcida para que no se confunda ni impreso ni en pantalla.
      doc.save();
      doc.opacity(0.16);
      doc.rotate(-30, { origin: [297.5, 421] });
      doc.font('Courier-Bold').fontSize(34).fillColor('#c00000');
      doc.text('IMPORTES FICTICIOS', 0, 400, { width: 595, align: 'center' });
      doc.restore();
    }

    doc.end();
  });
}

const MESES_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

/** Lo que no consta se deja a la vista, en lugar de rellenarlo con un inventado. */
export const SIN_DATO = '— no consta —';

export interface EntidadNomina { nombre: string; cif: string }
export interface PersonaNomina {
  nombre: string;
  apellido1: string;
  apellido2: string | null;
  num_documento: string;
  denominacion_puesto: string | null;
  toma_posesion: string | null;
}

/**
 * Arma la cabecera del recibo con lo que consta y solo con lo que consta.
 *
 * Está separada de la consulta para poder probarla: aquí vivía el fallo de
 * copiar del ejemplo el domicilio y los números de Seguridad Social.
 */
export function cabeceraNomina(
  ent: EntidadNomina | undefined,
  persona: PersonaNomina | undefined,
  opciones?: { mes?: string; anio?: number },
): { datosParciales: Partial<DatosNomina>; mes: string; anio: number } {
  const hoy = new Date();
  const mes = opciones?.mes?.toUpperCase() || MESES_ES[hoy.getMonth()] || 'ENERO';
  const anio = opciones?.anio || hoy.getFullYear();

  const nombreApellidos = persona
    ? `${persona.apellido1} ${persona.apellido2 ?? ''}, ${persona.nombre}`.trim().toUpperCase()
    : SIN_DATO;

  const antiguedad = persona?.toma_posesion
    ? new Date(persona.toma_posesion).toLocaleDateString('es-ES')
    : SIN_DATO;

  return {
    mes,
    anio,
    datosParciales: {
      empresa: {
        nombre: ent?.nombre?.toUpperCase() ?? SIN_DATO,
        cif: ent?.cif ?? SIN_DATO,
        // Ninguno de los dos se guarda todavía en la entidad.
        domicilio: SIN_DATO,
        numInscripSS: SIN_DATO,
      },
      trabajador: {
        nombre: nombreApellidos,
        categoria: persona?.denominacion_puesto ?? SIN_DATO,
        antiguedad,
        // Tampoco se guardan en la ficha de personal.
        numAfiliacion: SIN_DATO,
        grupoCotizacion: SIN_DATO,
        nif: persona?.num_documento ?? SIN_DATO,
      },
      periodo: { desdeDia: 1, hastaDia: 31, mes, anio, totalDias: 30 },
    },
  };
}

/**
 * Rellena la cabecera (entidad, persona, puesto, periodo) con datos reales.
 *
 * OJO: los devengos, las deducciones y las bases de cotización NO se calculan;
 * salen de `NOMINA_EJEMPLO`. El PDF sale por eso marcado como documento de
 * demostración. Antes de usar esto como nómina de verdad hay que calcular los
 * importes y pasarlos en `datosParciales`; solo entonces desaparece la marca.
 *
 * Lo que sí es real es la identificación: el domicilio de la entidad, su número
 * de inscripción en la Seguridad Social y el de afiliación de la persona no se
 * guardan todavía, así que salen como "no consta". Antes se copiaban del
 * ejemplo y un ayuntamiento recibía un recibo con el domicilio de otro.
 */
export async function generarNominaParaPersona(
  ctx: Contexto,
  personaId: string,
  opciones?: { mes?: string; anio?: number },
): Promise<{ buffer: Buffer; nombreFichero: string; titulo: string }> {
  return conTenant(ctx, async (ej) => {
    // Entidad
    const entRes = await ej.query<{ nombre: string; cif: string }>(
      'SELECT nombre, cif FROM entidad WHERE id = app_entidad_id()',
    );
    const ent = entRes.rows[0];

    // Persona y relación de servicio actual
    const pRes = await ej.query<{
      nombre: string;
      apellido1: string;
      apellido2: string | null;
      num_documento: string;
      denominacion_puesto: string | null;
      toma_posesion: string | null;
    }>(
      `SELECT p.nombre, p.apellido1, p.apellido2, p.num_documento,
              pu.denominacion AS denominacion_puesto,
              rs.toma_posesion
         FROM persona p
    LEFT JOIN relacion_servicio rs ON rs.persona_id = p.id AND rs.cese IS NULL
    LEFT JOIN puesto pu ON pu.id = rs.puesto_id
        WHERE p.id = $1
        ORDER BY rs.toma_posesion DESC NULLS LAST
        LIMIT 1`,
      [personaId],
    );
    const persona = pRes.rows[0];

    const { datosParciales, mes, anio } = cabeceraNomina(ent, persona, opciones);

    const buffer = await generarNominaPDF(datosParciales);
    const nombreFichero = `nomina_${mes.toLowerCase()}_${anio}.pdf`;
    const titulo = `Nómina ${mes} ${anio}`;

    return { buffer, nombreFichero, titulo };
  });
}
