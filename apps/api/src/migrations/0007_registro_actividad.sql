-- =============================================================================
-- 0007_registro_actividad.sql — Registro de actividad (ENS op.exp.8 / op.exp.10).
-- SEPARADO del log funcional (auditoria) y del registro de jornada. Recoge
-- accesos y acciones de usuarios y administradores. Append-only y con retención.
-- =============================================================================

CREATE TABLE registro_actividad (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  momento      timestamptz NOT NULL DEFAULT now(),
  entidad_id   uuid REFERENCES entidad(id),   -- NULL en eventos de sistema/pre-login
  usuario_id   uuid REFERENCES usuario(id),
  accion       text NOT NULL,                 -- 'LOGIN_OK','LOGIN_FALLO','ACCESO','CAMBIO', ...
  metodo       text,
  ruta         text,
  estado_http  smallint,
  ip           inet,
  user_agent   text,
  detalle      jsonb NOT NULL DEFAULT '{}'::jsonb
);
COMMENT ON TABLE registro_actividad IS 'Trazas de actividad para ENS. Append-only. Retención definida por política (ver docs/ens).';
CREATE INDEX ix_registro_actividad ON registro_actividad (entidad_id, momento);

CREATE TRIGGER trg_registro_actividad_inmutable
  BEFORE UPDATE OR DELETE ON registro_actividad
  FOR EACH ROW EXECUTE FUNCTION impedir_modificacion();

-- La app solo INSERTA y LEE (nunca modifica/borra). La inserción la hace el rol
-- propietario desde el servicio de logging (funciona también antes del login);
-- la lectura la hace el rol de app y queda acotada por RLS a la entidad.
GRANT SELECT ON registro_actividad TO rrhh_app;

ALTER TABLE registro_actividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_actividad FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_registro_actividad_tenant ON registro_actividad
  USING (entidad_id = app_entidad_id());
