# Copias de seguridad y prueba de restauración

Cubre ENS **mp.info.6** (copias) y **op.cont.3** (pruebas de restauración), y la
conservación legal de **4 años** de los registros de jornada.

## Copia
```bash
scripts/backup.sh ./backups
```
- Genera `rrhh_<fecha>.dump` (formato custom de PostgreSQL, comprimido).
- Genera `rrhh_<fecha>.dump.sha256` con el hash de integridad.
- Frecuencia recomendada: diaria, con retención mínima de **4 años** para poder
  reconstruir cualquier registro de jornada exigible.
- Las copias deben almacenarse cifradas y fuera del servidor de producción.

## Prueba de restauración (documentada y periódica)
```bash
scripts/restore.sh ./backups/rrhh_YYYYMMDD_HHMMSS.dump
```
- Verifica el hash de integridad antes de restaurar.
- Restaura sobre una **BD de prueba** (`rrhh_restore_test`), nunca sobre producción.
- Muestra recuentos de `entidad`, `persona` y `fichaje_evento` para validar.

## Registro de la prueba
Cada prueba de restauración debe anotarse (fecha, fichero, resultado, responsable).
Recomendado: trimestral. Plantilla:

| Fecha | Fichero | Hash verificado | Restauración OK | Recuentos coherentes | Responsable |
|---|---|---|---|---|---|
|  |  |  |  |  |  |
