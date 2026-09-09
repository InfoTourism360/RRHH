// Catálogos estables (TREBEP) para los formularios de gestión. Códigos alineados
// con la base de datos (cat_* y CHECKs del backend).
export const GRUPOS = [
  ['A1', 'A1 · Grado/Licenciatura'], ['A2', 'A2 · Grado/Diplomatura'], ['B', 'B · Técnico Superior'],
  ['C1', 'C1 · Bachiller/Técnico'], ['C2', 'C2 · Graduado en ESO'], ['E_AP', 'Agrupaciones Profesionales'],
] as const;

export const ESCALAS = [['GENERAL', 'Administración General'], ['ESPECIAL', 'Administración Especial']] as const;

export const TIPOS_RELACION = [
  ['FUNC_CARRERA', 'Funcionario de carrera'], ['FUNC_INTERINO', 'Funcionario interino'],
  ['LAB_FIJO', 'Personal laboral fijo'], ['LAB_TEMPORAL', 'Personal laboral temporal'], ['EVENTUAL', 'Personal eventual'],
] as const;

export const SITUACIONES = [
  ['SERV_ACTIVO', 'Servicio activo'], ['SERV_ESPECIALES', 'Servicios especiales'],
  ['COMISION_SERV', 'Comisión de servicios'], ['EXCEDENCIA_VOL', 'Excedencia voluntaria'],
  ['EXCEDENCIA_CUID', 'Excedencia (cuidado familiar)'], ['SUSP_FIRME', 'Suspensión firme'],
] as const;

export const FORMAS_PROVISION = [
  ['CONCURSO', 'Concurso'], ['CONCURSO_ESP', 'Concurso específico'],
  ['LIBRE_DESIG', 'Libre designación'], ['LABORAL', 'Provisión laboral'],
] as const;

export const JORNADAS = [['COMPLETA', 'Completa'], ['PARCIAL', 'Parcial'], ['ESPECIAL', 'Especial']] as const;

export const TIPOS_DOCUMENTO_ID = [['DNI', 'DNI'], ['NIE', 'NIE'], ['PASAPORTE', 'Pasaporte']] as const;

export const TIPOS_DOC = [
  ['NOMINA', 'Nómina'], ['CERTIFICADO', 'Certificado'], ['COMUNICACION', 'Comunicación'], ['OTRO', 'Otro'],
] as const;

export function etiqueta(cat: readonly (readonly [string, string])[], codigo: string): string {
  return cat.find(([c]) => c === codigo)?.[1] ?? codigo;
}
