import express, { type Request, type Response, type NextFunction } from 'express';
import { login, logout, ErrorAuth } from '../auth/service.js';
import { ErrorDominio } from '../domain/estructura.js';
import * as est from '../domain/estructura.js';
import { ctxDe, requiereRol, requiereSesion, validar } from './middleware.js';
import { rutasHorario } from './horario.js';
import { rutasAusencias } from './ausencias.js';
import {
  cambioSituacionSchema, ceseSchema, loginSchema, personaSchema,
  plazaSchema, puestoSchema, relacionSchema, unidadSchema,
} from '../validation/schemas.js';

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const GESTION = ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL'];

export function crearApp() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/salud', (_req, res) => res.json({ ok: true }));

  // ------------------------------ AUTH -------------------------------------
  app.post('/auth/login', validar(loginSchema), h(async (req, res) => {
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

  // -------------------------- CONTROL HORARIO ------------------------------
  app.use('/horario', rutasHorario());

  // ------------------------ VACACIONES Y PERMISOS --------------------------
  app.use('/ausencias', requiereSesion, rutasAusencias());

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
