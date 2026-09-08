# Plataforma RRHH — sector público (MVP)

SaaS de gestión de RRHH para entidades locales españolas. Sustituye papel y Excel,
**no** la nómina. Sin biometría, con registro inmutable, multi-tenant aislado y
orientado a ENS categoría MEDIA.

## Estado

- **Fase 1 — Estructura, multi-tenant, auth, auditoría**: implementada (backend).
- Fases 2–5: pendientes (control horario, ausencias, portal, cumplimiento ENS).

Ver diseño en [docs/decisiones-arquitectura.md](docs/decisiones-arquitectura.md) y
[docs/esquema-propuesto.sql](docs/esquema-propuesto.sql).

## Requisitos

- Node ≥ 22
- Docker Desktop (para PostgreSQL). **Debe estar iniciado y con el engine activo.**

## Puesta en marcha

```bash
# 1) Base de datos (requiere Docker Desktop arrancado)
docker compose up -d db

# 2) Dependencias
npm install

# 3) Configuración del backend (copia y ajusta si hace falta)
#    Ya existe apps/api/.env para desarrollo local.

# 4) Migraciones (crea esquema, RLS, rol de aplicación y catálogos TREBEP)
npm run migrate

# 5) Datos de demo (ayuntamiento ficticio de ~60 efectivos)
npm run seed

# 6) Tests (aislamiento multi-tenant, inmutabilidad, vigencias, auth)
npm test

# 7) API en desarrollo
npm run dev:api   # http://localhost:3001/salud
```

Login de demo tras el seed: `admin@villademo.es` / `Demo1234!` (CIF `P4600001A`).

## Arquitectura (resumen)

- **Multi-tenant**: una BD, RLS **forzada** por `entidad_id`. La app se conecta con
  un rol `NOBYPASSRLS` y fija `app.entidad_id` por transacción (`conTenant`).
- **Inmutabilidad**: `auditoria` es append-only (trigger + `REVOKE UPDATE/DELETE`),
  con encadenamiento de hash. Es la base del registro horario digital (Fase 2).
- **Histórico**: modelo `PLAZA → PUESTO → OCUPANTE` con vigencias; la vacancia y la
  reserva de puesto son estados **derivados**, nunca sobrescritos.
- **Auth propia**: Argon2id, sesiones opacas (se guarda el hash), MFA TOTP opcional,
  bloqueo por intentos y expiración/rotación.

## Notas

- Zona horaria `Europe/Madrid`; producto en `es-ES` (i18n preparado para ca/eu/gl/va).
- `apps/api/.env` contiene secretos de desarrollo y está fuera de control de versiones.
