import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { resolverSesion, type SesionActiva } from '../auth/service.js';
import { registrarActividad } from '../domain/registroActividad.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sesion?: SesionActiva;
    }
  }
}

/** Exige sesión válida (Bearer) y adjunta el contexto de tenant a la request. */
export async function requiereSesion(req: Request, res: Response, next: NextFunction) {
  const auth = req.header('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado.' });
  const sesion = await resolverSesion(token);
  if (!sesion) return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  req.sesion = sesion;
  next();
}

/** Exige que la sesión tenga alguno de los roles indicados (segregación de funciones). */
export function requiereRol(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tiene = req.sesion?.roles.some((r) => roles.includes(r.rol));
    if (!tiene) return res.status(403).json({ error: 'Permisos insuficientes.' });
    next();
  };
}

/** Valida el body con un esquema zod y lo sustituye por el dato ya tipado. */
export function validar(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: r.error.flatten() });
    }
    req.body = r.data;
    next();
  };
}

/** Devuelve el contexto de tenant desde la sesión de la request. */
export function ctxDe(req: Request) {
  return { entidadId: req.sesion!.entidadId, usuarioId: req.sesion!.usuarioId };
}

/**
 * Registro de actividad (ENS): traza cada petición al finalizar la respuesta.
 * No bloquea la petición. Omite el chequeo de salud para no ensuciar el log.
 */
export function registroActividad(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/salud') return next();

  // La ruta se fija AQUÍ, a la entrada, y a partir de `originalUrl`.
  //
  // `req.path` no sirve: al entrar en un router montado, Express recorta el
  // prefijo de `req.url` y lo repone al salir, así que lo que se registraba
  // dependía de en qué punto de la pila se hubiera respondido. El alta de un
  // usuario quedaba como "POST /" y el quiosco aparecía unas veces como
  // /quiosco/fichar y otras como /horario/quiosco/fichar. Un registro de
  // actividad en el que no se distingue qué se hizo no sostiene una inspección.
  //
  // Se corta la cadena de consulta: lleva identificadores de personas y el
  // registro no es sitio donde acumularlos.
  const ruta = (req.originalUrl || req.url).split('?')[0] || '/';
  const esLogin = ruta === '/auth/login';

  res.on('finish', () => {
    const accion = esLogin
      ? (res.statusCode < 400 ? 'LOGIN_OK' : 'LOGIN_FALLO')
      : (req.method === 'GET' ? 'ACCESO' : 'CAMBIO');
    void registrarActividad({
      entidadId: req.sesion?.entidadId ?? null,
      usuarioId: req.sesion?.usuarioId ?? null,
      accion,
      metodo: req.method,
      ruta,
      estadoHttp: res.statusCode,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
    });
  });
  next();
}
