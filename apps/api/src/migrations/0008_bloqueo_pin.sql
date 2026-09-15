-- =============================================================================
-- 0008_bloqueo_pin.sql — Freno a la prueba a ciegas del PIN de quiosco.
--
-- El PIN son 4 a 8 dígitos y hasta ahora no bloqueaba la cuenta: solo existía
-- el límite por origen, de modo que se podía seguir probando indefinidamente
-- contra la misma persona. La contraseña sí tenía bloqueo.
--
-- El contador va APARTE del de la contraseña a propósito. Si compartieran uno,
-- cualquiera podría dejar a un compañero sin acceso web tecleando PIN erróneos
-- en el terminal del vestíbulo: una denegación de servicio trivial.
-- =============================================================================

ALTER TABLE usuario
  ADD COLUMN pin_intentos_fallidos smallint NOT NULL DEFAULT 0,
  ADD COLUMN pin_bloqueado_hasta   timestamptz;

COMMENT ON COLUMN usuario.pin_intentos_fallidos IS
  'Fallos consecutivos del PIN de quiosco. Se pone a cero al acertar.';
COMMENT ON COLUMN usuario.pin_bloqueado_hasta IS
  'Fin del bloqueo del fichaje por quiosco. No afecta al acceso web con contraseña.';
