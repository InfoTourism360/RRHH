import { createHash, randomBytes } from 'node:crypto';

// Token de sesión opaco. Al cliente se le entrega el token en claro una vez;
// en base de datos solo guardamos su hash (si se filtra la BD, no sirve).
export function nuevoToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
