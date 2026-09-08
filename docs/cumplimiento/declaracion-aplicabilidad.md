# Declaración de aplicabilidad (DAP)

Sistema: **Plataforma de gestión de RRHH del sector público**. Categoría del
sistema: **MEDIA** (RD 311/2022), determinada por las dimensiones de seguridad:

| Dimensión | Nivel | Justificación |
|---|---|---|
| Confidencialidad | Medio | Datos personales de empleados públicos, sin categorías especiales en claro. |
| Integridad | Alto→Medio | Los registros de jornada tienen valor probatorio; se protegen con inmutabilidad. |
| Trazabilidad | Medio | Exigible para registro horario y ENS. |
| Autenticidad | Medio | Identificación por credenciales; MFA disponible. |
| Disponibilidad | Medio | Servicio de gestión interna; tolera interrupciones cortas. |

## Medidas del Anexo II aplicadas
Se aplican todas las medidas del Anexo II correspondientes a categoría MEDIA.
El detalle medida a medida, con estado y evidencia, está en el
[mapa Anexo II](anexo-ii-ens-mapa.md).

## Exclusiones
- **Biometría**: excluida por decisión de diseño y por criterio AEPD (no hay
  habilitación suficiente para control horario). No se aplican medidas de
  tratamiento biométrico porque no existe tal dato en el sistema.
- Medidas de categoría ALTA: no aplican al no ser el sistema de categoría alta.

## Reparto de responsabilidades
- **Proveedor**: medidas técnicas del producto (acceso, cifrado de secretos,
  inmutabilidad, RLS, registro de actividad, copias).
- **Entidad**: políticas organizativas, despliegue seguro (HTTPS, red, host),
  continuidad, formación y gestión de usuarios.
