import { z } from 'zod';

// Validación estricta de entrada. `.strict()` rechaza campos no esperados.
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD');

export const loginSchema = z
  .object({
    cif: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(1),
    totp: z.string().regex(/^\d{6}$/).optional(),
  })
  .strict();

export const unidadSchema = z
  .object({
    padreId: z.string().uuid().nullable().optional(),
    codigo: z.string().min(1).max(50),
    denominacion: z.string().min(1).max(200),
  })
  .strict();

export const plazaSchema = z
  .object({
    codigo: z.string().min(1).max(50),
    denominacion: z.string().min(1).max(200),
    grupoCodigo: z.enum(['A1', 'A2', 'B', 'C1', 'C2', 'E_AP']),
    escalaCodigo: z.enum(['GENERAL', 'ESPECIAL']).nullable().optional(),
    subescala: z.string().max(100).nullable().optional(),
    clase: z.string().max(100).nullable().optional(),
    dotacion: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export const puestoSchema = z
  .object({
    plazaId: z.string().uuid(),
    unidadId: z.string().uuid(),
    codigo: z.string().min(1).max(50),
    denominacion: z.string().min(1).max(200),
    nivelCd: z.number().int().min(1).max(30),
    complementoEsp: z.number().min(0).nullable().optional(),
    formaProvision: z.string().max(40).nullable().optional(),
    tipoJornada: z.string().max(40).nullable().optional(),
    adscripcion: z.string().max(200).nullable().optional(),
  })
  .strict();

export const personaSchema = z
  .object({
    tipoDocumento: z.enum(['DNI', 'NIE', 'PASAPORTE']),
    numDocumento: z.string().min(1).max(20),
    nombre: z.string().min(1).max(100),
    apellido1: z.string().min(1).max(100),
    apellido2: z.string().max(100).nullable().optional(),
    emailCorp: z.string().email().nullable().optional(),
    telefono: z.string().max(20).nullable().optional(),
  })
  .strict();

export const relacionSchema = z
  .object({
    personaId: z.string().uuid(),
    puestoId: z.string().uuid(),
    tipoCodigo: z.enum(['FUNC_CARRERA', 'FUNC_INTERINO', 'LAB_FIJO', 'LAB_TEMPORAL', 'EVENTUAL']),
    situacionCodigo: z.string().min(1).max(40),
    tomaPosesion: fecha,
    ocupaEfectivo: z.boolean().optional(),
  })
  .strict();

export const ceseSchema = z.object({ cese: fecha, motivo: z.string().min(3).max(500) }).strict();

export const cambioSituacionSchema = z
  .object({
    situacionCodigo: z.string().min(1).max(40),
    desde: fecha,
    ocupaEfectivo: z.boolean(),
    motivo: z.string().min(3).max(500),
  })
  .strict();

// ------------------------------- CONTROL HORARIO ----------------------------
const geoSchema = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

export const ficharSchema = z
  .object({
    tipo: z.enum(['ENTRADA', 'SALIDA', 'INICIO_PAUSA', 'FIN_PAUSA']),
    origen: z.enum(['WEB', 'MOVIL', 'QUIOSCO']),
    momentoCliente: z.string().datetime().nullable().optional(),
    geo: geoSchema.nullable().optional(),
  })
  .strict();

export const quioscoFicharSchema = ficharSchema
  .extend({ cif: z.string().min(1), email: z.string().email(), pin: z.string().regex(/^\d{4,8}$/) })
  .strict();

export const correccionSchema = z
  .object({
    accion: z.enum(['MODIFICA', 'ANULA', 'ANADE']),
    corrigeEventoId: z.string().uuid().nullable().optional(),
    personaId: z.string().uuid().nullable().optional(),
    tipo: z.enum(['ENTRADA', 'SALIDA', 'INICIO_PAUSA', 'FIN_PAUSA']).nullable().optional(),
    momentoCliente: z.string().datetime().nullable().optional(),
    motivo: z.string().min(3).max(500),
  })
  .strict();

export const pinSchema = z.object({ pin: z.string().regex(/^\d{4,8}$/) }).strict();

export const rangoSchema = z.object({ desde: fecha, hasta: fecha }).strict();
