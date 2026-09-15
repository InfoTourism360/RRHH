# Contrato de encargado del tratamiento (art. 28 RGPD) — BORRADOR

Entre **[ENTIDAD LOCAL]** (en adelante, el **Responsable**) y **[PROVEEDOR]**
(en adelante, el **Encargado**), para el tratamiento de datos personales derivado
de la prestación del servicio de la plataforma de gestión de RRHH.

> Borrador base. Debe revisarse jurídicamente y completarse [entre corchetes]
> antes de la firma. Cada entidad es responsable del tratamiento distinto.

## 1. Objeto
El Encargado tratará por cuenta del Responsable los datos personales necesarios
para prestar los servicios de estructura organizativa, control horario,
gestión de ausencias y portal del empleado.

## 2. Duración
Vigencia mientras dure la prestación del servicio. A su fin, se aplicará la
cláusula 9 (devolución/supresión).

## 3. Naturaleza y finalidad
Alojamiento y procesamiento de datos de personal para la gestión de recursos
humanos de la entidad. **No** se realiza cálculo de nómina ni elaboración de
perfiles. **No** se tratan datos biométricos.

## 4. Tipo de datos y categorías de interesados
- Datos: identificativos (nombre, apellidos, documento), datos de contacto
  profesional, datos de la relación de servicio (puesto, situación), registros
  de jornada, solicitudes de ausencia, documentos publicados por la entidad.
- **No** se tratan categorías especiales (art. 9) en claro. Sin datos de salud
  ni biométricos.
- Interesados: empleados públicos de la entidad.

## 5. Obligaciones del Encargado
a) Tratar los datos solo siguiendo instrucciones documentadas del Responsable.
b) Confidencialidad del personal autorizado.
c) Adoptar las medidas de seguridad del art. 32 RGPD y del ENS categoría MEDIA
   (ver [mapa Anexo II](../cumplimiento/anexo-ii-ens-mapa.md)): cifrado de
   secretos, control de acceso por roles, aislamiento multi-tenant, registros
   inmutables y copias de seguridad.
d) No subcontratar sin autorización (cláusula 6).
e) Asistir al Responsable en el ejercicio de derechos de los interesados.
f) Asistir en el cumplimiento de los arts. 32-36 (seguridad, brechas, EIPD).
g) Notificar **brechas** sin dilación indebida (≤ 72 h de conocerlas), conforme
   al [procedimiento de incidentes](../cumplimiento/gestion-incidentes.md).
h) Poner a disposición la información para acreditar el cumplimiento y permitir
   auditorías.

## 6. Subencargados
[Listar proveedores de infraestructura]. El Encargado impondrá a los
subencargados las mismas obligaciones mediante contrato.

## 7. Transferencias internacionales
No se realizan transferencias fuera del EEE. La infraestructura reside en
[ubicación], sin uso de servicios cloud no conformes con el ENS.

## 8. Medidas de seguridad
Las descritas en la documentación de cumplimiento ENS/RGPD del sistema
(categoría MEDIA), incluidas: RLS por entidad, autenticación reforzada,
inmutabilidad append-only, registro de actividad, cifrado de secretos y copias
con prueba de restauración.

## 9. Fin del encargo
A la finalización, el Encargado, a elección del Responsable, **devolverá** o
**suprimirá** los datos y las copias existentes, salvo obligación legal de
conservación, conforme al [procedimiento de borrado seguro](../cumplimiento/borrado-seguro.md).

> **Alcance real de la supresión.** Se ejecuta destruyendo la instancia, su
> volumen de base de datos y las copias: es completa y verificable. Lo que el
> sistema **no** hace todavía es la purga selectiva por vencimiento de plazos con
> el servicio en marcha, que exige particionar las tablas append-only. Está
> recogido en el procedimiento enlazado y no debe darse por disponible al firmar.

Firmas: __________________  (Responsable)   __________________ (Encargado)
