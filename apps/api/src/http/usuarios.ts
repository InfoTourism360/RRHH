import { Router, type Request, type Response, type NextFunction } from 'express';
import { conTenant } from '../db/pool.js';
import * as usr from '../domain/usuarios.js';
import { establecerPin } from '../auth/service.js';
import { ErrorDominio } from '../domain/estructura.js';
import { requiereRol, validar, ctxDe } from './middleware.js';
import {
  usuarioSchema, rolesSchema, passwordResetSchema, estadoUsuarioSchema, pinSchema,
} from '../validation/schemas.js';

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/**
 * Comprueba que el usuario destino pertenece a la entidad de la sesión.
 * Necesario antes de cualquier operación que use el pool propietario (que no
 * pasa por RLS): sin esto, un administrador podría tocar usuarios de otra
 * entidad conociendo su identificador.
 */
async function verificarMismaEntidad(req: Request, usuarioId: string): Promise<void> {
  const existe = await conTenant(ctxDe(req), async (ej) => {
    const r = await ej.query('SELECT 1 FROM usuario WHERE id = $1', [usuarioId]);
    return (r.rowCount ?? 0) > 0;
  });
  if (!existe) throw new ErrorDominio('NO_ENCONTRADO', 'Usuario no encontrado.');
}

export function rutasUsuarios(): Router {
  const r = Router();

  // Repartir accesos es competencia exclusiva del administrador de la entidad.
  r.use(requiereRol('ADMIN_ENTIDAD'));

  r.get('/roles', h(async (req, res) => res.json(await usr.listarRoles(ctxDe(req)))));

  r.get('/', h(async (req, res) => res.json(await usr.listarUsuarios(ctxDe(req)))));

  r.post('/', validar(usuarioSchema), h(async (req, res) =>
    res.status(201).json(await usr.crearUsuario(ctxDe(req), req.body))));

  r.patch('/:id/estado', validar(estadoUsuarioSchema), h(async (req, res) =>
    res.json(await usr.cambiarEstado(ctxDe(req), String(req.params.id), req.body.activo, req.body.motivo))));

  r.put('/:id/password', validar(passwordResetSchema), h(async (req, res) =>
    res.json(await usr.restablecerPassword(ctxDe(req), String(req.params.id), req.body.password))));

  r.put('/:id/roles', validar(rolesSchema), h(async (req, res) =>
    res.json(await usr.fijarRoles(ctxDe(req), String(req.params.id), req.body.roles))));

  // PIN de quiosco de otra persona: se valida la entidad antes de tocarlo.
  r.put('/:id/pin', validar(pinSchema), h(async (req, res) => {
    const id = String(req.params.id);
    await verificarMismaEntidad(req, id);
    await establecerPin(id, req.body.pin);
    res.status(204).end();
  }));

  return r;
}
