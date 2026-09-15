import { Router, type Request, type Response, type NextFunction } from 'express';
import * as aus from '../domain/ausencias.js';
import { listarFestivos, crearFestivo } from '../domain/calendario.js';
import { requiereRol, validar, ctxDe } from './middleware.js';
import {
  alcanceDe, unidadesDelAlcance, exigirMandoSobrePersona, exigirMandoSobreUnidad,
} from './alcance.js';
import {
  solicitudSchema, denegarSchema, festivoSchema, tipoAusenciaUpdateSchema, asignarSaldoSchema,
} from '../validation/schemas.js';

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const GESTION = ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL'];
const APRUEBAN = ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL', 'RESPONSABLE_UNIDAD'];

function personaPropia(req: Request): string {
  const p = req.sesion?.personaId;
  if (!p) throw Object.assign(new Error('El usuario no tiene ficha de persona asociada.'), { status: 400 });
  return p;
}
/**
 * Unidades sobre las que este usuario resuelve ausencias.
 * `null` = toda la entidad (administración y gestión de personal).
 * Lista vacía = ninguna: un responsable sin unidad asignada no resuelve nada.
 */
async function unidadesQueResuelve(req: Request): Promise<string[] | null> {
  const alcance = alcanceDe(req);
  if (alcance.tipo === 'ENTIDAD') return null;
  return unidadesDelAlcance(req, alcance);
}

export function rutasAusencias(): Router {
  const r = Router();

  // Catálogo de tipos (motor de reglas).
  r.get('/tipos', h(async (req, res) => res.json(await aus.listarTipos(ctxDe(req)))));
  r.post('/tipos/precargar', requiereRol(...GESTION), h(async (req, res) =>
    res.status(201).json(await aus.precargarCatalogo(ctxDe(req)))));
  r.patch('/tipos/:id', requiereRol(...GESTION), validar(tipoAusenciaUpdateSchema), h(async (req, res) =>
    res.json(await aus.actualizarTipo(ctxDe(req), String(req.params.id), req.body))));

  // Calendario laboral.
  r.get('/festivos', h(async (req, res) =>
    res.json(await listarFestivos(ctxDe(req), Number(req.query.anio) || new Date().getFullYear()))));
  r.post('/festivos', requiereRol(...GESTION), validar(festivoSchema), h(async (req, res) =>
    res.status(201).json(await crearFestivo(ctxDe(req), req.body))));

  // Saldos.
  r.get('/saldos', h(async (req, res) => {
    const pedida = (req.query.personaId as string | undefined) || undefined;
    // El saldo de un tercero solo lo ve quien tiene competencia sobre él.
    if (pedida) await exigirMandoSobrePersona(req, pedida);
    const personaId = pedida ?? personaPropia(req);
    res.json(await aus.saldos(ctxDe(req), personaId, Number(req.query.anio) || new Date().getFullYear()));
  }));
  r.put('/saldos', requiereRol(...GESTION), validar(asignarSaldoSchema), h(async (req, res) =>
    res.status(200).json(await aus.asignarSaldo(ctxDe(req), req.body))));

  // Solicitudes (empleado).
  r.get('/solicitudes/mias', h(async (req, res) =>
    res.json(await aus.misSolicitudes(ctxDe(req), personaPropia(req)))));
  r.post('/solicitudes', validar(solicitudSchema), h(async (req, res) =>
    res.status(201).json(await aus.solicitar(ctxDe(req), { personaId: personaPropia(req), ...req.body }))));
  r.post('/solicitudes/:id/cancelar', h(async (req, res) =>
    res.json(await aus.cancelar(ctxDe(req), String(req.params.id), personaPropia(req)))));

  // Flujo de aprobación (responsable / gestión).
  r.get('/solicitudes/pendientes', requiereRol(...APRUEBAN), h(async (req, res) =>
    res.json(await aus.pendientesUnidad(ctxDe(req), await unidadesQueResuelve(req)))));

  // Resolver exige competencia sobre la persona, no solo tener el rol: filtrar
  // el listado no basta cuando aquí se entra por identificador.
  r.post('/solicitudes/:id/aprobar', requiereRol(...APRUEBAN), h(async (req, res) => {
    const id = String(req.params.id);
    await exigirMandoSobrePersona(req, await aus.personaDeSolicitud(ctxDe(req), id));
    res.json(await aus.aprobar(ctxDe(req), id));
  }));
  r.post('/solicitudes/:id/denegar', requiereRol(...APRUEBAN), validar(denegarSchema), h(async (req, res) => {
    const id = String(req.params.id);
    await exigirMandoSobrePersona(req, await aus.personaDeSolicitud(ctxDe(req), id));
    res.json(await aus.denegar(ctxDe(req), id, req.body.motivo));
  }));

  // Calendario de equipo (para ver solapes antes de aprobar).
  r.get('/equipo/:unidadId', requiereRol(...APRUEBAN), h(async (req, res) => {
    const unidadId = String(req.params.unidadId);
    await exigirMandoSobreUnidad(req, unidadId);
    res.json(await aus.calendarioEquipo(ctxDe(req), unidadId,
      String(req.query.desde), String(req.query.hasta)));
  }));

  return r;
}
