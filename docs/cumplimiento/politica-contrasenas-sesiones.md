# Política de contraseñas, sesiones y segregación de funciones

## Contraseñas
- Almacenamiento con **Argon2id** (memoria 19 MiB, 2 iteraciones); nunca en claro.
- Longitud mínima recomendada: 12 caracteres (se valida en la creación de usuario).
- **MFA TOTP** (RFC 6238) opcional por usuario; la semilla se guarda cifrada
  (AES-256-GCM) en reposo.
- **Bloqueo** temporal tras `MAX_INTENTOS_LOGIN` intentos fallidos
  (`BLOQUEO_MINUTOS`).
- Mensajes de error genéricos: no se revela si existe la entidad o el usuario.

## Sesiones
- Token de sesión **opaco**; en base de datos solo se guarda su hash SHA-256.
- Expiración absoluta (`SESSION_TTL_HORAS`) e inactividad (`SESSION_INACTIVIDAD_MINUTOS`).
- Revocación en `logout` y soporte de **rotación** (`sesion.rotado_de`).
- La resolución de sesión actualiza `visto_en` y caduca por inactividad.

## Segregación de funciones (roles)
| Rol | Puede |
|---|---|
| `ADMIN_ENTIDAD` | Administración de la entidad, registro de actividad. |
| `GESTOR_PERSONAL` | Estructura, correcciones de fichaje, ausencias, documentos. |
| `RESPONSABLE_UNIDAD` | Aprobar/denegar ausencias de su unidad, consulta de terceros. |
| `EMPLEADO` | Autoservicio: fichar, solicitar ausencias, ver sus datos/documentos. |
| `RLT` | Consulta **agregada** de jornada (representación legal). |

La autorización se aplica en cada endpoint (`requiereRol`) y el aislamiento por
entidad en la base de datos (RLS forzada), de modo que ni un fallo de código
puede cruzar datos entre entidades.

## Gestión de secretos
- Fuera del repositorio: `.env` está en `.gitignore`.
- En producción: gestor de secretos (variables de entorno inyectadas, KMS o
  equivalente). `APP_ENCRYPTION_KEY` de 32 bytes rota según política de la entidad.
