import { conTenant, type Contexto } from '../db/pool.js';
import { registrarAuditoria } from '../db/auditoria.js';
import { ErrorDominio } from './estructura.js';
import { distanciaMetros, leerPoliticas, minutosTeoricos } from './jornada.js';

export type TipoFichaje = 'ENTRADA' | 'SALIDA' | 'INICIO_PAUSA' | 'FIN_PAUSA';
export type OrigenFichaje = 'WEB' | 'MOVIL' | 'QUIOSCO';

export interface FicharInput {
  personaId: string;
  tipo: TipoFichaje;
  origen: OrigenFichaje;
  momentoCliente?: string | null;
  geo?: { lat: number; lon: number } | null;
}

/** Registra un fichaje inmutable. Valida geocerca puntual si la entidad la activa. */
export function fichar(ctx: Contexto, d: FicharInput) {
  return conTenant(ctx, async (ej) => {
    const pol = await leerPoliticas(ej, ctx.entidadId);
    let geoDentro: boolean | null = null;
    if (pol.geocerca.activa && d.geo && pol.geocerca.lat != null && pol.geocerca.lon != null) {
      const dist = distanciaMetros(d.geo.lat, d.geo.lon, pol.geocerca.lat, pol.geocerca.lon);
      geoDentro = dist <= (pol.geocerca.radioMetros ?? 150);
    }
    const r = await ej.query(
      `INSERT INTO fichaje_evento
         (entidad_id, persona_id, tipo, origen, momento_cliente, geo_lat, geo_lon, geo_dentro)
       VALUES (app_entidad_id(), $1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.personaId, d.tipo, d.origen, d.momentoCliente ?? null,
       d.geo?.lat ?? null, d.geo?.lon ?? null, geoDentro],
    );
    return r.rows[0]!;
  });
}

export interface CorreccionInput {
  accion: 'MODIFICA' | 'ANULA' | 'ANADE';
  corrigeEventoId?: string | null;
  personaId?: string | null; // requerido en ANADE
  tipo?: TipoFichaje | null; // requerido en MODIFICA/ANADE
  momentoCliente?: string | null; // el momento CORREGIDO (MODIFICA/ANADE)
  motivo: string;
}

/**
 * Corrige un fichaje SIN tocar el original: inserta un evento de corrección que
 * lo referencia, con motivo obligatorio y autor. Notifica a la persona afectada
 * y deja traza en el log de auditoría.
 */
export function corregirFichaje(ctx: Contexto, d: CorreccionInput) {
  return conTenant(ctx, async (ej) => {
    let personaId = d.personaId ?? null;
    let tipo = d.tipo ?? null;

    if (d.accion === 'MODIFICA' || d.accion === 'ANULA') {
      if (!d.corrigeEventoId) throw new ErrorDominio('FALTA_ORIGINAL', 'Se requiere el fichaje original.');
      const orig = await ej.query<{ persona_id: string; tipo: TipoFichaje }>(
        `SELECT persona_id, tipo FROM fichaje_evento WHERE id = $1`,
        [d.corrigeEventoId],
      );
      if (!orig.rows[0]) throw new ErrorDominio('NO_ENCONTRADO', 'Fichaje original no encontrado.');
      personaId = orig.rows[0].persona_id;
      if (d.accion === 'MODIFICA') tipo = d.tipo ?? orig.rows[0].tipo;
      else tipo = orig.rows[0].tipo; // ANULA conserva el tipo del original
    } else {
      // ANADE
      if (!personaId || !tipo) throw new ErrorDominio('DATOS_INCOMPLETOS', 'ANADE requiere persona y tipo.');
    }

    const r = await ej.query(
      `INSERT INTO fichaje_evento
         (entidad_id, persona_id, tipo, origen, momento_cliente, corrige_evento_id,
          accion_correccion, motivo, autor_usuario_id)
       VALUES (app_entidad_id(), $1,$2,'CORRECCION',$3,$4,$5,$6,$7) RETURNING *`,
      [personaId, tipo, d.momentoCliente ?? null, d.corrigeEventoId ?? null,
       d.accion, d.motivo, ctx.usuarioId ?? null],
    );
    const correccion = r.rows[0]!;

    await ej.query(
      `INSERT INTO notificacion (entidad_id, persona_id, tipo, mensaje, datos)
       VALUES (app_entidad_id(), $1, 'FICHAJE_CORREGIDO', $2, $3)`,
      [personaId,
       `Se ha registrado una corrección (${d.accion}) sobre tus fichajes. Motivo: ${d.motivo}`,
       JSON.stringify({ correccionId: correccion.id, corrigeEventoId: d.corrigeEventoId ?? null })],
    );

    await registrarAuditoria(ej, ctx.entidadId, {
      accion: 'CORREGIR_FICHAJE', tabla: 'fichaje_evento',
      registroId: correccion.id as string, motivo: d.motivo,
      datosDespues: correccion, usuarioId: ctx.usuarioId,
    });
    return correccion;
  });
}

export function listarFichajes(ctx: Contexto, personaId: string, desde: string, hasta: string) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `SELECT * FROM fichaje_evento
        WHERE persona_id = $1
          AND momento_servidor >= $2::date
          AND momento_servidor < ($3::date + 1)
        ORDER BY momento_servidor`,
      [personaId, desde, hasta],
    );
    return r.rows;
  });
}

export function notificacionesDe(ctx: Contexto, personaId: string) {
  return conTenant(ctx, async (ej) => {
    const r = await ej.query(
      `SELECT * FROM notificacion WHERE persona_id = $1 ORDER BY creado_en DESC LIMIT 100`,
      [personaId],
    );
    return r.rows;
  });
}
