import { describe, it, expect, beforeEach } from 'vitest';
import { limitarPorOrigen, reiniciarLimites } from '../src/http/limites.js';

type Req = { ip: string };
type Res = {
  statusCode: number; cuerpo: unknown; cabeceras: Record<string, string>;
  status: (c: number) => Res; json: (b: unknown) => Res; setHeader: (k: string, v: string) => void;
};

function resFalso(): Res {
  const r: Res = {
    statusCode: 200, cuerpo: null, cabeceras: {},
    status(c) { r.statusCode = c; return r; },
    json(b) { r.cuerpo = b; return r; },
    setHeader(k, v) { r.cabeceras[k] = v; },
  };
  return r;
}

// Ejecuta el middleware y dice si dejó pasar la petición.
function pasa(mw: ReturnType<typeof limitarPorOrigen>, ip: string): { ok: boolean; res: Res } {
  const res = resFalso();
  let siguiente = false;
  mw({ ip } as unknown as Parameters<typeof mw>[0], res as unknown as Parameters<typeof mw>[1], () => { siguiente = true; });
  return { ok: siguiente, res };
}

describe('Limitación de peticiones por origen', () => {
  beforeEach(() => reiniciarLimites());

  it('deja pasar hasta el máximo y luego responde 429', () => {
    const mw = limitarPorOrigen({ nombre: 'prueba', ventanaMs: 60_000, maximo: 3 });
    expect(pasa(mw, '10.0.0.1').ok).toBe(true);
    expect(pasa(mw, '10.0.0.1').ok).toBe(true);
    expect(pasa(mw, '10.0.0.1').ok).toBe(true);

    const cuarto = pasa(mw, '10.0.0.1');
    expect(cuarto.ok).toBe(false);
    expect(cuarto.res.statusCode).toBe(429);
    expect(cuarto.res.cabeceras['Retry-After']).toBeTruthy();
    expect((cuarto.res.cuerpo as { codigo: string }).codigo).toBe('DEMASIADAS_PETICIONES');
  });

  it('el contador es por origen: un abusón no bloquea a los demás', () => {
    const mw = limitarPorOrigen({ nombre: 'prueba', ventanaMs: 60_000, maximo: 2 });
    pasa(mw, '10.0.0.1'); pasa(mw, '10.0.0.1');
    expect(pasa(mw, '10.0.0.1').ok).toBe(false);
    expect(pasa(mw, '10.0.0.2').ok).toBe(true);
  });

  it('cubos distintos no comparten contador', () => {
    const login = limitarPorOrigen({ nombre: 'login', ventanaMs: 60_000, maximo: 1 });
    const quiosco = limitarPorOrigen({ nombre: 'quiosco', ventanaMs: 60_000, maximo: 1 });
    expect(pasa(login, '10.0.0.3').ok).toBe(true);
    expect(pasa(login, '10.0.0.3').ok).toBe(false);
    expect(pasa(quiosco, '10.0.0.3').ok).toBe(true);
  });
});
