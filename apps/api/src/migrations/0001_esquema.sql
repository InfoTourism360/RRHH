-- =============================================================================
-- 0001_esquema.sql — Estructura organizativa, auth, auditoría append-only.
-- Ejecutada por el rol propietario. Idempotencia la garantiza el runner
-- (una migración = una vez). Zona horaria del servidor: Europe/Madrid.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------------------------------
-- Funciones de contexto de tenant/usuario (fijadas por la app con SET LOCAL).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_entidad_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.entidad_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_usuario_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.usuario_id', true), '')::uuid
$$;

-- Bloqueo de UPDATE/DELETE para tablas append-only (inmutabilidad).
CREATE OR REPLACE FUNCTION impedir_modificacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tabla append-only: % no permitido sobre %',
    TG_OP, TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;

-- =============================================================================
-- CATÁLOGOS TREBEP (estatales, compartidos, sin entidad_id ni RLS)
-- =============================================================================
CREATE TABLE cat_grupo_clasificacion (
  codigo        text PRIMARY KEY,
  denominacion  text NOT NULL,
  titulacion    text NOT NULL,
  orden         smallint NOT NULL
);
COMMENT ON TABLE cat_grupo_clasificacion IS 'Grupos de clasificación TREBEP art. 76. No editable por la entidad.';

CREATE TABLE cat_escala (
  codigo        text PRIMARY KEY,
  denominacion  text NOT NULL
);

CREATE TABLE cat_tipo_relacion (
  codigo         text PRIMARY KEY,
  denominacion   text NOT NULL,
  es_funcionario boolean NOT NULL
);

CREATE TABLE cat_situacion_administrativa (
  codigo             text PRIMARY KEY,
  denominacion       text NOT NULL,
  computa_antiguedad boolean NOT NULL DEFAULT false,
  reserva_puesto     boolean NOT NULL DEFAULT false
);

CREATE TABLE cat_forma_provision (
  codigo        text PRIMARY KEY,
  denominacion  text NOT NULL
);

CREATE TABLE cat_tipo_jornada (
  codigo        text PRIMARY KEY,
  denominacion  text NOT NULL
);

CREATE TABLE rol (
  codigo        text PRIMARY KEY,
  denominacion  text NOT NULL
);

-- =============================================================================
-- ENTIDAD (TENANT) Y UNIDADES
-- =============================================================================
CREATE TABLE entidad (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cif           citext NOT NULL UNIQUE,
  nombre        text NOT NULL,
  politicas     jsonb NOT NULL DEFAULT '{}'::jsonb,
  zona_horaria  text NOT NULL DEFAULT 'Europe/Madrid',
  idioma        text NOT NULL DEFAULT 'es-ES',
  creado_en     timestamptz NOT NULL DEFAULT now(),
  activo        boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE entidad IS 'Ayuntamiento = responsable del tratamiento RGPD. Raíz del aislamiento multi-tenant.';

CREATE TABLE unidad_organica (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id     uuid NOT NULL REFERENCES entidad(id),
  padre_id       uuid REFERENCES unidad_organica(id),
  codigo         text NOT NULL,
  denominacion   text NOT NULL,
  vigencia_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta date,
  UNIQUE (entidad_id, codigo),
  CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde),
  CHECK (padre_id IS NULL OR padre_id <> id)
);

-- =============================================================================
-- PLAZA -> PUESTO -> OCUPANTE (con histórico por vigencias)
-- =============================================================================
CREATE TABLE plaza (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id     uuid NOT NULL REFERENCES entidad(id),
  codigo         text NOT NULL,
  denominacion   text NOT NULL,
  grupo_codigo   text NOT NULL REFERENCES cat_grupo_clasificacion(codigo),
  escala_codigo  text REFERENCES cat_escala(codigo),
  subescala      text,
  clase          text,
  dotacion       smallint NOT NULL DEFAULT 1 CHECK (dotacion >= 0),
  vigencia_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta date,
  UNIQUE (entidad_id, codigo),
  CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde)
);
COMMENT ON COLUMN plaza.dotacion IS 'Nº de efectivos presupuestados. La vacancia es DERIVADA (ver v_plaza_estado), nunca un flag sobrescrito.';

CREATE TABLE puesto (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id       uuid NOT NULL REFERENCES entidad(id),
  plaza_id         uuid NOT NULL REFERENCES plaza(id),
  unidad_id        uuid NOT NULL REFERENCES unidad_organica(id),
  codigo           text NOT NULL,
  denominacion     text NOT NULL,
  nivel_cd         smallint NOT NULL CHECK (nivel_cd BETWEEN 1 AND 30),
  complemento_esp  numeric(10,2),
  forma_provision  text REFERENCES cat_forma_provision(codigo),
  tipo_jornada     text REFERENCES cat_tipo_jornada(codigo),
  adscripcion      text,
  vigencia_desde   date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta   date,
  UNIQUE (entidad_id, codigo),
  CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde)
);

CREATE TABLE persona (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id     uuid NOT NULL REFERENCES entidad(id),
  tipo_documento text NOT NULL CHECK (tipo_documento IN ('DNI','NIE','PASAPORTE')),
  num_documento  citext NOT NULL,
  nombre         text NOT NULL,
  apellido1      text NOT NULL,
  apellido2      text,
  email_corp     citext,
  telefono       text,
  vigencia_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta date,
  UNIQUE (entidad_id, tipo_documento, num_documento)
);
COMMENT ON TABLE persona IS 'Minimización RGPD: solo identificativos. Prohibido salud/biometría.';

CREATE TABLE relacion_servicio (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id       uuid NOT NULL REFERENCES entidad(id),
  persona_id       uuid NOT NULL REFERENCES persona(id),
  puesto_id        uuid NOT NULL REFERENCES puesto(id),
  tipo_codigo      text NOT NULL REFERENCES cat_tipo_relacion(codigo),
  situacion_codigo text NOT NULL REFERENCES cat_situacion_administrativa(codigo),
  toma_posesion    date NOT NULL,
  cese             date,
  -- ocupa_efectivo=false => titular con reserva (excedencia/comisión): NO cuenta
  -- para el no-solape, de modo que un interino pueda ocupar el mismo puesto.
  ocupa_efectivo   boolean NOT NULL DEFAULT true,
  periodo          daterange GENERATED ALWAYS AS
                     (daterange(toma_posesion, cese, '[)')) STORED,
  CHECK (cese IS NULL OR cese >= toma_posesion),
  -- No dos ocupantes EFECTIVOS solapados en el mismo puesto de la misma entidad.
  EXCLUDE USING gist (
    entidad_id WITH =,
    puesto_id  WITH =,
    periodo    WITH &&
  ) WHERE (ocupa_efectivo)
);
COMMENT ON TABLE relacion_servicio IS 'Ocupación persona-puesto con vigencia. Excedencia/comisión: cese NULL + ocupa_efectivo=false (reserva).';

-- =============================================================================
-- AUTENTICACIÓN Y ROLES DE APLICACIÓN
-- =============================================================================
CREATE TABLE usuario (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id        uuid NOT NULL REFERENCES entidad(id),
  persona_id        uuid REFERENCES persona(id),
  email             citext NOT NULL,
  password_hash     text NOT NULL,
  mfa_totp_secret   bytea,
  mfa_activo        boolean NOT NULL DEFAULT false,
  intentos_fallidos smallint NOT NULL DEFAULT 0,
  bloqueado_hasta   timestamptz,
  activo            boolean NOT NULL DEFAULT true,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entidad_id, email)
);

CREATE TABLE usuario_rol (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id     uuid NOT NULL REFERENCES entidad(id),
  usuario_id     uuid NOT NULL REFERENCES usuario(id),
  rol_codigo     text NOT NULL REFERENCES rol(codigo),
  unidad_id      uuid REFERENCES unidad_organica(id),
  vigencia_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta date,
  UNIQUE (entidad_id, usuario_id, rol_codigo, unidad_id)
);

CREATE TABLE sesion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id   uuid NOT NULL REFERENCES entidad(id),
  usuario_id   uuid NOT NULL REFERENCES usuario(id),
  token_hash   text NOT NULL UNIQUE,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  visto_en     timestamptz NOT NULL DEFAULT now(),
  expira_en    timestamptz NOT NULL,
  rotado_de    uuid REFERENCES sesion(id),
  revocada_en  timestamptz,
  ip           inet,
  user_agent   text
);

-- =============================================================================
-- AUDITORÍA APPEND-ONLY
-- =============================================================================
CREATE TABLE auditoria (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad_id    uuid NOT NULL REFERENCES entidad(id),
  ocurrido_en   timestamptz NOT NULL DEFAULT now(),
  usuario_id    uuid,
  accion        text NOT NULL,
  tabla         text NOT NULL,
  registro_id   text NOT NULL,
  motivo        text,
  datos_antes   jsonb,
  datos_despues jsonb,
  hash_prev     bytea,
  hash_actual   bytea NOT NULL
);
COMMENT ON TABLE auditoria IS 'Append-only. UPDATE/DELETE prohibidos por trigger y por REVOKE (ver 0002).';

CREATE INDEX ix_auditoria_entidad_tabla ON auditoria (entidad_id, tabla, registro_id);
CREATE TRIGGER trg_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION impedir_modificacion();

-- =============================================================================
-- VISTAS DERIVADAS
-- =============================================================================
CREATE VIEW v_plaza_estado AS
SELECT p.id AS plaza_id,
       p.entidad_id,
       p.codigo,
       p.dotacion,
       count(rs.id) FILTER (WHERE rs.cese IS NULL AND rs.ocupa_efectivo) AS ocupantes_vigentes,
       (p.dotacion - count(rs.id) FILTER (WHERE rs.cese IS NULL AND rs.ocupa_efectivo)) > 0 AS vacante
FROM plaza p
LEFT JOIN puesto pu ON pu.plaza_id = p.id AND pu.entidad_id = p.entidad_id
LEFT JOIN relacion_servicio rs ON rs.puesto_id = pu.id AND rs.entidad_id = p.entidad_id
WHERE p.vigencia_hasta IS NULL
GROUP BY p.id;

CREATE VIEW v_responsable_unidad AS
SELECT ur.entidad_id, ur.unidad_id, ur.usuario_id
FROM usuario_rol ur
WHERE ur.rol_codigo = 'RESPONSABLE_UNIDAD'
  AND ur.unidad_id IS NOT NULL
  AND (ur.vigencia_hasta IS NULL OR ur.vigencia_hasta >= CURRENT_DATE);
