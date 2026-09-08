import 'dotenv/config';
import { z } from 'zod';

// Todo el producto opera en Europe/Madrid; fijamos la TZ del proceso para que
// los cómputos de jornada (agrupación por día) sean coherentes en cualquier host.
process.env.TZ = 'Europe/Madrid';

// Validación estricta de la configuración de entorno al arrancar.
const schema = z.object({
  DATABASE_URL_OWNER: z.string().url(),
  DATABASE_URL_APP: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SESSION_TTL_HORAS: z.coerce.number().int().positive().default(8),
  SESSION_INACTIVIDAD_MINUTOS: z.coerce.number().int().positive().default(30),
  MAX_INTENTOS_LOGIN: z.coerce.number().int().positive().default(5),
  BLOQUEO_MINUTOS: z.coerce.number().int().positive().default(15),
  APP_ENCRYPTION_KEY: z.string().min(1),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuración de entorno inválida:', parsed.error.flatten().fieldErrors);
  throw new Error('Variables de entorno inválidas. Revisa tu .env (ver .env.example).');
}

export const env = parsed.data;
