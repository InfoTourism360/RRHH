-- =============================================================================
-- 0006_documentos.sql — Repositorio documental del empleado con acuse de descarga.
-- El gestor publica documentación personal (incluidos recibos de nómina en PDF
-- importados del sistema de nómina externo). Cada descarga deja acuse.
-- =============================================================================

CREATE TABLE documento_personal (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id     uuid NOT NULL REFERENCES entidad(id),
  persona_id     uuid NOT NULL REFERENCES persona(id),
  tipo           text NOT NULL CHECK (tipo IN ('NOMINA','CERTIFICADO','COMUNICACION','OTRO')),
  titulo         text NOT NULL,
  nombre_fichero text NOT NULL,
  mime           text NOT NULL DEFAULT 'application/pdf',
  contenido      bytea NOT NULL,
  sha256         text NOT NULL,
  publicado_por  uuid REFERENCES usuario(id),
  publicado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_documento_persona ON documento_personal (entidad_id, persona_id, publicado_en);

-- Acuse de descarga: prueba de que la persona accedió al documento.
CREATE TABLE descarga_documento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id    uuid NOT NULL REFERENCES entidad(id),
  documento_id  uuid NOT NULL REFERENCES documento_personal(id),
  persona_id    uuid NOT NULL REFERENCES persona(id),
  descargado_en timestamptz NOT NULL DEFAULT now(),
  ip            inet
);
CREATE INDEX ix_descarga_documento ON descarga_documento (entidad_id, documento_id);

GRANT SELECT, INSERT ON documento_personal TO rrhh_app;   -- sin UPDATE/DELETE
GRANT SELECT, INSERT ON descarga_documento TO rrhh_app;   -- acuse append-only
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rrhh_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documento_personal','descarga_documento'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY p_%1$s_tenant ON %1$I
        USING (entidad_id = app_entidad_id())
        WITH CHECK (entidad_id = app_entidad_id())
    $f$, t);
  END LOOP;
END $$;
