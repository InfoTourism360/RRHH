# Decisiones de arquitectura — Fase 1 (propuesta para validación)

Cada decisión en dos frases: qué elijo y qué descarto. Nada implementado aún.

## 1. Aislamiento multi-tenant: RLS por fila (no esquema por tenant)
Uso una sola base con `entidad_id` en cada tabla y **Row Level Security FORZADA** (`FORCE`), con la app conectada como rol `NOBYPASSRLS` que fija `SET LOCAL app.entidad_id` por transacción. Descarto *schema-per-tenant* (multiplica migraciones y complica catálogos compartidos) y *base-per-tenant* (sobredimensionado para 20–300 empleados por entidad); el aislamiento va en el motor, no solo en el código de la aplicación.

## 2. Inmutabilidad: append-only real en BD, no "papelera lógica"
La auditoría (y en Fase 2 los fichajes) rechazan `UPDATE/DELETE` por **trigger + `REVOKE`**, y las correcciones son filas nuevas que referencian a la original con motivo obligatorio. Descarto el patrón "flag `borrado=true`" porque no impide la modificación del dato original, que es justo lo que exige el RD de registro horario digital.

## 3. Histórico: vigencias `desde/hasta` (SCD-2), no sobrescritura
Todo lo versionable lleva `vigencia_desde`/`vigencia_hasta` (NULL = vigente) y los estados como *vacante* o *excedencia* son **derivados** (vistas / `situacion_codigo`), nunca columnas que se pisan. Descarto guardar el estado actual mutable + tabla de histórico aparte porque duplica la verdad y abre la puerta a incoherencias.

## 4. Modelo público PLAZA → PUESTO → OCUPANTE
Modelo la plantilla presupuestaria (`plaza`) y la RPT (`puesto`) como entidades independientes de la persona, y la ocupación como `relacion_servicio` con rango temporal. Descarto el modelo privado "empleado→departamento" porque no representa plazas vacantes, ocupantes sucesivos ni situaciones administrativas.

## 5. No-solape de ocupación garantizado por el motor
Una `EXCLUDE USING gist` impide que dos personas ocupen el mismo puesto en fechas solapadas dentro de una entidad (extensión `btree_gist`). Descarto validarlo solo en la aplicación porque una condición de carrera dejaría datos corruptos en una tabla que es prueba legal.

## 6. Catálogos TREBEP como tablas, no enums
Grupos (A1…E/AP), escalas, tipos de relación, situaciones administrativas, formas de provisión y jornadas van en tablas `cat_*` estatales compartidas (sin `entidad_id`). Descarto enums en código porque cambian por reforma normativa y algunos deben ser matizables sin desplegar.

## 7. Identificadores UUID
Claves `uuid` con `gen_random_uuid()` para no filtrar volúmenes ni permitir enumeración entre tenants. Descarto `bigserial` en tablas de negocio (predecible y "adivinable" en URLs); la auditoría sí usa `identity` secuencial porque el orden importa para el encadenamiento.

## 8. Auth propia con sesiones opacas
Sesiones server-side con token opaco (se almacena solo su hash), Argon2id para contraseñas, MFA TOTP opcional, bloqueo por intentos y rotación de sesión. Descarto JWT sin estado (no se puede revocar de inmediato, mal encaje con exigencias ENS) y cualquier BaaS de auth (Auth0/Firebase) por la restricción ENS.

## 9. Stack y despliegue
React+TS+Vite (PWA, sin librería de componentes pesada para controlar la accesibilidad) y Node+TS con API REST y validación estricta por endpoint. Descarto frameworks full-stack con funciones cloud (Vercel/Supabase) por ENS; todo autoalojado con Postgres propio y migraciones versionadas desde el commit 1.

## 10. Cifrado del secreto TOTP en la aplicación
`mfa_totp_secret` se guarda cifrado (clave fuera del repo, gestor de secretos — se concreta en Fase 5), no en claro. Descarto guardarlo en claro aunque sea cómodo para el MVP porque es material sensible de segundo factor.

## Pendiente explícito para fases siguientes (no en Fase 1)
- Detalle de `entidad.politicas` (jornada, tolerancias, geocerca) → Fase 2.
- Tablas de fichaje inmutable, totalizaciones y exportación con hash → Fase 2.
- Motor de reglas de ausencias y calendario laboral → Fase 3.
- Registro de actividad ENS separado del log funcional → Fase 5.
