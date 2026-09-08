# Procedimiento de gestión de incidentes de seguridad

Cubre ENS **op.exp.7/op.exp.9** y la obligación de notificación de brechas del
RGPD (arts. 33-34) y la LOPDGDD.

## Fases
1. **Detección y registro**: cualquier persona comunica el incidente. Se registra
   con fecha/hora, descripción, sistemas y datos afectados. Fuente de evidencia:
   `registro_actividad` y `auditoria` (ambos inmutables).
2. **Clasificación**: nivel según impacto en confidencialidad/integridad/
   disponibilidad y si afecta a datos personales.
3. **Contención**: revocar sesiones afectadas, bloquear cuentas, aislar el sistema.
4. **Erradicación y recuperación**: eliminar la causa; restaurar desde copia
   verificada si procede (ver [copias](copias-seguridad.md)).
5. **Notificación**:
   - Brecha de datos personales: a la **AEPD en 72 h** (art. 33 RGPD) y a los
     afectados si hay alto riesgo (art. 34).
   - Incidentes de seguridad del ENS: al **CCN-CERT** según corresponda.
6. **Cierre y lecciones aprendidas**: informe y medidas correctoras.

## Roles
- Responsable de seguridad de la entidad: coordina.
- Proveedor (encargado del tratamiento): asiste y aporta evidencias/soporte,
  conforme al [contrato art. 28](../rgpd/contrato-encargado-art28.md).

## Evidencias disponibles en la plataforma
- `registro_actividad`: accesos y acciones (append-only).
- `auditoria`: cambios funcionales con hash-chain (append-only).
- `fichaje_evento`: registros de jornada inmutables.
