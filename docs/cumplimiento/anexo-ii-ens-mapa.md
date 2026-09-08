# Mapa de conformidad — Anexo II del ENS (categoría MEDIA)

Real Decreto 311/2022, de 3 de mayo. Este documento es el entregable para el
auditor: relaciona cada medida del Anexo II aplicable a **categoría MEDIA** con
su estado en la plataforma y la evidencia. Es responsabilidad conjunta del
**proveedor** (plataforma) y de cada **entidad** (responsable del tratamiento).

**Leyenda de estado:** ✅ Implementado · 🟡 Parcial · ⛔ Pendiente · 🏛️ Organizativo (de la entidad)

> Nota: las medidas puramente organizativas (políticas, roles, formación) son
> responsabilidad de la entidad; la plataforma aporta los mecanismos técnicos.

## 1. Marco organizativo (org)

| Medida | Descripción | Estado | Evidencia / Pendiente |
|---|---|---|---|
| org.1 | Política de seguridad | 🏛️ | La aprueba la entidad. Plantilla pendiente de entregar. |
| org.2 | Normativa de seguridad | 🏛️ | Uso aceptable, definida por la entidad. |
| org.3 | Procedimientos de seguridad | 🟡 | Incidentes y borrado seguro documentados (ver docs). Resto pendiente. |
| org.4 | Proceso de autorización | 🟡 | Alta de entidades/usuarios controlada; formalización pendiente. |

## 2. Marco operacional (op)

### op.acc — Control de acceso
| Medida | Descripción | Estado | Evidencia / Pendiente |
|---|---|---|---|
| op.acc.1 | Identificación | ✅ | Usuario único por entidad; `usuario.email` único. Sin biometría. |
| op.acc.2 | Requisitos de acceso | ✅ | Autorización por roles (`usuario_rol`) y RLS por entidad. |
| op.acc.3 | Segregación de funciones | ✅ | Roles admin/gestor/responsable/empleado/RLT; endpoints con `requiereRol`. |
| op.acc.4 | Proceso de gestión de derechos | 🟡 | Asignación de roles con vigencia; workflow de aprobación pendiente. |
| op.acc.5 | Mecanismo de autenticación | ✅ | Argon2id + MFA TOTP opcional + bloqueo por intentos + sesión opaca. |
| op.acc.6 | Acceso local/remoto | 🟡 | TLS en tránsito (proxy). Endurecimiento de red a cargo del despliegue. |

### op.exp — Explotación
| Medida | Descripción | Estado | Evidencia / Pendiente |
|---|---|---|---|
| op.exp.1 | Inventario de activos | 🟡 | Código y esquema versionados; inventario formal pendiente. |
| op.exp.2 | Configuración de seguridad | 🟡 | Rol de app `NOBYPASSRLS`, mínimos privilegios. Bastionado del host pendiente. |
| op.exp.3 | Gestión de la configuración | ✅ | Migraciones versionadas desde el commit 1; IaC pendiente. |
| op.exp.4 | Mantenimiento / actualizaciones | 🟡 | Dependencias fijadas; proceso de parcheo a definir por operación. |
| op.exp.5 | Gestión de cambios | ✅ | Control de versiones Git, commits trazables, tests por módulo. |
| op.exp.6 | Protección frente a código dañino | 🟡 | Validación estricta de entrada (zod). Antimalware del host pendiente. |
| op.exp.7 | Gestión de incidentes | 🟡 | Procedimiento documentado (`gestion-incidentes.md`). |
| op.exp.8 | Registro de la actividad | ✅ | `registro_actividad` append-only + middleware; separado del log funcional. |
| op.exp.9 | Registro de gestión de incidentes | 🟡 | Procedimiento definido; herramienta de ticketing a cargo de la entidad. |
| op.exp.10 | Protección de los registros de actividad | ✅ | Append-only (trigger + REVOKE), RLS por entidad, hash-chain en `auditoria`. |

### op.cont — Continuidad del servicio (aplica en MEDIA)
| Medida | Descripción | Estado | Evidencia / Pendiente |
|---|---|---|---|
| op.cont.1 | Análisis de impacto | ⛔ | BIA pendiente. |
| op.cont.2 | Plan de continuidad | ⛔ | Pendiente de operación. |
| op.cont.3 | Pruebas de continuidad | 🟡 | Copia + prueba de restauración: `scripts/backup.sh` y `restore.sh`. |

### op.mon — Monitorización (aplica en MEDIA)
| Medida | Descripción | Estado | Evidencia / Pendiente |
|---|---|---|---|
| op.mon.1 | Detección de intrusión | ⛔ | IDS/IPS a cargo del despliegue. |
| op.mon.2 | Sistema de métricas | 🟡 | Base de trazas en `registro_actividad`; cuadro de mando pendiente. |

## 3. Medidas de protección (mp)

| Medida | Descripción | Estado | Evidencia / Pendiente |
|---|---|---|---|
| mp.if.* | Protección de instalaciones | 🏛️ | CPD/nube del despliegue (infra propia, no BaaS no certificado). |
| mp.per.* | Gestión del personal | 🏛️ | Formación y confidencialidad, de la entidad. |
| mp.com.1 | Perímetro seguro | 🟡 | A cargo del despliegue (firewall/reverse proxy). |
| mp.com.2 | Protección de la confidencialidad (cifrado en tránsito) | 🟡 | TLS terminado en proxy; forzado HTTPS pendiente de config de despliegue. |
| mp.com.3 | Protección de la integridad y autenticidad | ✅ | Hash-chain de auditoría; hash SHA-256 en informes y documentos. |
| mp.info.1 | Datos de carácter personal | ✅ | Minimización: sin datos de salud ni biometría; ver DPIA/RGPD. |
| mp.info.2 | Calificación de la información | 🟡 | Clasificación de documentos básica (tipo); política formal pendiente. |
| mp.info.3 | Cifrado de la información (en reposo) | 🟡 | Secretos sensibles (TOTP) cifrados AES-256-GCM; cifrado de volumen a cargo del despliegue. |
| mp.info.6 | Copias de seguridad | ✅ | `scripts/backup.sh` con hash; restauración probada con `restore.sh`. |
| mp.s.* | Protección de los servicios | 🟡 | Validación de entrada, control de sesión; hardening web adicional pendiente. |
| mp.sw.1 | Desarrollo seguro | ✅ | Validación estricta, RLS, append-only, tests de aislamiento e inmutabilidad. |
| mp.sw.2 | Aceptación y puesta en servicio | 🟡 | Tests automatizados; pruebas de seguridad previas a producción pendientes. |

## Resumen de pendientes prioritarios (para el auditor)
1. Forzar HTTPS y bastionado de red/host en el despliegue (mp.com, op.exp.2).
2. Cifrado de la información en reposo a nivel de volumen (mp.info.3).
3. Plan de continuidad y análisis de impacto (op.cont.1/2).
4. Monitorización/detección de intrusión (op.mon.1).
5. Formalizar políticas y procedimientos organizativos (org.1–4).

## Documentos relacionados
- [Análisis de riesgos](analisis-riesgos.md)
- [Declaración de aplicabilidad](declaracion-aplicabilidad.md)
- [Política de contraseñas, sesiones y segregación](politica-contrasenas-sesiones.md)
- [Copias de seguridad y prueba de restauración](copias-seguridad.md)
- [Gestión de incidentes](gestion-incidentes.md)
- [Borrado seguro](borrado-seguro.md)
- [Contrato de encargado del tratamiento (art. 28 RGPD)](../rgpd/contrato-encargado-art28.md)
