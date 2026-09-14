import { Router, type Request, type Response, type NextFunction } from 'express';
import { conTenant } from '../db/pool.js';
import * as doc from '../domain/documentos.js';
import * as aus from '../domain/ausencias.js';
import { totalizar, jornadaDelDia } from '../domain/totalizacion.js';
import { festivosEnRango } from '../domain/calendario.js';
import { ErrorDominio } from '../domain/estructura.js';
import { requiereRol, validar, ctxDe } from './middleware.js';
import { publicarDocSchema } from '../validation/schemas.js';
import { generarNominaPDF, generarNominaParaPersona } from '../domain/export/nomina.js';

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const GESTION = ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL'];

function personaPropia(req: Request): string {
  const p = req.sesion?.personaId;
  if (!p) throw Object.assign(new Error('El usuario no tiene ficha de persona asociada.'), { status: 400 });
  return p;
}

function inicioMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function rutasPortal(): Router {
  const r = Router();

  // Panel de inicio del empleado (agregado para la pantalla principal).
  r.get('/inicio', h(async (req, res) => {
    const personaId = req.sesion?.personaId;
    if (!personaId) return res.json({ sinFicha: true });
    const ctx = ctxDe(req);
    const anio = new Date().getFullYear();
    const desde = inicioMes(), hasta = hoy();
    const festivos = await conTenant(ctx, (ej) => festivosEnRango(ej, desde, hasta));
    const diasAus = await aus.diasAusenciaAprobada(ctx, personaId, desde, hasta);
    const tot = await totalizar(ctx, personaId, desde, hasta, (f) => festivos.has(f), diasAus);
    const misSol = await aus.misSolicitudes(ctx, personaId);
    res.json({
      saldoHorarioMesMin: tot.totales.saldoMin,
      diasDisponibles: await aus.saldos(ctx, personaId, anio),
      solicitudesPendientes: misSol.filter((s) => s.estado === 'SOLICITADA').length,
      documentos: (await doc.listarDocumentos(ctx, personaId)).length,
      jornadaHoy: await jornadaDelDia(ctx, personaId, hasta),
    });
  }));

  // Mis datos (autoservicio, solo lectura).
  r.get('/mis-datos', h(async (req, res) => {
    const personaId = personaPropia(req);
    const datos = await conTenant(ctxDe(req), async (ej) => {
      const p = (await ej.query('SELECT id, tipo_documento, num_documento, nombre, apellido1, apellido2, email_corp, telefono FROM persona WHERE id = $1', [personaId])).rows[0];
      const puesto = (await ej.query(
        `SELECT pu.denominacion AS puesto, u.denominacion AS unidad, pu.nivel_cd,
                rs.tipo_codigo, rs.situacion_codigo, rs.toma_posesion
           FROM relacion_servicio rs
           JOIN puesto pu ON pu.id = rs.puesto_id
           JOIN unidad_organica u ON u.id = pu.unidad_id
          WHERE rs.persona_id = $1 AND rs.cese IS NULL
          ORDER BY rs.toma_posesion DESC LIMIT 1`, [personaId])).rows[0] ?? null;
      return { persona: p, puesto };
    });
    res.json(datos);
  }));

  // Documentos del empleado (metadatos).
  r.get('/documentos', h(async (req, res) =>
    res.json(await doc.listarDocumentos(ctxDe(req), personaPropia(req)))));

  // Descarga con acuse.
  r.get('/documentos/:id/descargar', h(async (req, res) => {
    const d = await doc.descargarDocumento(ctxDe(req), String(req.params.id), personaPropia(req), req.ip ?? null);
    res.setHeader('Content-Type', d.mime);
    res.setHeader('X-Integridad-SHA256', d.sha256);
    res.setHeader('Content-Disposition', `attachment; filename="${d.nombre_fichero}"`);
    res.send(d.contenido);
  }));

  // Publicación de documentos (gestión). Admite base64 (p. ej. nóminas en PDF).
  r.post('/documentos', requiereRol(...GESTION), validar(publicarDocSchema), h(async (req, res) => {
    const { contenidoBase64, ...meta } = req.body;
    const publicado = await doc.publicarDocumento(ctxDe(req), {
      ...meta, contenido: Buffer.from(contenidoBase64, 'base64'),
    });
    res.status(201).json(publicado);
  }));

  // Acuses de un documento (gestión).
  r.get('/documentos/:id/acuses', requiereRol(...GESTION), h(async (req, res) =>
    res.json(await doc.acusesDocumento(ctxDe(req), String(req.params.id)))));

  // Listado de documentos de una persona concreta (gestión).
  r.get('/admin/documentos', requiereRol(...GESTION), h(async (req, res) =>
    res.json(await doc.listarDocumentos(ctxDe(req), String(req.query.personaId)))));

  // Descarga para gestor (auditoría / consulta).
  r.get('/admin/documentos/:id/descargar', requiereRol(...GESTION), h(async (req, res) => {
    const d = await conTenant(ctxDe(req), async (ej) => {
      const resp = await ej.query<{ nombre_fichero: string; mime: string; contenido: Buffer; sha256: string }>(
        'SELECT nombre_fichero, mime, contenido, sha256 FROM documento_personal WHERE id = $1',
        [req.params.id],
      );
      if (!resp.rows[0]) throw new ErrorDominio('NO_ENCONTRADO', 'Documento no encontrado.');
      return resp.rows[0];
    });
    res.setHeader('Content-Type', d.mime);
    res.setHeader('X-Integridad-SHA256', d.sha256);
    res.setHeader('Content-Disposition', `attachment; filename="${d.nombre_fichero}"`);
    res.send(d.contenido);
  }));

  // Modelo de recibo de salarios en PDF, con importes de ejemplo y marcado como
  // tal (cualquier usuario autenticado). Sirve para ver el formato.
  r.get('/documentos/nomina-ejemplo/modelo', h(async (_req, res) => {
    const pdf = await generarNominaPDF();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="modelo_recibo_salarios_ejemplo.pdf"');
    res.send(pdf);
  }));

  // Genera y publica una nómina para un empleado (gestión). Ojo: los importes no
  // se calculan; si no se aportan, el PDF sale con cifras ficticias y así marcado.
  r.post('/documentos/generar-nomina', requiereRol(...GESTION), h(async (req, res) => {
    const personaId = String(req.body?.personaId);
    if (!personaId) {
      return res.status(400).json({ error: 'Falta personaId' });
    }
    const ctx = ctxDe(req);
    const { buffer, nombreFichero, titulo } = await generarNominaParaPersona(ctx, personaId, {
      mes: req.body?.mes,
      anio: req.body?.anio ? Number(req.body.anio) : undefined,
    });
    const publicado = await doc.publicarDocumento(ctx, {
      personaId,
      tipo: 'NOMINA',
      titulo,
      nombreFichero,
      mime: 'application/pdf',
      contenido: buffer,
    });
    res.status(201).json(publicado);
  }));

  return r;
}
