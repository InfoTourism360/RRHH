import type { Totalizacion } from '../totalizacion.js';

// -----------------------------------------------------------------------------
// Interoperabilidad con la Inspección de Trabajo.
// AÚN NO hay especificación oficial publicada del formato de intercambio. Se
// aísla TODO tras esta interfaz para poder adaptarlo sin tocar el resto del
// sistema cuando se publique. Hoy hay una implementación provisional en JSON.
// -----------------------------------------------------------------------------

export interface RegistroInspeccion {
  version: string;
  entidadCif: string;
  documentoEmpleado: string;
  periodo: { desde: string; hasta: string };
  dias: { fecha: string; trabajadoMin: number; teoricoMin: number; saldoMin: number }[];
  generadoEn: string;
}

export interface ExportadorInspeccion {
  exportar(cif: string, documento: string, t: Totalizacion): RegistroInspeccion;
}

// Implementación provisional. Reemplazable en cuanto exista el estándar.
export class ExportadorInspeccionProvisional implements ExportadorInspeccion {
  exportar(cif: string, documento: string, t: Totalizacion): RegistroInspeccion {
    return {
      version: 'provisional-0',
      entidadCif: cif,
      documentoEmpleado: documento,
      periodo: { desde: t.desde, hasta: t.hasta },
      dias: t.dias.map((d) => ({
        fecha: d.fecha, trabajadoMin: d.trabajadoMin, teoricoMin: d.teoricoMin, saldoMin: d.saldoMin,
      })),
      generadoEn: new Date().toISOString(),
    };
  }
}
