import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setToken, getToken, EVENTO_SESION_CADUCADA } from './api';

export interface Rol { rol: string; unidadId: string | null }
interface Yo { entidadId: string; usuarioId: string; personaId: string | null; roles: Rol[] }

interface AuthCtx {
  caducada: boolean;
  yo: Yo | null;
  cargando: boolean;
  entrar: (cif: string, email: string, password: string, totp?: string) => Promise<void>;
  salir: () => Promise<void>;
  tieneRol: (...roles: string[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [yo, setYo] = useState<Yo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [caducada, setCaducada] = useState(false);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try { setYo(await api.get<Yo>('/auth/yo')); } catch { setToken(null); }
      }
      setCargando(false);
    })();
  }, []);

  // Si el servidor rechaza la sesión (expiración o inactividad), se sale del
  // área privada y se avisa, en lugar de dejar la pantalla fallando.
  useEffect(() => {
    const alCaducar = () => { setYo((actual) => { if (actual) setCaducada(true); return null; }); };
    window.addEventListener(EVENTO_SESION_CADUCADA, alCaducar);
    return () => window.removeEventListener(EVENTO_SESION_CADUCADA, alCaducar);
  }, []);

  const entrar = async (cif: string, email: string, password: string, totp?: string) => {
    const r = await api.post<{ token: string }>('/auth/login', { cif, email, password, ...(totp ? { totp } : {}) });
    setToken(r.token);
    setCaducada(false);
    setYo(await api.get<Yo>('/auth/yo'));
  };

  const salir = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setToken(null);
    setYo(null);
  };

  const valor = useMemo<AuthCtx>(() => ({
    yo, cargando, caducada, entrar, salir,
    tieneRol: (...roles) => !!yo?.roles.some((r) => roles.includes(r.rol)),
  }), [yo, cargando, caducada]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}
