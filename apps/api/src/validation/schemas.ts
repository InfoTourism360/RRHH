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

// El origen no se pide: un fichaje por esta vía es de quiosco por definición y
// la ruta lo fija. Exigirlo al cliente daba a entender que se podía elegir.
export const quioscoFicharSchema = ficharSchema
  .omit({ origen: true })
  .extend({
    cif: z.string().min(1),
    identificador: z.string().min(1).optional(),
    dni: z.string().min(1).optional(),
    email: z.string().optional(),
    pin: z.string().regex(/^\d{4,8}$/),
  })
  .refine((d) => Boolean((d.identificador && d.identificador.trim()) || (d.dni && d.dni.trim()) || (d.email && d.email.trim())), {
    message: 'Debe indicar DNI, identificador o correo electrónico.',
  });

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

// `personaId` es opcional: solo lo usan los roles autorizados para consultar a
// terceros (el control de acceso se aplica en la ruta, no aquí).
export const rangoSchema = z
  .object({ desde: fecha, hasta: fecha, personaId: z.string().uuid().optional() })
  .strict();

// --------------------------------- AUSENCIAS --------------------------------
export const solicitudSchema = z
  .object({
    tipoCodigo: z.string().min(1).max(40),
    fechaInicio: fecha,
    fechaFin: fecha,
    horas: z.number().min(0).max(24).nullable().optional(),
    observaciones: z.string().max(500).nullable().optional(),
  })
  .strict();

export const denegarSchema = z.object({ motivo: z.string().min(3).max(500) }).strict();

export const festivoSchema = z
  .object({
    fecha,
    denominacion: z.string().min(1).max(200),
    ambito: z.enum(['NACIONAL', 'AUTONOMICO', 'LOCAL']),
  })
  .strict();

export const tipoAusenciaUpdateSchema = z
  .object({
    denominacion: z.string().min(1).max(200).optional(),
    requiereJustificante: z.boolean().optional(),
    requierePreaviso: z.boolean().optional(),
    diasPreaviso: z.number().int().min(0).max(90).optional(),
    aprobador: z.enum(['RESPONSABLE_UNIDAD', 'GESTOR_PERSONAL', 'AUTOMATICO']).optional(),
    permiteSolapamiento: z.boolean().optional(),
    activo: z.boolean().optional(),
  })
  .strict();

export const publicarDocSchema = z
  .object({
    personaId: z.string().uuid(),
    tipo: z.enum(['NOMINA', 'CERTIFICADO', 'COMUNICACION', 'OTRO']),
    titulo: z.string().min(1).max(200),
    nombreFichero: z.string().min(1).max(200),
    mime: z.string().max(100).optional(),
    contenidoBase64: z.string().min(1),
  })
  .strict();

export const asignarSaldoSchema = z
  .object({
    personaId: z.string().uuid(),
    tipoCodigo: z.string().min(1).max(40),
    anio: z.number().int().min(2000).max(2100),
    dias: z.number().min(0).max(366),
  })
  .strict();

// ------------------------------ ACCESOS / USUARIOS --------------------------
// Política de contraseñas documentada: mínimo 12 caracteres.
export const passwordSchema = z.string().min(12, 'La contraseña debe tener al menos 12 caracteres').max(200);
const rolSchema = z.enum(['ADMIN_ENTIDAD', 'GESTOR_PERSONAL', 'RESPONSABLE_UNIDAD', 'EMPLEADO', 'RLT']);

/**
 * Un rol puede venir como código suelto o acompañado de la unidad a la que
 * acota. Se exige la unidad al responsable: sin ella no tendría competencia
 * sobre nadie y quedaría un cargo decorativo que no puede resolver nada.
 */
const asignacionRolSchema = z
  .union([
    rolSchema.transform((rol) => ({ rol, unidadId: null as string | null })),
    z
      .object({ rol: rolSchema, unidadId: z.string().uuid().nullable().optional() })
      .strict()
      .transform((a) => ({ rol: a.rol, unidadId: a.unidadId ?? null })),
  ])
  .refine((a) => a.rol !== 'RESPONSABLE_UNIDAD' || a.unidadId !== null, {
    message: 'El responsable de unidad necesita la unidad que tiene a su cargo.',
  });

export const usuarioSchema = z
  .object({
    email: z.string().email(),
    password: passwordSchema,
    personaId: z.string().uuid().nullable().optional(),
    roles: z.array(asignacionRolSchema).min(1, 'Asigna al menos un rol'),
  })
  .strict();

export const rolesSchema = z.object({ roles: z.array(asignacionRolSchema) }).strict();
export const passwordResetSchema = z.object({ password: passwordSchema }).strict();
export const estadoUsuarioSchema = z
  .object({ activo: z.boolean(), motivo: z.string().min(3).max(500) })
  .strict();
