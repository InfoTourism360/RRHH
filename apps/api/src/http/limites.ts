import type { NextFunction, Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Limitación de peticiones por origen. El bloqueo por intentos fallidos que ya
// existe protege UNA cuenta; no impide que alguien pruebe contraseñas contra
// muchas cuentas distintas desde la misma IP, ni que machaque el endpoint.
//
// Ventana deslizante en memoria: suficiente para un despliegue de una sola
// instancia de API (el caso de una entidad local). Con varias instancias detrás
// de un balanceador habría que llevar el contador a un almacén compartido.
// ---------------------------------------------------------------------------

interface Registro { marcas: number[] }
const contadores = new Map<string, Registro>();

// Limpieza periódica para que el mapa no crezca sin fin.
const LIMPIEZA_MS = 10 * 60_000;
setInterval(() => {
  const corte = Date.now() - LIMPIEZA_MS;
  for (const [clave, r] of contadores) {
    r.marcas = r.marcas.filter((t) => t > corte);
    if (r.marcas.length === 0) contadores.delete(clave);
  }
}, LIMPIEZA_MS).unref();

export interface OpcionesLimite {
  /** Nombre del cubo, para que distintas rutas no compartan contador. */
  nombre: string;
  /** Tamaño de la ventana en milisegundos. */
  ventanaMs: number;
  /** Peticiones permitidas dentro de la ventana. */
  maximo: number;
}

export function limitarPorOrigen({ nombre, ventanaMs, maximo }: OpcionesLimite) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origen = req.ip ?? 'desconocido';
    const clave = `${nombre}:${origen}`;
    const ahora = Date.now();
    const reg = contadores.get(clave) ?? { marcas: [] };
    reg.marcas = reg.marcas.filter((t) => t > ahora - ventanaMs);

    if (reg.marcas.length >= maximo) {
      const esperaS = Math.ceil((reg.marcas[0]! + ventanaMs - ahora) / 1000);
      contadores.set(clave, reg);
      res.setHeader('Retry-After', String(esperaS));
      return res.status(429).json({
        error: `Demasiados intentos. Vuelve a probar en ${esperaS} segundos.`,
        codigo: 'DEMASIADAS_PETICIONES',
      });
    }

    reg.marcas.push(ahora);
    contadores.set(clave, reg);
    next();
  };
}

/** Solo para las pruebas: reinicia los contadores entre casos. */
export function reiniciarLimites(): void {
  contadores.clear();
}
