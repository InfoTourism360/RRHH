import { hash, verify, Algorithm } from '@node-rs/argon2';

// Parámetros Argon2id razonables para servidor (OWASP). El algoritmo y los
// parámetros quedan embebidos en el propio hash resultante.
const OPCIONES = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashearPassword(plano: string): Promise<string> {
  return hash(plano, OPCIONES);
}

export async function verificarPassword(hashGuardado: string, plano: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, plano);
  } catch {
    return false;
  }
}
