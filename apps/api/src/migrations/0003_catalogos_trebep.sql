-- =============================================================================
-- 0003_catalogos_trebep.sql — Precarga normativa (TREBEP / RDL 5/2015).
-- Datos de dominio estatal, NO datos de ejemplo de cliente. ON CONFLICT para
-- que la migración sea repetible sin duplicar.
-- =============================================================================

INSERT INTO cat_grupo_clasificacion (codigo, denominacion, titulacion, orden) VALUES
  ('A1','Subgrupo A1','Grado universitario / Licenciatura', 1),
  ('A2','Subgrupo A2','Grado universitario / Diplomatura', 2),
  ('B','Grupo B','Técnico Superior (FP grado superior)', 3),
  ('C1','Subgrupo C1','Bachiller o Técnico', 4),
  ('C2','Subgrupo C2','Graduado en ESO', 5),
  ('E_AP','Agrupaciones Profesionales','Sin requisito de titulación (art. 76 TREBEP)', 6)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO cat_escala (codigo, denominacion) VALUES
  ('GENERAL','Administración General'),
  ('ESPECIAL','Administración Especial')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO cat_tipo_relacion (codigo, denominacion, es_funcionario) VALUES
  ('FUNC_CARRERA','Funcionario de carrera', true),
  ('FUNC_INTERINO','Funcionario interino', true),
  ('LAB_FIJO','Personal laboral fijo', false),
  ('LAB_TEMPORAL','Personal laboral temporal', false),
  ('EVENTUAL','Personal eventual', false)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO cat_situacion_administrativa
  (codigo, denominacion, computa_antiguedad, reserva_puesto) VALUES
  ('SERV_ACTIVO','Servicio activo', true,  true),
  ('SERV_ESPECIALES','Servicios especiales', true,  true),
  ('COMISION_SERV','Comisión de servicios', true,  true),
  ('EXCEDENCIA_VOL','Excedencia voluntaria por interés particular', false, false),
  ('EXCEDENCIA_CUID','Excedencia por cuidado de familiares', true,  true),
  ('SUSP_FIRME','Suspensión firme de funciones', false, false)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO cat_forma_provision (codigo, denominacion) VALUES
  ('CONCURSO','Concurso'),
  ('CONCURSO_ESP','Concurso específico'),
  ('LIBRE_DESIG','Libre designación'),
  ('LABORAL','Provisión de puesto laboral')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO cat_tipo_jornada (codigo, denominacion) VALUES
  ('COMPLETA','Jornada completa'),
  ('PARCIAL','Jornada parcial'),
  ('ESPECIAL','Jornada especial / dedicación')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol (codigo, denominacion) VALUES
  ('ADMIN_ENTIDAD','Administrador de entidad'),
  ('GESTOR_PERSONAL','Gestor de personal'),
  ('RESPONSABLE_UNIDAD','Responsable de unidad'),
  ('EMPLEADO','Empleado')
ON CONFLICT (codigo) DO NOTHING;
