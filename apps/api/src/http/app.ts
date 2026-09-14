import express, { type Request, type Response, type NextFunction } from 'express';
import { login, logout, ErrorAuth } from '../auth/service.js';
import { ErrorDominio } from '../domain/estructura.js';
import * as est from '../domain/estructura.js';
import { ctxDe, requiereRol, requiereSesion, validar, registroActividad } from './middleware.js';
import { listarActividad } from '../domain/registroActividad.js';
import { panelDireccion } from '../domain/panel.js';
import { consultarRPT, resumirRPT } from '../domain/rpt.js';
import { rptCSV } from '../domain/export/rpt.js';
import { hashInforme } from '../domain/export/informe.js';
import { appPool, conTenant } from '../db/pool.js';
import { rutasHorario } from './horario.js';
import { rutasAusencias } from './ausencias.js';
import { rutasPortal } from './portal.js';
import { rutasUsuarios } from './usuarios.js';
import { limitarPorOrigen } from './limites.js';
import {
  cambioSituacionSchema, ceseSchema, loginSchema, personaSchema,
  plazaSchema, puestoSchema, relacionSchema, unidadSchema,
} from '../validation/schemas.js';

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const GESTION = ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL'];

/** Filtros de la RPT tomados del query string (todos opcionales). */
function filtrosDe(req: Request) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const unidadId = String(req.query.unidadId ?? '');
  return {
    unidadId: uuid.test(unidadId) ? unidadId : undefined,
    grupoCodigo: req.query.grupo ? String(req.query.grupo).slice(0, 10) : undefined,
    soloVacantes: req.query.soloVacantes === 'true',
  };
}

export function crearApp() {
  const app = express();
  // Detrás de un reverse proxy (nginx): usa X-Forwarded-* para obtener la IP real.
  app.set('trust proxy', 1);
  // No anunciar la tecnología del servidor (X-Powered-By: Express).
  app.disable('x-powered-by');
  // 8 MB para permitir la subida de documentos en base64 (p. ej. nóminas PDF).
  app.use(express.json({ limit: '8mb' }));

  // Sonda de salud real: comprueba la conectividad con la base de datos.
  // Si solo respondiera 200 fijo, un orquestador daría por sana una API que no
  // puede servir nada (ocurrió: la BD caída devolvía `ok:true`).
  app.get('/salud', h(async (_req, res) => {
    try {
      await appPool.query('SELECT 1');
      res.json({ ok: true, bd: 'ok' });
    } catch {
      res.status(503).json({ ok: false, bd: 'no disponible' });
    }
  }));

  // Límite general por origen, como red de seguridad frente a abuso.
  app.use(limitarPorOrigen({ nombre: 'general', ventanaMs: 60_000, maximo: 300 }));

  // Registro de actividad ENS: traza cada petición (tras resolver la sesión más
  // abajo, la traza incluye usuario/entidad cuando existen).
  app.use(registroActividad);

  // ------------------------------ AUTH -------------------------------------
  // Credenciales: límite estricto por origen. El bloqueo por intentos protege
  // una cuenta concreta; esto frena probar muchas cuentas desde el mismo sitio.
  app.post('/auth/login',
    limitarPorOrigen({ nombre: 'login', ventanaMs: 5 * 60_000, maximo: 20 }),
    validar(loginSchema), h(async (req, res) => {
    const { token, sesion } = await login({
      ...req.body,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
    });
    res.json({ token, roles: sesion.roles, usuarioId: sesion.usuarioId });
  }));

  app.post('/auth/logout', requiereSesion, h(async (req, res) => {
    const token = (req.header('authorization') ?? '').slice(7);
    await logout(token);
    res.status(204).end();
  }));

  app.get('/auth/yo', requiereSesion, h(async (req, res) => {
    res.json({ entidadId: req.sesion!.entidadId, usuarioId: req.sesion!.usuarioId, roles: req.sesion!.roles });
  }));

  // ----------------------- CUADRO DE MANDO (gestión) -----------------------
  app.get('/admin/panel', requiereSesion, requiereRol('ADMIN_ENTIDAD', 'GESTOR_PERSONAL'),
    h(async (req, res) => res.json(await panelDireccion(ctxDe(req)))));

  // --------------------------- ACCESOS / USUARIOS --------------------------
  app.use('/admin/usuarios', requiereSesion, rutasUsuarios());

  // ----------------------- REGISTRO DE ACTIVIDAD (ENS) ---------------------
  app.get('/admin/registro-actividad', requiereSesion, requiereRol('ADMIN_ENTIDAD'),
    h(async (req, res) => res.json(await listarActividad(ctxDe(req),
      String(req.query.desde ?? '2000-01-01'), String(req.query.hasta ?? '2100-01-01')))));

  // -------------------------- ESTRUCTURA -----------------------------------
  app.use('/estructura', requiereSesion);

  app.get('/estructura/unidades', h(async (req, res) =>
    res.json(await est.listarUnidades(ctxDe(req)))));
  app.post('/estructura/unidades', requiereRol(...GESTION), validar(unidadSchema),
    h(async (req, res) => res.status(201).json(await est.crearUnidad(ctxDe(req), req.body))));
  app.patch('/estructura/unidades/:id', requiereRol(...GESTION), validar(unidadSchema.partial()),
    h(async (req, res) => res.json(await est.actualizarUnidad(ctxDe(req), String(req.params.id), req.body))));

  app.get('/estructura/plazas', h(async (req, res) =>
    res.json(await est.listarPlazas(ctxDe(req)))));
  app.post('/estructura/plazas', requiereRol(...GESTION), validar(plazaSchema),
    h(async (req, res) => res.status(201).json(await est.crearPlaza(ctxDe(req), req.body))));

  app.get('/estructura/puestos', h(async (req, res) =>
    res.json(await est.listarPuestos(ctxDe(req)))));
  app.post('/estructura/puestos', requiereRol(...GESTION), validar(puestoSchema),
    h(async (req, res) => res.status(201).json(await est.crearPuesto(ctxDe(req), req.body))));

  app.get('/estructura/personas', h(async (req, res) =>
    res.json(await est.listarPersonas(ctxDe(req)))));
  app.post('/estructura/personas', requiereRol(...GESTION), validar(personaSchema),
    h(async (req, res) => res.status(201).json(await est.crearPersona(ctxDe(req), req.body))));

  app.get('/estructura/relaciones', h(async (req, res) =>
    res.json(await est.listarRelaciones(ctxDe(req), {
      personaId: req.query.personaId as string | undefined,
      puestoId: req.query.puestoId as string | undefined,
    }))));
  app.post('/estructura/relaciones', requiereRol(...GESTION), validar(relacionSchema),
    h(async (req, res) => res.status(201).json(await est.crearRelacion(ctxDe(req), req.body))));
  app.post('/estructura/relaciones/:id/cese', requiereRol(...GESTION), validar(ceseSchema),
    h(async (req, res) => res.json(await est.cesarRelacion(ctxDe(req), String(req.params.id), req.body.cese, req.body.motivo))));
  app.post('/estructura/relaciones/:id/situacion', requiereRol(...GESTION), validar(cambioSituacionSchema),
    h(async (req, res) => res.json(await est.cambiarSituacion(ctxDe(req), String(req.params.id), req.body))));

  app.get('/estructura/auditoria/:tabla/:registroId', h(async (req, res) =>
    res.json(await est.historialAuditoria(ctxDe(req), String(req.params.tabla), String(req.params.registroId)))));

  // ------------------------------- RPT -------------------------------------
  // Solo gestión: la RPT publicada no lleva ocupantes, pero esta vista sí, y
  // decir quién está en excedencia es un dato de salud por la puerta de atrás.
  app.get('/estructura/rpt', requiereRol(...GESTION), h(async (req, res) => {
    const filas = await consultarRPT(ctxDe(req), filtrosDe(req));
    res.json({ filas, resumen: resumirRPT(filas) });
  }));

  app.get('/estructura/rpt.csv', requiereRol(...GESTION), h(async (req, res) => {
    const ctx = ctxDe(req);
    const filas = await consultarRPT(ctx, filtrosDe(req));
    const ent = await conTenant(ctx, async (ej) =>
      (await ej.query<{ nombre: string; cif: string }>(
        'SELECT nombre, cif FROM entidad WHERE id = app_entidad_id()')).rows[0]);
    const csv = rptCSV(filas, resumirRPT(filas), {
      entidadNombre: ent?.nombre ?? '', entidadCif: ent?.cif ?? '', generadoEn: new Date(),
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('X-Integridad-SHA256', hashInforme(csv));
    res.setHeader('Content-Disposition', 'attachment; filename="rpt.csv"');
    res.send(csv);
  }));

  // -------------------------- CONTROL HORARIO ------------------------------
  app.use('/horario', rutasHorario());

  // ------------------------ VACACIONES Y PERMISOS --------------------------
  app.use('/ausencias', requiereSesion, rutasAusencias());

  // --------------------------- PORTAL EMPLEADO -----------------------------
  app.use('/portal', requiereSesion, rutasPortal());

  // ------------------------- MANEJO DE ERRORES -----------------------------
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ErrorAuth) {
      const code = err.codigo === 'BLOQUEADO' ? 423 : 401;
      return res.status(code).json({ error: err.message, codigo: err.codigo });
    }
    if (err instanceof ErrorDominio) {
      const code = err.codigo === 'NO_ENCONTRADO' ? 404 : 409;
      return res.status(code).json({ error: err.message, codigo: err.codigo });
    }
    const status = (err as { status?: number }).status;
    if (typeof status === 'number') {
      return res.status(status).json({ error: (err as Error).message });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno.' });
  });

  return app;
}
