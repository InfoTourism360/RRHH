-- =============================================================================
-- 0004_control_horario.sql — Fichaje inmutable, correcciones y notificaciones.
-- El registro de jornada sigue el MISMO patrón append-only que auditoria: el
-- fichaje original NUNCA se modifica ni borra; las correcciones son eventos
-- nuevos que referencian al original con motivo obligatorio y autor.
-- =============================================================================

-- PIN de quiosco (identificación PIN + credencial; NUNCA biometría).
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS pin_hash text;

-- Rol de Representación Legal de los Trabajadores: consulta AGREGADA de jornada.
INSERT INTO rol (codigo, denominacion)
VALUES ('RLT','Representación legal de los trabajadores')
ON CONFLICT (codigo) DO NOTHING;

-- Evento de fichaje. Inmutable.
CREATE TABLE fichaje_evento (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id        uuid NOT NULL REFERENCES entidad(id),
  persona_id        uuid NOT NULL REFERENCES persona(id),
  tipo              text NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA','INICIO_PAUSA','FIN_PAUSA')),
  origen            text NOT NULL CHECK (origen IN ('WEB','MOVIL','QUIOSCO','CORRECCION')),
  -- Momento oficial (reloj del servidor) y momento declarado por el cliente.
  momento_servidor  timestamptz NOT NULL DEFAULT now(),
  momento_cliente   timestamptz,
  -- Corrección: referencia al evento original + acción + motivo OBLIGATORIO.
  corrige_evento_id uuid REFERENCES fichaje_evento(id),
  accion_correccion text CHECK (accion_correccion IN ('MODIFICA','ANULA','ANADE')),
  motivo            text,
  autor_usuario_id  uuid REFERENCES usuario(id),
  -- Geocerca: validación PUNTUAL en el momento del fichaje (nunca continua).
  geo_lat           numeric(9,6),
  geo_lon           numeric(9,6),
  geo_dentro        boolean,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  -- Toda corrección debe indicar acción y motivo; un evento normal no.
  CHECK ( (origen = 'CORRECCION') = (accion_correccion IS NOT NULL) ),
  CHECK ( origen <> 'CORRECCION' OR (motivo IS NOT NULL AND length(btrim(motivo)) > 0) ),
  -- MODIFICA/ANULA referencian un original; ANADE no.
  CHECK ( accion_correccion IS NULL
          OR (accion_correccion IN ('MODIFICA','ANULA') AND corrige_evento_id IS NOT NULL)
          OR (accion_correccion = 'ANADE' AND corrige_evento_id IS NULL) )
);
COMMENT ON TABLE fichaje_evento IS 'Registro de jornada append-only (RD registro horario digital). Correcciones = eventos nuevos que referencian al original.';

CREATE INDEX ix_fichaje_persona_dia ON fichaje_evento (entidad_id, persona_id, momento_servidor);

CREATE TRIGGER trg_fichaje_inmutable
  BEFORE UPDATE OR DELETE ON fichaje_evento
  FOR EACH ROW EXECUTE FUNCTION impedir_modificacion();

-- Notificaciones al empleado (p. ej. corrección sobre sus fichajes).
CREATE TABLE notificacion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id   uuid NOT NULL REFERENCES entidad(id),
  persona_id   uuid NOT NULL REFERENCES persona(id),
  tipo         text NOT NULL,
  mensaje      text NOT NULL,
  datos        jsonb NOT NULL DEFAULT '{}'::jsonb,
  leida_en     timestamptz,
  creado_en    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notificacion_persona ON notificacion (entidad_id, persona_id, leida_en);

-- ---- Privilegios y RLS de las nuevas tablas de tenant ----
GRANT SELECT, INSERT ON fichaje_evento TO rrhh_app;         -- append-only
GRANT SELECT, INSERT, UPDATE ON notificacion TO rrhh_app;   -- UPDATE solo para marcar leída
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rrhh_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fichaje_evento','notificacion'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY p_%1$s_tenant ON %1$I
        USING (entidad_id = app_entidad_id())
        WITH CHECK (entidad_id = app_entidad_id())
    $f$, t);
  END LOOP;
END $$;
