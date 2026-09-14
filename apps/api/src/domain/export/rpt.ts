import type { FilaRPT, ResumenRPT } from '../rpt.js';

const ESTADO: Record<string, string> = {
  OCUPADO: 'Ocupado',
  OCUPADO_CON_RESERVA: 'Ocupado (titular con reserva)',
  RESERVADO: 'Reservado (no ofertable)',
  VACANTE: 'Vacante',
};

/**
 * Escapa un campo para CSV. El separador es `;` porque es lo que espera Excel
 * en configuración regional española, y ahí la coma es el decimal.
 */
function c(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Importe con coma decimal. Vacío si no está consignado (distinto de 0,00). */
function importe(v: string | null): string {
  return v === null ? '' : Number(v).toFixed(2).replace('.', ',');
}

export interface MetaRPT {
  entidadNombre: string;
  entidadCif: string;
  generadoEn: Date;
}

export function rptCSV(filas: FilaRPT[], resumen: ResumenRPT, meta: MetaRPT): string {
  const cab = [
    'codigo', 'denominacion', 'unidad', 'plaza', 'grupo', 'escala', 'subescala',
    'nivel_cd', 'complemento_especifico', 'forma_provision', 'jornada', 'adscripcion',
    'estado', 'ocupante', 'vinculo', 'situacion', 'reserva_a_favor_de', 'situacion_reserva',
  ].join(';');

  const cuerpo = filas.map((f) => [
    f.codigo, f.denominacion, f.unidad, f.plaza_codigo, f.grupo_codigo, f.escala,
    f.subescala, f.nivel_cd, importe(f.complemento_esp), f.forma_provision,
    f.tipo_jornada, f.adscripcion, ESTADO[f.estado] ?? f.estado, f.ocupante,
    f.ocupante_tipo, f.ocupante_situacion, f.reserva_de, f.reserva_situacion,
  ].map(c).join(';'));

  // Las notas van como comentarios `#` para que no ensucien la tabla al abrirla,
  // pero viajen con el fichero: quien reciba el CSV suelto necesita saber que
  // los reservados no son ofertables y que faltan específicos.
  const notas = [
    `# RPT — ${meta.entidadNombre} (${meta.entidadCif})`,
    `# Generada el ${meta.generadoEn.toLocaleString('es-ES')}`,
    `# ${resumen.total} puestos: ${resumen.ocupados} ocupados, ${resumen.vacantes} vacantes,`
      + ` ${resumen.reservados} reservados`,
    '# "Reservado" = sin ocupante efectivo pero con titular con derecho de reserva.',
    '#   No es vacante: no puede ofertarse ni sacarse a concurso.',
  ];
  if (resumen.sinComplemento > 0) {
    notas.push(
      `# AVISO: ${resumen.sinComplemento} puesto(s) sin complemento específico consignado.`,
      '#   Salen con la celda vacía. La RPT no debería publicarse así.',
    );
  }

  // BOM para que Excel reconozca UTF-8 y no destroce los acentos.
  return `﻿${notas.join('\r\n')}\r\n${cab}\r\n${cuerpo.join('\r\n')}\r\n`;
}
