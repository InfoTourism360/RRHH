import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { resolverSesion, type SesionActiva } from '../auth/service.js';

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
