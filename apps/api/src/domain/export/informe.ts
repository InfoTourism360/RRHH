import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import type { Totalizacion } from '../totalizacion.js';

export function minAHoras(min: number): string {
  const signo = min < 0 ? '-' : '';
  const a = Math.abs(min);
  return `${signo}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

export interface MetaInforme {
  entidadNombre: string;
  personaNombre: string;
  documento: string;
}

export function informeCSV(t: Totalizacion, meta: MetaInforme): string {
  const cab = 'fecha;trabajado;teorico;saldo;festivo;extras;horas_festivo';
  const filas = t.dias.map((d) =>
    [d.fecha, minAHoras(d.trabajadoMin), minAHoras(d.teoricoMin), minAHoras(d.saldoMin),
     d.esFestivo ? 'sí' : 'no', minAHoras(d.extrasMin), minAHoras(d.festivoMin)].join(';'),
  );
  const total = ['TOTAL', minAHoras(t.totales.trabajadoMin), minAHoras(t.totales.teoricoMin),
    minAHoras(t.totales.saldoMin), '', minAHoras(t.totales.extrasMin), minAHoras(t.totales.festivoMin)].join(';');
  const cabecera = `# Informe de jornada — ${meta.entidadNombre}\r\n# ${meta.personaNombre} (${meta.documento})\r\n# Periodo ${t.desde} a ${t.hasta}`;
  return `${cabecera}\r\n${cab}\r\n${filas.join('\r\n')}\r\n${total}\r\n`;
}

export function informePDF(t: Totalizacion, meta: MetaInforme): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('Informe de registro de jornada', { align: 'center' });
    doc.moveDown(0.5).fontSize(10);
    doc.text(`Entidad: ${meta.entidadNombre}`);
    doc.text(`Empleado/a: ${meta.personaNombre} (${meta.documento})`);
    doc.text(`Periodo: ${t.desde} a ${t.hasta}`);
    doc.moveDown(0.5);

    const cols = ['Fecha', 'Trabajado', 'Teórico', 'Saldo', 'Festivo', 'Extras'];
    doc.font('Helvetica-Bold').text(cols.join('   '));
    doc.font('Helvetica');
    for (const d of t.dias) {
      doc.text([d.fecha, minAHoras(d.trabajadoMin), minAHoras(d.teoricoMin),
        minAHoras(d.saldoMin), d.esFestivo ? 'sí' : 'no', minAHoras(d.extrasMin)].join('   '));
    }
    doc.moveDown(0.3).font('Helvetica-Bold').text(
      `TOTAL  trabajado ${minAHoras(t.totales.trabajadoMin)}  ·  saldo ${minAHoras(t.totales.saldoMin)}  ·  extras ${minAHoras(t.totales.extrasMin)}`,
    );
    doc.end();
  });
}

/** Hash de integridad del informe (SHA-256). Permite verificar que no se alteró. */
export function hashInforme(contenido: Buffer | string): string {
  return createHash('sha256').update(contenido).digest('hex');
}
