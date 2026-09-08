-- =============================================================================
-- 0005_ausencias.sql — Vacaciones y permisos con motor de reglas SIN CÓDIGO.
-- Cada tipo de ausencia es una fila configurable por la entidad (su acuerdo /
-- convenio). El catálogo TREBEP se precarga por entidad y es EDITABLE.
-- =============================================================================

-- Tipo de ausencia: la "regla" configurable.
CREATE TABLE tipo_ausencia (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id            uuid NOT NULL REFERENCES entidad(id),
  codigo                text NOT NULL,
  denominacion          text NOT NULL,
  base_normativa        text,
  unidad_computo        text NOT NULL CHECK (unidad_computo IN ('DIAS_NATURALES','DIAS_HABILES','HORAS')),
  devengo               text NOT NULL CHECK (devengo IN ('ANUAL','POR_HECHO')),
  consume_saldo         boolean NOT NULL DEFAULT false,
  requiere_justificante boolean NOT NULL DEFAULT false,
  requiere_preaviso     boolean NOT NULL DEFAULT false,
  dias_preaviso         smallint NOT NULL DEFAULT 0,
  aprobador             text NOT NULL DEFAULT 'RESPONSABLE_UNIDAD'
                          CHECK (aprobador IN ('RESPONSABLE_UNIDAD','GESTOR_PERSONAL','AUTOMATICO')),
  permite_solapamiento  boolean NOT NULL DEFAULT false,
  activo                boolean NOT NULL DEFAULT true,
  UNIQUE (entidad_id, codigo)
);
COMMENT ON TABLE tipo_ausencia IS 'Motor de reglas configurable por entidad. El catálogo TREBEP es precargado y editable.';

-- Calendario laboral: festivos nacionales, autonómicos y locales (por entidad).
CREATE TABLE calendario_festivo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id    uuid NOT NULL REFERENCES entidad(id),
  fecha         date NOT NULL,
  denominacion  text NOT NULL,
  ambito        text NOT NULL CHECK (ambito IN ('NACIONAL','AUTONOMICO','LOCAL')),
  UNIQUE (entidad_id, fecha, ambito)
);

-- Saldo anual (devengo ANUAL): asignación; el consumo se calcula de las solicitudes.
CREATE TABLE saldo_ausencia (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id       uuid NOT NULL REFERENCES entidad(id),
  persona_id       uuid NOT NULL REFERENCES persona(id),
  tipo_ausencia_id uuid NOT NULL REFERENCES tipo_ausencia(id),
  anio             smallint NOT NULL,
  dias_asignados   numeric(6,2) NOT NULL DEFAULT 0,
  UNIQUE (entidad_id, persona_id, tipo_ausencia_id, anio)
);

-- Solicitud de ausencia y su flujo.
CREATE TABLE solicitud_ausencia (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id         uuid NOT NULL REFERENCES entidad(id),
  persona_id         uuid NOT NULL REFERENCES persona(id),
  tipo_ausencia_id   uuid NOT NULL REFERENCES tipo_ausencia(id),
  fecha_inicio       date NOT NULL,
  fecha_fin          date NOT NULL,
  horas              numeric(5,2),
  dias_computados    numeric(6,2) NOT NULL,
  estado             text NOT NULL DEFAULT 'SOLICITADA'
                       CHECK (estado IN ('SOLICITADA','APROBADA','DENEGADA','CANCELADA')),
  observaciones      text,
  motivo_resolucion  text,
  solicitada_en      timestamptz NOT NULL DEFAULT now(),
  resuelta_en        timestamptz,
  resuelto_por       uuid REFERENCES usuario(id),
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX ix_solicitud_persona ON solicitud_ausencia (entidad_id, persona_id, estado);
CREATE INDEX ix_solicitud_fechas ON solicitud_ausencia (entidad_id, fecha_inicio, fecha_fin);

-- ---- Privilegios y RLS ----
GRANT SELECT, INSERT, UPDATE, DELETE ON
  tipo_ausencia, calendario_festivo, saldo_ausencia, solicitud_ausencia TO rrhh_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rrhh_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tipo_ausencia','calendario_festivo','saldo_ausencia','solicitud_ausencia'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY p_%1$s_tenant ON %1$I
        USING (entidad_id = app_entidad_id())
        WITH CHECK (entidad_id = app_entidad_id())
    $f$, t);
  END LOOP;
END $$;
