-- =============================================================================
-- 0002_rls.sql — Rol de aplicación, privilegios y Row Level Security FORZADA.
-- Defensa en profundidad: el aislamiento no depende del código de la app.
-- =============================================================================

-- Rol de aplicación: LOGIN, NOBYPASSRLS, NOSUPERUSER. Sujeto a RLS siempre.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rrhh_app') THEN
    CREATE ROLE rrhh_app LOGIN PASSWORD 'dev_app_pwd' NOSUPERUSER NOBYPASSRLS
      NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO rrhh_app;

-- Catálogos normativos: solo lectura para la app.
GRANT SELECT ON
  cat_grupo_clasificacion, cat_escala, cat_tipo_relacion,
  cat_situacion_administrativa, cat_forma_provision, cat_tipo_jornada, rol
  TO rrhh_app;

-- Tablas operativas de tenant: lectura/escritura (el filtro lo pone la RLS).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  unidad_organica, plaza, puesto, persona, relacion_servicio,
  usuario, usuario_rol, sesion
  TO rrhh_app;

-- entidad: la app puede leer y actualizar la suya; el alta es provisioning (owner).
GRANT SELECT, UPDATE ON entidad TO rrhh_app;

-- auditoría: APPEND-ONLY. Solo lectura e inserción. Nunca UPDATE/DELETE.
GRANT SELECT, INSERT ON auditoria TO rrhh_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rrhh_app;
GRANT SELECT ON v_plaza_estado, v_responsable_unidad TO rrhh_app;

-- Las vistas deben respetar la RLS del INVOCANTE, no la del propietario.
ALTER VIEW v_plaza_estado      SET (security_invoker = true);
ALTER VIEW v_responsable_unidad SET (security_invoker = true);

-- -----------------------------------------------------------------------------
-- RLS: ENABLE + FORCE + política por entidad en cada tabla de tenant.
-- -----------------------------------------------------------------------------
ALTER TABLE entidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE entidad FORCE  ROW LEVEL SECURITY;
CREATE POLICY p_entidad_self ON entidad
  USING (id = app_entidad_id()) WITH CHECK (id = app_entidad_id());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'unidad_organica','plaza','puesto','persona','relacion_servicio',
    'usuario','usuario_rol','sesion','auditoria'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY p_%1$s_tenant ON %1$I
        USING (entidad_id = app_entidad_id())
        WITH CHECK (entidad_id = app_entidad_id())
    $f$, t);
  END LOOP;
END $$;
