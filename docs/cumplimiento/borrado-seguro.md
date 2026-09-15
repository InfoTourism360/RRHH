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
   los triggers de inmutabilidad impiden.
   > **Pendiente de implementar.** Las tablas no están particionadas y
   > `purgarActividad()` lanza si se invoca. Mientras no se haga, las trazas se
   > conservan indefinidamente: el plazo de la tabla de arriba es la política
   > prevista, no lo que el sistema aplica hoy.
   >
   > Se eligió eliminar la partición entera y no un `DELETE` con el trigger
   > desactivado a propósito: quien puede borrar una fila concreta puede hacer
   > desaparecer justo la que le incrimina, y ahí se acaba el valor probatorio
   > del registro. Una ventana temporal completa se va o se queda.
2. **Datos operativos**: cierre de vigencia (`vigencia_hasta`) como baja lógica;
   la supresión física se ejecuta al vencer los plazos.
3. **Copias de seguridad**: destrucción segura de soportes/ficheros al caducar,
   incluyendo sus hashes.
4. **Soportes físicos**: sobrescritura o destrucción certificada (a cargo de la
   entidad/operación).

## Qué se puede suprimir hoy, y qué no
Conviene decirlo sin rodeos, porque de ello depende una cláusula del contrato de
encargado:

| Supuesto | ¿Se puede hoy? |
|---|---|
| Fin del encargo: suprimir **todos** los datos de la entidad | Sí: se destruye la instancia, su volumen de base de datos y las copias. |
| Baja de una persona | Sí como baja lógica (`vigencia_hasta`); sus registros de jornada se conservan el plazo legal. |
| Purga selectiva al vencer la retención, con el sistema en marcha | **No.** Requiere la partición temporal descrita arriba. |

Antes de firmar el anexo del art. 28 hay que tener presente que la supresión que
el sistema sabe hacer hoy es la primera: completa y a nivel de despliegue.

## Ejercicio de derechos (supresión RGPD)
Las solicitudes de supresión se valoran frente a las obligaciones legales de
conservación; cuando proceda, se documenta la actuación y se registra en
`auditoria`.
