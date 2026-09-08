# Procedimiento de borrado seguro

Cubre ENS **mp.info** (limpieza de soportes/información) y el principio de
**limitación del plazo de conservación** del RGPD (art. 5.1.e).

## Principio: inmutabilidad vs. supresión
La plataforma es **append-only** en los registros con valor legal
(`fichaje_evento`, `auditoria`, `registro_actividad`). Estos NO se borran de
forma operativa: se conservan el plazo exigido y se eliminan **en bloque** al
vencer la retención, no registro a registro.

## Plazos de conservación
| Dato | Plazo | Base |
|---|---|---|
| Registros de jornada | 4 años | Normativa de registro horario |
| Registro de actividad (ENS) | Según política (p. ej. 2 años) | ENS op.exp.8 |
| Datos de personal | Mientras exista relación + plazos legales | RGPD |
| Documentos (nóminas) | Según normativa laboral/fiscal | — |

## Métodos de borrado
1. **Fin de retención de registros inmutables**: purga por **partición temporal**
   (se elimina la partición completa vencida), evitando el borrado fila a fila que
   los triggers de inmutabilidad impiden. Ver `purgarActividad()` (documentada).
2. **Datos operativos**: cierre de vigencia (`vigencia_hasta`) como baja lógica;
   la supresión física se ejecuta al vencer los plazos.
3. **Copias de seguridad**: destrucción segura de soportes/ficheros al caducar,
   incluyendo sus hashes.
4. **Soportes físicos**: sobrescritura o destrucción certificada (a cargo de la
   entidad/operación).

## Ejercicio de derechos (supresión RGPD)
Las solicitudes de supresión se valoran frente a las obligaciones legales de
conservación; cuando proceda, se documenta la actuación y se registra en
`auditoria`.
