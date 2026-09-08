import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setToken, getToken } from './api';

export interface Rol { rol: string; unidadId: string | null }
interface Yo { entidadId: string; usuarioId: string; personaId: string | null; roles: Rol[] }

interface AuthCtx {
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

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try { setYo(await api.get<Yo>('/auth/yo')); } catch { setToken(null); }
      }
      setCargando(false);
    })();
  }, []);

  const entrar = async (cif: string, email: string, password: string, totp?: string) => {
    const r = await api.post<{ token: string }>('/auth/login', { cif, email, password, ...(totp ? { totp } : {}) });
    setToken(r.token);
    setYo(await api.get<Yo>('/auth/yo'));
  };

  const salir = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setToken(null);
    setYo(null);
  };

  const valor = useMemo<AuthCtx>(() => ({
    yo, cargando, entrar, salir,
    tieneRol: (...roles) => !!yo?.roles.some((r) => roles.includes(r.rol)),
  }), [yo, cargando]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}
