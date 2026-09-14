import { Router, type Request, type Response, type NextFunction } from 'express';
import { conTenant } from '../db/pool.js';
import {
  fichar, corregirFichaje, listarFichajes, notificacionesDe,
  marcarNotificacionLeida, marcarTodasLeidas,
} from '../domain/fichaje.js';
import { totalizar } from '../domain/totalizacion.js';
import { festivosEnRango } from '../domain/calendario.js';
import { diasAusenciaAprobada } from '../domain/ausencias.js';
import { informeCSV, informePDF, hashInforme, type MetaInforme } from '../domain/export/informe.js';
import { ExportadorInspeccionProvisional } from '../domain/export/inspeccion.js';
import { autenticarQuiosco, establecerPin } from '../auth/service.js';
import { requiereRol, requiereSesion, validar, ctxDe } from './middleware.js';
import { limitarPorOrigen } from './limites.js';
import {
  ficharSchema, quioscoFicharSchema, correccionSchema, pinSchema, rangoSchema,
} from '../validation/schemas.js';

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const GESTION = ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL'];
const CONSULTA_TERCEROS = ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL', 'RESPONSABLE_UNIDAD'];

function tieneRol(req: Request, roles: string[]): boolean {
  return !!req.sesion?.roles.some((r) => roles.includes(r.rol));
}

/** Resuelve la persona objetivo: la propia salvo que un rol autorizado pida otra. */
function personaObjetivo(req: Request): string {
  const pedida = (req.query.personaId as string | undefined) ?? (req.body?.personaId as string | undefined);
  if (pedida && (tieneRol(req, CONSULTA_TERCEROS) || tieneRol(req, ['RLT']))) return pedida;
  const propia = req.sesion?.personaId;
  if (!propia) throw Object.assign(new Error('El usuario no tiene ficha de persona asociada.'), { status: 400 });
  return propia;
}

// Construye los predicados de festivo y ausencia para totalizar (integra Fase 3).
async function contextoCalendario(entidadId: string, personaId: string, desde: string, hasta: string) {
  const ctx = { entidadId, usuarioId: null };
  const festivos = await conTenant(ctx, (ej) => festivosEnRango(ej, desde, hasta));
  const ausencias = await diasAusenciaAprobada(ctx, personaId, desde, hasta);
  return { esFestivo: (f: string) => festivos.has(f), diasAusencia: ausencias };
}

async function metaInforme(entidadId: string, personaId: string): Promise<MetaInforme> {
  return conTenant({ entidadId, usuarioId: null }, async (ej) => {
    const e = await ej.query<{ nombre: string }>('SELECT nombre FROM entidad WHERE id = app_entidad_id()');
    const p = await ej.query<{ nombre: string; apellido1: string; apellido2: string | null; tipo_documento: string; num_documento: string }>(
      'SELECT nombre, apellido1, apellido2, tipo_documento, num_documento FROM persona WHERE id = $1',
      [personaId],
    );
    const per = p.rows[0]!;
    return {
      entidadNombre: e.rows[0]?.nombre ?? '',
      personaNombre: [per.nombre, per.apellido1, per.apellido2].filter(Boolean).join(' '),
      documento: `${per.tipo_documento} ${per.num_documento}`,
    };
  });
}

export function rutasHorario(): Router {
  const r = Router();

  // Fichaje de QUIOSCO: sin sesión, identificación por credencial + PIN.
  // El quiosco valida un PIN: límite por origen para que no se pueda probar a
  // ciegas desde el propio terminal o desde fuera.
  r.post('/quiosco/fichar',
    limitarPorOrigen({ nombre: 'quiosco', ventanaMs: 60_000, maximo: 30 }),
    validar(quioscoFicharSchema), h(async (req, res) => {
    const { cif, identificador, email, dni, pin, ...ficha } = req.body;
    const q = await autenticarQuiosco({ cif, identificador, email, dni, pin });
    const ev = await fichar({ entidadId: q.entidadId, usuarioId: q.usuarioId }, {
      personaId: q.personaId, tipo: ficha.tipo, origen: 'QUIOSCO',
      momentoCliente: ficha.momentoCliente ?? null, geo: ficha.geo ?? null,
    });
    res.status(201).json({ id: ev.id, tipo: ev.tipo, momento: ev.momento_servidor });
  }));

  // A partir de aquí, todo requiere sesión.
  r.use(requiereSesion);

  // Fichaje propio (web/móvil).
  r.post('/fichar', validar(ficharSchema), h(async (req, res) => {
    const personaId = req.sesion!.personaId;
    if (!personaId) return res.status(400).json({ error: 'El usuario no tiene ficha de persona asociada.' });
    const ev = await fichar(ctxDe(req), { personaId, ...req.body });
    res.status(201).json(ev);
  }));

  // Establecer PIN de quiosco propio.
  r.put('/pin', validar(pinSchema), h(async (req, res) => {
    await establecerPin(req.sesion!.usuarioId, req.body.pin);
    res.status(204).end();
  }));

  // Corrección (solo gestión). Genera evento nuevo + notificación al empleado.
  r.post('/correcciones', requiereRol(...GESTION), validar(correccionSchema), h(async (req, res) => {
    const ev = await corregirFichaje(ctxDe(req), req.body);
    res.status(201).json(ev);
  }));

  // Mis fichajes (o de un tercero si el rol lo permite).
  r.get('/fichajes', validar_query(rangoSchema), h(async (req, res) => {
    const personaId = personaObjetivo(req);
    if (!tieneRol(req, CONSULTA_TERCEROS) && personaId !== req.sesion!.personaId) {
      return res.status(403).json({ error: 'Solo puedes consultar tus propios fichajes.' });
    }
    res.json(await listarFichajes(ctxDe(req), personaId, req.query.desde as string, req.query.hasta as string));
  }));

  // Notificaciones propias.
  r.get('/notificaciones', h(async (req, res) => {
    const personaId = req.sesion!.personaId;
    if (!personaId) return res.json([]);
    res.json(await notificacionesDe(ctxDe(req), personaId));
  }));

  r.patch('/notificaciones/:id/leida', h(async (req, res) => {
    const personaId = req.sesion!.personaId;
    if (!personaId) return res.status(400).json({ error: 'Sin ficha de persona.' });
    res.json(await marcarNotificacionLeida(ctxDe(req), String(req.params.id), personaId));
  }));

  r.post('/notificaciones/leer-todas', h(async (req, res) => {
    const personaId = req.sesion!.personaId;
    if (!personaId) return res.status(400).json({ error: 'Sin ficha de persona.' });
    res.json(await marcarTodasLeidas(ctxDe(req), personaId));
  }));

  // Totalización (propia; terceros solo con rol de gestión/responsable/RLT).
  r.get('/totalizacion', validar_query(rangoSchema), h(async (req, res) => {
    const personaId = personaObjetivo(req);
    const desde = req.query.desde as string, hasta = req.query.hasta as string;
    const cal = await contextoCalendario(req.sesion!.entidadId, personaId, desde, hasta);
    res.json(await totalizar(ctxDe(req), personaId, desde, hasta, cal.esFestivo, cal.diasAusencia));
  }));

  // Exportación CSV con hash de integridad.
  r.get('/informe.csv', validar_query(rangoSchema), h(async (req, res) => {
    const personaId = personaObjetivo(req);
    const desde = req.query.desde as string, hasta = req.query.hasta as string;
    const cal = await contextoCalendario(req.sesion!.entidadId, personaId, desde, hasta);
    const t = await totalizar(ctxDe(req), personaId, desde, hasta, cal.esFestivo, cal.diasAusencia);
    const meta = await metaInforme(req.sesion!.entidadId, personaId);
    const csv = informeCSV(t, meta);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('X-Integridad-SHA256', hashInforme(csv));
    res.setHeader('Content-Disposition', `attachment; filename="jornada_${personaId}.csv"`);
    res.send(csv);
  }));

  // Exportación PDF con hash de integridad.
  r.get('/informe.pdf', validar_query(rangoSchema), h(async (req, res) => {
    const personaId = personaObjetivo(req);
    const desde = req.query.desde as string, hasta = req.query.hasta as string;
    const cal = await contextoCalendario(req.sesion!.entidadId, personaId, desde, hasta);
    const t = await totalizar(ctxDe(req), personaId, desde, hasta, cal.esFestivo, cal.diasAusencia);
    const meta = await metaInforme(req.sesion!.entidadId, personaId);
    const pdf = await informePDF(t, meta);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Integridad-SHA256', hashInforme(pdf));
    res.setHeader('Content-Disposition', `attachment; filename="jornada_${personaId}.pdf"`);
    res.send(pdf);
  }));

  // Interoperabilidad Inspección de Trabajo (aislada tras interfaz; provisional).
  r.get('/inspeccion', requiereRol(...GESTION), validar_query(rangoSchema), h(async (req, res) => {
    const personaId = personaObjetivo(req);
    const desde = req.query.desde as string, hasta = req.query.hasta as string;
    const cal = await contextoCalendario(req.sesion!.entidadId, personaId, desde, hasta);
    const t = await totalizar(ctxDe(req), personaId, desde, hasta, cal.esFestivo, cal.diasAusencia);
    const meta = await metaInforme(req.sesion!.entidadId, personaId);
    const exportador = new ExportadorInspeccionProvisional();
    const cif = await conTenant(ctxDe(req), async (ej) => {
      const e = await ej.query<{ cif: string }>('SELECT cif FROM entidad WHERE id = app_entidad_id()');
      return e.rows[0]?.cif ?? '';
    });
    res.json(exportador.exportar(cif, meta.documento, t));
  }));

  return r;
}

// Valida query params con un esquema zod.
function validar_query(schema: import('zod').ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.query);
    if (!r.success) return res.status(400).json({ error: 'Parámetros inválidos', detalles: r.error.flatten() });
    next();
  };
}
