import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

// Cifrado autenticado AES-256-GCM para secretos en reposo (p. ej. semilla TOTP).
// La clave viene de APP_ENCRYPTION_KEY (32 bytes base64). En producción: gestor
// de secretos, nunca el repositorio (ver Fase 5).
function clave(): Buffer {
  const k = Buffer.from(env.APP_ENCRYPTION_KEY, 'base64');
  if (k.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY debe ser de 32 bytes en base64.');
  }
  return k;
}

// Formato del blob: [iv(12) | tag(16) | ciphertext].
export function cifrar(texto: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', clave(), iv);
  const ct = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

export function descifrar(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', clave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
