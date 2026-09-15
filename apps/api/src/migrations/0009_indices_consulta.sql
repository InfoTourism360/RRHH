-- =============================================================================
-- 0009_indices_consulta.sql — Dos índices que faltaban en caminos calientes.
--
-- Medido sobre una base de carga con 61 entidades, 12.300 relaciones de
-- servicio y 1,25 millones de fichajes (un ayuntamiento de 300 efectivos con
-- cuatro años de jornada), consultando como `rrhh_app` y con la RLS activa:
--
--   relacion_servicio por persona ...... 38 ms → 2 ms   (300 comprobaciones)
--   relacion_servicio + puesto por unidad 1,6 ms → 0,3 ms
--
-- El primero pesa porque la comprobación de competencia se ejecuta en CADA
-- petición sobre un tercero, y esa tabla crece con el número de entidades
-- servidas, no con el tamaño de una sola.
-- =============================================================================

-- Parcial: a las consultas de competencia y de cola de aprobación solo les
-- interesa la relación viva, que es una fracción del histórico.
CREATE INDEX IF NOT EXISTS ix_relacion_persona
  ON relacion_servicio (entidad_id, persona_id)
  WHERE cese IS NULL;

CREATE INDEX IF NOT EXISTS ix_puesto_unidad
  ON puesto (entidad_id, unidad_id);
