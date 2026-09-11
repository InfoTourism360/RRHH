// Cliente HTTP mínimo. El token de sesión se guarda en localStorage y se envía
// como Bearer. Base '/api' (proxy de Vite hacia el backend en desarrollo).
const BASE = '/api';
const CLAVE_TOKEN = 'rrhh_token';

export function getToken(): string | null {
  try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
}
export function setToken(t: string | null): void {
  try { t ? localStorage.setItem(CLAVE_TOKEN, t) : localStorage.removeItem(CLAVE_TOKEN); } catch { /* ignore */ }
}

/** Se emite cuando el servidor rechaza la sesión: la app vuelve al login. */
export const EVENTO_SESION_CADUCADA = 'rrhh:sesion-caducada';

export class ApiError extends Error {
  constructor(public status: number, mensaje: string, public codigo?: string) { super(mensaje); }
}

async function req<T>(metodo: string, ruta: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const texto = await res.text();
  const datos = texto ? JSON.parse(texto) : undefined;
  if (!res.ok) {
    if (res.status === 401) {
      // Antes solo se borraba el token en silencio: el usuario se quedaba en una
      // pantalla que fallaba sin explicar nada hasta recargar a mano.
      setToken(null);
      window.dispatchEvent(new CustomEvent(EVENTO_SESION_CADUCADA));
    }
    throw new ApiError(res.status, datos?.error ?? 'Error de red', datos?.codigo);
  }
  return datos as T;
}

export const api = {
  get: <T>(ruta: string) => req<T>('GET', ruta),
  post: <T>(ruta: string, body?: unknown) => req<T>('POST', ruta, body),
  put: <T>(ruta: string, body?: unknown) => req<T>('PUT', ruta, body),
  patch: <T>(ruta: string, body?: unknown) => req<T>('PATCH', ruta, body),
};

// Descarga binaria (informes, documentos) respetando el token.
export async function descargar(ruta: string, nombre: string): Promise<void> {
  const token = getToken();
  const res = await fetch(BASE + ruta, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'No se pudo descargar');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
