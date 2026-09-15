import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { crearApp } from '../src/http/app.js';
import { ownerPool } from '../src/db/pool.js';
import { crearEntidadDemo } from './helpers.js';

// ---------------------------------------------------------------------------
// La ruta que guarda el registro de actividad debe ser siempre la que pidió el
// cliente. Antes se tomaba de `req.path`, que Express recorta al entrar en un
// router montado, así que lo registrado dependía de en qué punto de la pila se
// hubiera respondido: el alta de un usuario quedaba como "POST /".
// ---------------------------------------------------------------------------

const PASS = 'ContraseñaLarga2026';

/**
 * El registro es append-only y compartido, así que cada caso se ancla al
 * último identificador previo: solo mira lo que ha provocado él mismo.
 */
async function ultimaTraza(): Promise<string> {
  const r = await ownerPool.query<{ id: string }>(
    'SELECT COALESCE(MAX(id), 0)::text AS id FROM registro_actividad');
  return r.rows[0]!.id;
}

/** El registro se escribe sin esperar a la respuesta; se le da un margen. */
async function esperarTraza(desdeId: string, ruta: string, estado: number, intentos = 25) {
  for (let i = 0; i < intentos; i++) {
    const r = await ownerPool.query<{ ruta: string; metodo: string; estado_http: number }>(
      `SELECT ruta, metodo, estado_http FROM registro_actividad
        WHERE id > $1 AND ruta = $2 AND estado_http = $3
        ORDER BY id DESC LIMIT 1`,
      [desdeId, ruta, estado],
    );
    if (r.rows[0]) return r.rows[0];
    await new Promise((ok) => setTimeout(ok, 40));
  }
  return null;
}

describe('Registro de actividad: la ruta registrada es la que se pidió', () => {
  let servidor: Server;
  let base: string;

  beforeAll(async () => {
    servidor = crearApp().listen(0);
    await new Promise<void>((ok) => servidor.once('listening', () => ok()));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((ok) => { servidor.close(() => ok()); }));

  it('conserva el prefijo cuando la respuesta sale dentro del router montado', async () => {
    const desde = await ultimaTraza();
    const a = await crearEntidadDemo('LOG1');
    const entrada = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cif: a.cif, email: a.adminEmail, password: a.adminPassword }),
    });
    const { token } = await entrada.json() as { token: string };

    const alta = await fetch(`${base}/admin/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email: `alta-log-${Date.now()}@test.es`, password: PASS,
        roles: [{ rol: 'EMPLEADO', unidadId: null }],
      }),
    });
    expect(alta.status).toBe(201);

    // Antes esto se registraba como "POST /": imposible saber qué se hizo.
    expect(await esperarTraza(desde, '/admin/usuarios', 201)).toMatchObject({ metodo: 'POST' });
  });

  it('registra la misma ruta tanto si falla la validación como si falla la credencial', async () => {
    const desde = await ultimaTraza();
    const comun = { cif: 'X00000000X', dni: 'inexistente@test.es', tipo: 'ENTRADA', origen: 'QUIOSCO' };

    // Credencial inválida: responde el manejador de errores de la app.
    const credencial = await fetch(`${base}/horario/quiosco/fichar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...comun, pin: '0000' }),
    });
    expect(credencial.status).toBe(401);

    // Validación: responde el middleware, dentro del router ya montado.
    const validacion = await fetch(`${base}/horario/quiosco/fichar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...comun, pin: 'no-son-digitos' }),
    });
    expect(validacion.status).toBe(400);

    // Las dos tienen que constar bajo la misma ruta; antes una salía como
    // /horario/quiosco/fichar y la otra como /quiosco/fichar.
    expect(await esperarTraza(desde, '/horario/quiosco/fichar', 401)).toBeTruthy();
    expect(await esperarTraza(desde, '/horario/quiosco/fichar', 400)).toBeTruthy();
    expect(await esperarTraza(desde, '/quiosco/fichar', 400)).toBeNull();
  });

  it('no guarda la cadena de consulta, que lleva identificadores de personas', async () => {
    const desde = await ultimaTraza();
    const a = await crearEntidadDemo('LOG3');
    const entrada = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cif: a.cif, email: a.adminEmail, password: a.adminPassword }),
    });
    const { token } = await entrada.json() as { token: string };

    const personaId = '00000000-0000-4000-8000-000000000123';
    await fetch(`${base}/ausencias/saldos?personaId=${personaId}&anio=2026`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(await esperarTraza(desde, '/ausencias/saldos', 200)).toBeTruthy();
    const conId = await ownerPool.query(
      'SELECT 1 FROM registro_actividad WHERE id > $1 AND ruta LIKE $2', [desde, `%${personaId}%`]);
    expect(conId.rowCount).toBe(0);
  });
});
