-- =============================================================================
-- 0010_jornada_tipo.sql — Jornada teórica por colectivo, no una para todos.
--
-- Hasta ahora la jornada teórica era un único horario en `entidad.politicas`,
-- así que el saldo solo tenía sentido para quien trabaja de lunes a viernes en
-- horario de oficina. Un agente de policía que hace dos noches el fin de semana
-- y libra el lunes acumulaba +510 minutos: sábado y domingo con teórico 0 (todo
-- contaba como festivo) y el lunes libre como −450 de déficit.
--
-- Esto NO son cuadrantes de turnos, que siguen fuera de alcance. Es lo mínimo
-- para que la columna de saldo sea interpretable: cuántos minutos se le
-- presuponen a esta persona cada día de la semana.
-- =============================================================================

CREATE TABLE jornada_tipo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id     uuid NOT NULL REFERENCES entidad(id),
  codigo         text NOT NULL,
  denominacion   text NOT NULL,
  -- Minutos teóricos por día de la semana: {"0":0,"1":450,...} (0 = domingo).
  minutos_por_dia jsonb NOT NULL,
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entidad_id, codigo)
);

COMMENT ON TABLE jornada_tipo IS
  'Jornadas teóricas de la entidad (oficina, turnos, jornada intensiva...). Se asignan a la persona.';

-- NULL = se aplica la jornada por defecto de la entidad, que es como funcionaba
-- hasta ahora. Así la asignación es progresiva y nada cambia hasta que se usa.
ALTER TABLE persona
  ADD COLUMN jornada_tipo_id uuid REFERENCES jornada_tipo(id);

COMMENT ON COLUMN persona.jornada_tipo_id IS
  'Jornada teórica de esta persona. NULL = la de la entidad.';

CREATE INDEX ix_jornada_tipo_entidad ON jornada_tipo (entidad_id) WHERE activo;

-- Aislamiento por entidad, igual que el resto de tablas de negocio.
ALTER TABLE jornada_tipo ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornada_tipo FORCE ROW LEVEL SECURITY;
CREATE POLICY p_jornada_tipo ON jornada_tipo
  USING (entidad_id = app_entidad_id())
  WITH CHECK (entidad_id = app_entidad_id());

GRANT SELECT, INSERT, UPDATE ON jornada_tipo TO rrhh_app;
