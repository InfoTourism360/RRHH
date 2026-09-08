import { createHash } from 'node:crypto';
import { conTenant, type Contexto } from '../db/pool.js';
import { registrarAuditoria } from '../db/auditoria.js';
import { ErrorDominio } from './estructura.js';

export interface PublicarInput {
  personaId: string;
  tipo: 'NOMINA' | 'CERTIFICADO' | 'COMUNICACION' | 'OTRO';
  titulo: string;
  nombreFichero: string;
  mime?: string;
  contenido: Buffer;
}

export function publicarDocumento(ctx: Contexto, d: PublicarInput) {
  return conTenant(ctx, async (ej) => {
    const sha = createHash('sha256').update(d.contenido).digest('hex');
    const r = await ej.query(
      `INSERT INTO documento_personal
         (entidad_id, persona_id, tipo, titulo, nombre_fichero, mime, contenido, sha256, publicado_por)
       VALUES (app_entidad_id(),$1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, persona_id, tipo, titulo, nombre_fichero, mime, sha256, publicado_en`,
      [d.personaId, d.tipo, d.titulo, d.nombreFichero, d.mime ?? 'application/pdf',
       d.contenido, sha, ctx.usuarioId ?? null],
    );
    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'PUBLICAR_DOC', tabla: 'documento_personal', registroId: r.rows[0]!.id as string,
      datosDespues: r.rows[0], usuarioId: ctx.usuarioId,
    });
    return r.rows[0]!;
  });
}

// Lista metadatos (sin el binario) de los documentos de una persona.
export function listarDocumentos(ctx: Contexto, personaId: string) {
  return conTenant(ctx, async (ej) =>
    (await ej.query(
      `SELECT d.id, d.tipo, d.titulo, d.nombre_fichero, d.mime, d.sha256, d.publicado_en,
              (SELECT max(descargado_en) FROM descarga_documento x WHERE x.documento_id = d.id) AS ultima_descarga
         FROM documento_personal d
        WHERE d.persona_id = $1 ORDER BY d.publicado_en DESC`,
      [personaId])).rows);
}

/** Descarga el binario y registra el acuse (append-only). */
export function descargarDocumento(ctx: Contexto, documentoId: string, personaId: string, ip?: string | null) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query<{ persona_id: string; nombre_fichero: string; mime: string; contenido: Buffer; sha256: string }>(
      'SELECT persona_id, nombre_fichero, mime, contenido, sha256 FROM documento_personal WHERE id = $1',
      [documentoId],
    );
    const doc = r.rows[0];
    if (!doc) throw new ErrorDominio('NO_ENCONTRADO', 'Documento no encontrado.');
    if (doc.persona_id !== personaId) throw new ErrorDominio('NO_AUTORIZADO', 'No es tu documento.');
    await ej.query(
      `INSERT INTO descarga_documento (entidad_id, documento_id, persona_id, ip)
       VALUES (app_entidad_id(),$1,$2,$3)`,
      [documentoId, personaId, ip ?? null],
    );
    return doc;
  });
}

// Acuses de un documento (para el gestor).
export function acusesDocumento(ctx: Contexto, documentoId: string) {
  return conTenant(ctx, async (ej) =>
    (await ej.query(
      'SELECT descargado_en, ip FROM descarga_documento WHERE documento_id = $1 ORDER BY descargado_en',
      [documentoId])).rows);
}
