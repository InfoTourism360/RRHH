-- =============================================================================
-- PROPUESTA DE ESQUEMA — Plataforma RRHH sector público (MVP · Fase 1)
-- PostgreSQL 16+  ·  Zona horaria del servidor: Europe/Madrid  ·  Idioma: es-ES
--
-- ESTO ES UNA PROPUESTA PARA VALIDACIÓN. No es todavía una migración.
-- Cuando lo apruebes, se trocea en migraciones versionadas (0001, 0002, ...).
--
-- Principios que condicionan TODO el modelo (ver docs/decisiones-arquitectura.md):
--   1. Inmutabilidad append-only en auditoría y (Fase 2) fichajes.
--   2. Histórico por vigencias: NUNCA se sobrescribe, se versiona.
--   3. Aislamiento multi-tenant por fila con RLS FORZADA.
--   4. Cero biometría: no existe ni un solo campo para datos biométricos.
--   5. Minimización: solo lo imprescindible; sin datos de salud en claro.
--   6. Catálogos TREBEP como tablas, no como enums en código.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE sobre rangos + igualdad (no solapes)
CREATE EXTENSION IF NOT EXISTS citext;      -- emails/códigos case-insensitive

-- Roles de base de datos (defensa en profundidad frente al aislamiento).
-- La aplicación NUNCA se conecta como superusuario ni como propietario.
--   app_owner : dueño del esquema, ejecuta migraciones. NOLOGIN en producción salvo despliegue.
--   app_rw    : rol de la aplicación en runtime. Sujeto a RLS (NOBYPASSRLS).
-- (Se crean fuera de este fichero, en el aprovisionamiento; se documentan aquí.)

-- Función auxiliar: id de entidad del "tenant" activo en la conexión/transacción.
-- La aplicación hace  SET LOCAL app.entidad_id = '<uuid>'  al abrir cada transacción.
CREATE OR REPLACE FUNCTION app_entidad_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.entidad_id', true), '')::uuid
$$;

-- Función auxiliar: usuario activo (para columnas de autoría en auditoría).
CREATE OR REPLACE FUNCTION app_usuario_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.usuario_id', true), '')::uuid
$$;

-- Bloqueo genérico de UPDATE/DELETE para tablas append-only (inmutabilidad).
CREATE OR REPLACE FUNCTION impedir_modificacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tabla append-only: % no permitido sobre %',
    TG_OP, TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;


-- =============================================================================
-- BLOQUE A — CATÁLOGOS TREBEP (RDL 5/2015) Y NORMATIVOS
-- Son de dominio estatal y compartidos entre entidades => NO llevan entidad_id
-- ni RLS. Se precargan por seed normativo, no por el usuario.
-- =============================================================================

-- Grupos/subgrupos de clasificación profesional (art. 76 TREBEP).
CREATE TABLE cat_grupo_clasificacion (
  codigo        text PRIMARY KEY,            -- 'A1','A2','B','C1','C2','E_AP'
  denominacion  text NOT NULL,
  titulacion    text NOT NULL,               -- requisito de titulación
  orden         smallint NOT NULL
);
COMMENT ON TABLE cat_grupo_clasificacion IS 'Grupos de clasificación TREBEP art. 76. Catálogo estatal, no editable por la entidad.';

-- Escalas de personal funcionario.
CREATE TABLE cat_escala (
  codigo        text PRIMARY KEY,            -- 'GENERAL','ESPECIAL'
  denominacion  text NOT NULL
);

-- Tipo de relación de servicio (naturaleza del vínculo).
CREATE TABLE cat_tipo_relacion (
  codigo        text PRIMARY KEY,            -- 'FUNC_CARRERA','FUNC_INTERINO','LAB_FIJO','LAB_TEMPORAL','EVENTUAL'
  denominacion  text NOT NULL,
  es_funcionario boolean NOT NULL
);

-- Situaciones administrativas (art. 85 TREBEP y ss.).
CREATE TABLE cat_situacion_administrativa (
  codigo        text PRIMARY KEY,            -- 'SERV_ACTIVO','EXCEDENCIA_VOL','SERV_ESPECIALES','COMISION_SERV', ...
  denominacion  text NOT NULL,
  computa_antiguedad boolean NOT NULL DEFAULT false,
  reserva_puesto     boolean NOT NULL DEFAULT false
);

-- Formas de provisión de puestos (RPT).
CREATE TABLE cat_forma_provision (
  codigo        text PRIMARY KEY,            -- 'CONCURSO','LIBRE_DESIGNACION','CONCURSO_ESPECIFICO', ...
  denominacion  text NOT NULL
);

-- Tipo de jornada del puesto.
CREATE TABLE cat_tipo_jornada (
  codigo        text PRIMARY KEY,            -- 'COMPLETA','PARCIAL','ESPECIAL', ...
  denominacion  text NOT NULL
);


-- =============================================================================
-- BLOQUE B — ENTIDAD (TENANT) Y CONFIGURACIÓN
-- =============================================================================

CREATE TABLE entidad (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cif           citext NOT NULL UNIQUE,
  nombre        text NOT NULL,
  -- Configuración de fichaje y jornada como JSONB validado en la app
  -- (jornada de referencia semanal, tolerancias, geocerca on/off, etc.).
  -- Se detalla en Fase 2; aquí solo se reserva el contenedor.
  politicas     jsonb NOT NULL DEFAULT '{}'::jsonb,
  zona_horaria  text NOT NULL DEFAULT 'Europe/Madrid',
  idioma        text NOT NULL DEFAULT 'es-ES',   -- prep. i18n: ca, eu, gl, va
  creado_en     timestamptz NOT NULL DEFAULT now(),
  activo        boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE entidad IS 'Ayuntamiento = responsable del tratamiento RGPD. Raíz del aislamiento multi-tenant.';

-- Unidad orgánica: jerárquica, sostiene el flujo de aprobación (Fase 3).
CREATE TABLE unidad_organica (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id    uuid NOT NULL REFERENCES entidad(id),
  padre_id      uuid REFERENCES unidad_organica(id),
  codigo        text NOT NULL,
  denominacion  text NOT NULL,
  -- responsable_id se resuelve por relacion_servicio (rol responsable), no aquí,
  -- para no duplicar y respetar el histórico. Ver vista v_responsable_unidad.
  vigencia_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta date,
  UNIQUE (entidad_id, codigo),
  CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde),
  CHECK (padre_id IS NULL OR padre_id <> id)
);


-- =============================================================================
-- BLOQUE C — MODELO PÚBLICO: PLAZA -> PUESTO -> OCUPANTE (con histórico)
-- Diferencia clave frente a empresa privada: la plaza (dotación presupuestaria)
-- y el puesto (RPT) existen con independencia de que haya persona.
-- =============================================================================

-- PLAZA: dotación presupuestaria en plantilla.
CREATE TABLE plaza (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id     uuid NOT NULL REFERENCES entidad(id),
  codigo         text NOT NULL,
  denominacion   text NOT NULL,
  grupo_codigo   text NOT NULL REFERENCES cat_grupo_clasificacion(codigo),
  escala_codigo  text REFERENCES cat_escala(codigo),     -- funcionarios; NULL en laboral
  subescala      text,
  clase          text,
  dotacion       smallint NOT NULL DEFAULT 1 CHECK (dotacion >= 0),
  -- 'vacante' es un estado DERIVADO (¿hay ocupante vigente?), no una columna
  -- que se sobrescriba. Se expone por vista v_plaza_estado.
  vigencia_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta date,
  UNIQUE (entidad_id, codigo),
  CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde)
);
COMMENT ON COLUMN plaza.dotacion IS 'Nº de efectivos presupuestados. La vacancia es derivada, nunca un flag sobrescrito.';

-- PUESTO (RPT): relación de puestos de trabajo. Cuelga de una plaza.
CREATE TABLE puesto (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id       uuid NOT NULL REFERENCES entidad(id),
  plaza_id         uuid NOT NULL REFERENCES plaza(id),
  unidad_id        uuid NOT NULL REFERENCES unidad_organica(id),
  codigo           text NOT NULL,
  denominacion     text NOT NULL,
  nivel_cd         smallint NOT NULL CHECK (nivel_cd BETWEEN 1 AND 30), -- complemento de destino
  complemento_esp  numeric(10,2),                          -- complemento específico (importe anual)
  forma_provision  text REFERENCES cat_forma_provision(codigo),
  tipo_jornada     text REFERENCES cat_tipo_jornada(codigo),
  adscripcion      text,
  vigencia_desde   date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta   date,
  UNIQUE (entidad_id, codigo),
  CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde)
);

-- PERSONA: datos identificativos MÍNIMOS. Sin datos de salud, sin biometría.
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

-- RELACIÓN DE SERVICIO: vincula persona <-> puesto en el tiempo (el "ocupante").
-- Es la tabla que materializa el histórico de ocupación.
CREATE TABLE relacion_servicio (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id         uuid NOT NULL REFERENCES entidad(id),
  persona_id         uuid NOT NULL REFERENCES persona(id),
  puesto_id          uuid NOT NULL REFERENCES puesto(id),
  tipo_codigo        text NOT NULL REFERENCES cat_tipo_relacion(codigo),
  situacion_codigo   text NOT NULL REFERENCES cat_situacion_administrativa(codigo),
  toma_posesion      date NOT NULL,
  cese               date,            -- NULL = relación vigente
  -- Rango de ocupación derivado, usado por la restricción de no-solape:
  periodo            daterange GENERATED ALWAYS AS
                       (daterange(toma_posesion, cese, '[)')) STORED,
  CHECK (cese IS NULL OR cese >= toma_posesion),
  -- INTEGRIDAD CLAVE: un mismo puesto no puede tener dos ocupantes cuyas
  -- vigencias se solapen (dentro de la misma entidad).
  EXCLUDE USING gist (
    entidad_id WITH =,
    puesto_id  WITH =,
    periodo    WITH &&
  )
);
COMMENT ON TABLE relacion_servicio IS 'Ocupación persona-puesto con vigencia. Excedencia/comisión se modelan por situacion_codigo, no borrando la fila.';


-- =============================================================================
-- BLOQUE D — AUTENTICACIÓN Y ROLES (auth propia, sin BaaS)
-- =============================================================================

CREATE TABLE usuario (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id        uuid NOT NULL REFERENCES entidad(id),
  persona_id        uuid REFERENCES persona(id),  -- NULL para admin puro sin ficha de personal
  email             citext NOT NULL,
  password_hash     text NOT NULL,                -- Argon2id; el algoritmo va embebido en el hash
  mfa_totp_secret   bytea,                        -- cifrado en app; NULL = MFA no activado
  mfa_activo        boolean NOT NULL DEFAULT false,
  intentos_fallidos smallint NOT NULL DEFAULT 0,
  bloqueado_hasta   timestamptz,
  activo            boolean NOT NULL DEFAULT true,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entidad_id, email)
);

-- Catálogo de roles del MVP (fijo, pero en tabla para trazar permisos).
CREATE TABLE rol (
  codigo        text PRIMARY KEY,   -- 'ADMIN_ENTIDAD','GESTOR_PERSONAL','RESPONSABLE_UNIDAD','EMPLEADO'
  denominacion  text NOT NULL
);

-- Asignación de roles. 'RESPONSABLE_UNIDAD' se acota a una unidad concreta.
CREATE TABLE usuario_rol (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id    uuid NOT NULL REFERENCES entidad(id),
  usuario_id    uuid NOT NULL REFERENCES usuario(id),
  rol_codigo    text NOT NULL REFERENCES rol(codigo),
  unidad_id     uuid REFERENCES unidad_organica(id),  -- solo para RESPONSABLE_UNIDAD
  vigencia_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta date,
  UNIQUE (entidad_id, usuario_id, rol_codigo, unidad_id)
);

CREATE TABLE sesion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id     uuid NOT NULL REFERENCES entidad(id),
  usuario_id     uuid NOT NULL REFERENCES usuario(id),
  token_hash     text NOT NULL UNIQUE,     -- se guarda el hash, nunca el token
  creado_en      timestamptz NOT NULL DEFAULT now(),
  expira_en      timestamptz NOT NULL,
  rotado_de      uuid REFERENCES sesion(id),  -- cadena de rotación
  revocada_en    timestamptz,
  ip             inet,
  user_agent     text
);


-- =============================================================================
-- BLOQUE E — AUDITORÍA APPEND-ONLY (diseñada desde la primera tabla)
-- Log FUNCIONAL de cambios sobre estructura organizativa. El log de fichajes
-- (Fase 2) y el registro de actividad ENS (Fase 5) siguen el MISMO patrón.
-- =============================================================================

CREATE TABLE auditoria (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad_id    uuid NOT NULL REFERENCES entidad(id),
  ocurrido_en   timestamptz NOT NULL DEFAULT now(),
  usuario_id    uuid,                       -- autor (app_usuario_id())
  accion        text NOT NULL,              -- 'CREAR','MODIFICAR','CERRAR_VIGENCIA', ...
  tabla         text NOT NULL,              -- entidad afectada
  registro_id   text NOT NULL,              -- id del registro afectado
  motivo        text,                       -- obligatorio en correcciones (se valida en app/Fase 2)
  datos_antes   jsonb,                      -- estado previo (NULL en alta)
  datos_despues jsonb,                      -- estado nuevo (NULL en baja lógica)
  -- Encadenamiento tipo "hash chain" para detectar manipulación fuera de banda:
  hash_prev     bytea,
  hash_actual   bytea NOT NULL
);
COMMENT ON TABLE auditoria IS 'Append-only. Prohibidos UPDATE/DELETE por trigger y por REVOKE. Base del registro inmutable del RD de registro horario digital.';

-- Inmutabilidad: trigger que rechaza cualquier UPDATE/DELETE.
CREATE TRIGGER trg_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION impedir_modificacion();

-- Defensa en profundidad (se ejecuta en aprovisionamiento, documentado aquí):
--   REVOKE UPDATE, DELETE, TRUNCATE ON auditoria FROM app_rw;
--   GRANT  INSERT, SELECT               ON auditoria TO   app_rw;


-- =============================================================================
-- BLOQUE F — MULTI-TENANT: RLS FORZADA EN TODAS LAS TABLAS CON entidad_id
-- Patrón repetido por tabla. Se muestra el bloque; en la migración se aplica
-- a: unidad_organica, plaza, puesto, persona, relacion_servicio, usuario,
--    usuario_rol, sesion, auditoria y entidad.
-- =============================================================================

-- Ejemplo canónico (se replica en cada tabla tenant):
ALTER TABLE plaza ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaza FORCE ROW LEVEL SECURITY;   -- aplica también al owner: nadie escapa
CREATE POLICY p_plaza_tenant ON plaza
  USING      (entidad_id = app_entidad_id())
  WITH CHECK (entidad_id = app_entidad_id());

-- (idéntico para el resto de tablas tenant; omitido aquí por brevedad,
--  irá completo en la migración 0002_rls.sql)

-- entidad se filtra por su propio id:
ALTER TABLE entidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE entidad FORCE ROW LEVEL SECURITY;
CREATE POLICY p_entidad_self ON entidad
  USING (id = app_entidad_id());


-- =============================================================================
-- BLOQUE G — VISTAS DERIVADAS (estados NO sobrescritos)
-- =============================================================================

-- Estado de vacancia de la plaza a día de hoy, calculado, nunca almacenado.
CREATE VIEW v_plaza_estado AS
SELECT p.id AS plaza_id,
       p.entidad_id,
       p.codigo,
       p.dotacion,
       count(rs.id) FILTER (WHERE rs.cese IS NULL) AS ocupantes_vigentes,
       (p.dotacion - count(rs.id) FILTER (WHERE rs.cese IS NULL)) > 0 AS vacante
FROM plaza p
LEFT JOIN puesto pu ON pu.plaza_id = p.id
LEFT JOIN relacion_servicio rs ON rs.puesto_id = pu.id
GROUP BY p.id;

-- Responsable vigente de cada unidad (para el flujo de aprobación).
CREATE VIEW v_responsable_unidad AS
SELECT ur.entidad_id, ur.unidad_id, ur.usuario_id
FROM usuario_rol ur
WHERE ur.rol_codigo = 'RESPONSABLE_UNIDAD'
  AND ur.unidad_id IS NOT NULL
  AND (ur.vigencia_hasta IS NULL OR ur.vigencia_hasta >= CURRENT_DATE);
