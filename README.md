# Plataforma RRHH — sector público (MVP)

SaaS de gestión de RRHH para entidades locales españolas. Sustituye papel y Excel,
**no** la nómina. Sin biometría, con registro inmutable, multi-tenant aislado y
orientado a ENS categoría MEDIA.

## Estado (MVP completo)

- **Fase 1 — Estructura organizativa, multi-tenant, auth, auditoría** ✅
- **Fase 2 — Control horario** (fichaje inmutable, correcciones, totalización, export PDF/CSV) ✅
- **Fase 3 — Vacaciones y permisos** (motor de reglas, calendario, flujo de aprobación) ✅
- **Fase 4 — Portal del empleado** (PWA React accesible WCAG 2.1 AA) ✅
- **Fase 5 — Cumplimiento y preparación ENS** (registro de actividad, copias, documentación) ✅

Ver diseño en [docs/decisiones-arquitectura.md](docs/decisiones-arquitectura.md),
[docs/esquema-propuesto.sql](docs/esquema-propuesto.sql) y la documentación de
cumplimiento en [docs/cumplimiento/](docs/cumplimiento/anexo-ii-ens-mapa.md).

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

# 8) Portal del empleado (PWA) en desarrollo
npm run dev -w @rrhh/web   # http://localhost:5173 (proxy /api -> :3001)
```

Logins de demo tras el seed (CIF `P4600001A`):
- Administrador: `admin@demo.es` / `Demo1234!` (cuadro de mando + back-office)
- Empleado (portal): `empleado@demo.es` / `Demo1234!` (PIN de quiosco `1234`)

## Despliegue "como en producción" (Docker)

Todo compilado y servido por **nginx** en un único origen, con Postgres propio y
migraciones + datos de demo aplicados automáticamente al arrancar:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Abre **http://localhost:8080** (mismos logins de demo). Para parar:

```bash
docker compose -f docker-compose.prod.yml down        # conserva datos
docker compose -f docker-compose.prod.yml down -v      # borra también el volumen
```

Diferencias con el modo desarrollo: frontend *build* minificado (no Vite),
API compilada a JS (no `tsx`), reverse proxy real con cabeceras de seguridad y
un solo puerto expuesto. Los secretos del compose son de demostración: en un
despliegue real van en un gestor de secretos y detrás de HTTPS.

## Copias de seguridad (ENS)

```bash
scripts/backup.sh ./backups                       # copia con hash de integridad
scripts/restore.sh ./backups/rrhh_XXXX.dump       # prueba de restauración en BD aparte
```

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
