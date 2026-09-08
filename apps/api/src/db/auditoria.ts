import { createHash } from 'node:crypto';
import type { Ejecutor } from './pool.js';

export interface EventoAuditoria {
  accion: string; // 'CREAR' | 'MODIFICAR' | 'CERRAR_VIGENCIA' | 'CORREGIR' | ...
  tabla: string;
  registroId: string;
  motivo?: string | null;
  datosAntes?: unknown;
  datosDespues?: unknown;
  usuarioId?: string | null;
}

/**
 * Inserta un evento en el log append-only encadenando su hash con el anterior
 * de la MISMA entidad (la RLS garantiza que solo veamos la cadena propia).
 * Cualquier manipulación fuera de banda rompe la cadena y es detectable.
 * Debe llamarse DENTRO de la transacción de tenant que provoca el cambio.
 */
export async function registrarAuditoria(
  ej: Ejecutor,
  entidadId: string,
  ev: EventoAuditoria,
): Promise<void> {
  const prev = await ej.query<{ hash_actual: Buffer }>(
    'SELECT hash_actual FROM auditoria ORDER BY id DESC LIMIT 1',
  );
  const hashPrev = prev.rows[0]?.hash_actual ?? null;
  const ocurridoEn = new Date().toISOString();

  const material = JSON.stringify({
    prev: hashPrev ? hashPrev.toString('hex') : null,
    entidadId,
    accion: ev.accion,
    tabla: ev.tabla,
    registroId: ev.registroId,
    ocurridoEn,
    motivo: ev.motivo ?? null,
    datosAntes: ev.datosAntes ?? null,
    datosDespues: ev.datosDespues ?? null,
  });
  const hashActual = createHash('sha256').update(material).digest();

  await ej.query(
    `INSERT INTO auditoria
       (entidad_id, ocurrido_en, usuario_id, accion, tabla, registro_id,
        motivo, datos_antes, datos_despues, hash_prev, hash_actual)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      entidadId,
      ocurridoEn,
      ev.usuarioId ?? null,
      ev.accion,
      ev.tabla,
      ev.registroId,
      ev.motivo ?? null,
      ev.datosAntes == null ? null : JSON.stringify(ev.datosAntes),
      ev.datosDespues == null ? null : JSON.stringify(ev.datosDespues),
      hashPrev,
      hashActual,
    ],
  );
}
