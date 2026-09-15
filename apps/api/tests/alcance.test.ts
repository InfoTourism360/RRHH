import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Request } from 'express';
import { crearApp } from '../src/http/app.js';
import { alcanceDe, mandaSobrePersona, mandaSobreUnidad } from '../src/http/alcance.js';
import * as est from '../src/domain/estructura.js';
import * as aus from '../src/domain/ausencias.js';
import * as usr from '../src/domain/usuarios.js';
import { crearEntidadDemo } from './helpers.js';

// ---------------------------------------------------------------------------
// Competencia de un responsable de unidad. Estos tests intentan romperla a
// propósito: el fallo no era que faltara el rol, sino que teniendo el rol se
// podía actuar sobre cualquiera de la entidad.
// ---------------------------------------------------------------------------

const PASS = 'ContraseñaLarga2026';
let dni = 40000000;
const siguienteDni = () => `${dni++}X`;

function peticion(sesion: {
  entidadId: string; usuarioId: string; personaId: string | null;
  roles: { rol: string; unidadId: string | null }[];
}): Request {
  return { sesion: { sesionId: 'test', ...sesion } } as unknown as Request;
}

interface Escenario {
  entidadId: string; cif: string; ctx: { entidadId: string; usuarioId: string };
  unidadA: string; unidadA1: string; unidadB: string;
  personaA: string; personaA1: string; personaB: string;
  jefeA: { usuarioId: string; email: string };
}

async function montar(prefijo: string): Promise<Escenario> {
  const a = await crearEntidadDemo(prefijo);
  const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
  await aus.precargarCatalogo(ctx);

  const uA = await est.crearUnidad(ctx, { codigo: `${prefijo}-A`, denominacion: 'Área A' });
  const uA1 = await est.crearUnidad(ctx, {
    codigo: `${prefijo}-A1`, denominacion: 'Sección A1', padreId: uA.id as string,
  });
  const uB = await est.crearUnidad(ctx, { codigo: `${prefijo}-B`, denominacion: 'Área B' });

  const plaza = await est.crearPlaza(ctx, {
    codigo: `${prefijo}-P`, denominacion: 'Plaza', grupoCodigo: 'C1', dotacion: 9,
  });

  async function empleadoEn(unidadId: string, sufijo: string, ocupaEfectivo = true) {
    const persona = await est.crearPersona(ctx, {
      tipoDocumento: 'DNI', numDocumento: siguienteDni(), nombre: 'Emp', apellido1: sufijo,
    });
    const puesto = await est.crearPuesto(ctx, {
      plazaId: plaza.id as string, unidadId, codigo: `${prefijo}-${sufijo}`,
      denominacion: `Puesto ${sufijo}`, nivelCd: 18,
    });
    await est.crearRelacion(ctx, {
      personaId: persona.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_CARRERA', situacionCodigo: ocupaEfectivo ? 'SERV_ACTIVO' : 'EXCEDENCIA_CUID',
      tomaPosesion: '2024-01-01', ocupaEfectivo,
    });
    return persona.id as string;
  }

  const personaA = await empleadoEn(uA.id as string, 'A');
  const personaA1 = await empleadoEn(uA1.id as string, 'A1');
  const personaB = await empleadoEn(uB.id as string, 'B');

  const email = `jefe-${prefijo}@test.es`.toLowerCase();
  const jefe = await usr.crearUsuario(ctx, {
    email, password: PASS,
    roles: [{ rol: 'RESPONSABLE_UNIDAD', unidadId: uA.id as string }],
  });

  return {
    entidadId: a.entidadId, cif: a.cif, ctx,
    unidadA: uA.id as string, unidadA1: uA1.id as string, unidadB: uB.id as string,
    personaA, personaA1, personaB,
    jefeA: { usuarioId: jefe.id as string, email },
  };
}

describe('Competencia por unidad', () => {
  it('un responsable manda sobre su unidad y sobre las que cuelgan de ella', async () => {
    const e = await montar('ALC1');
    const req = peticion({
      entidadId: e.entidadId, usuarioId: e.jefeA.usuarioId, personaId: null,
      roles: [{ rol: 'RESPONSABLE_UNIDAD', unidadId: e.unidadA }],
    });
    expect(await mandaSobrePersona(req, e.personaA)).toBe(true);
    expect(await mandaSobrePersona(req, e.personaA1)).toBe(true); // jerarquía hacia abajo
    expect(await mandaSobreUnidad(req, e.unidadA1)).toBe(true);
  });

  it('un responsable NO manda sobre otra unidad', async () => {
    const e = await montar('ALC2');
    const req = peticion({
      entidadId: e.entidadId, usuarioId: e.jefeA.usuarioId, personaId: null,
      roles: [{ rol: 'RESPONSABLE_UNIDAD', unidadId: e.unidadA }],
    });
    expect(await mandaSobrePersona(req, e.personaB)).toBe(false);
    expect(await mandaSobreUnidad(req, e.unidadB)).toBe(false);
  });

  it('un responsable sin unidad asignada no manda sobre nadie', async () => {
    // Regresión: antes "sin unidad" se leía como "toda la entidad".
    const e = await montar('ALC3');
    const req = peticion({
      entidadId: e.entidadId, usuarioId: e.jefeA.usuarioId, personaId: null,
      roles: [{ rol: 'RESPONSABLE_UNIDAD', unidadId: null }],
    });
    expect(alcanceDe(req).tipo).toBe('PROPIO');
    expect(await mandaSobrePersona(req, e.personaA)).toBe(false);
    expect(await mandaSobrePersona(req, e.personaB)).toBe(false);
    expect(await mandaSobreUnidad(req, e.unidadA)).toBe(false);
  });

  it('gestión alcanza toda la entidad y cualquiera se alcanza a sí mismo', async () => {
    const e = await montar('ALC4');
    const gestor = peticion({
      entidadId: e.entidadId, usuarioId: e.ctx.usuarioId, personaId: null,
      roles: [{ rol: 'GESTOR_PERSONAL', unidadId: null }],
    });
    expect(alcanceDe(gestor).tipo).toBe('ENTIDAD');
    expect(await mandaSobrePersona(gestor, e.personaB)).toBe(true);

    const empleado = peticion({
      entidadId: e.entidadId, usuarioId: e.jefeA.usuarioId, personaId: e.personaB,
      roles: [{ rol: 'EMPLEADO', unidadId: null }],
    });
    expect(await mandaSobrePersona(empleado, e.personaB)).toBe(true);
    expect(await mandaSobrePersona(empleado, e.personaA)).toBe(false);
  });

  it('la cola de pendientes no pierde a quien no ocupa plaza de forma efectiva', async () => {
    // Regresión: el JOIN exigía ocupa_efectivo y la solicitud de quien estaba
    // en excedencia o comisión desaparecía de la cola sin dar error.
    const a = await crearEntidadDemo('ALC5');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    await aus.precargarCatalogo(ctx);
    const unidad = await est.crearUnidad(ctx, { codigo: 'ALC5-U', denominacion: 'Unidad' });
    const plaza = await est.crearPlaza(ctx, {
      codigo: 'ALC5-P', denominacion: 'Plaza', grupoCodigo: 'C1', dotacion: 2,
    });
    const persona = await est.crearPersona(ctx, {
      tipoDocumento: 'DNI', numDocumento: siguienteDni(), nombre: 'En', apellido1: 'Excedencia',
    });
    const puesto = await est.crearPuesto(ctx, {
      plazaId: plaza.id as string, unidadId: unidad.id as string,
      codigo: 'ALC5-PU', denominacion: 'Puesto', nivelCd: 20,
    });
    await est.crearRelacion(ctx, {
      personaId: persona.id as string, puestoId: puesto.id as string,
      tipoCodigo: 'FUNC_CARRERA', situacionCodigo: 'EXCEDENCIA_CUID',
      tomaPosesion: '2024-01-01', ocupaEfectivo: false,
    });
    await aus.asignarSaldo(ctx, {
      personaId: persona.id as string, tipoCodigo: 'VACACIONES', anio: 2025, dias: 22,
    });
    const sol = await aus.solicitar(ctx, {
      personaId: persona.id as string, tipoCodigo: 'VACACIONES',
      fechaInicio: '2025-06-02', fechaFin: '2025-06-03',
    });

    const todas = await aus.pendientesUnidad(ctx, null);
    expect(todas.map((s) => s.id)).toContain(sol.id);

    const deSuUnidad = await aus.pendientesUnidad(ctx, [unidad.id as string]);
    expect(deSuUnidad.map((s) => s.id)).toContain(sol.id);
  });
});

describe('Competencia por unidad, sobre la API real', () => {
  let servidor: Server;
  let base: string;

  beforeAll(async () => {
    servidor = crearApp().listen(0);
    await new Promise<void>((ok) => servidor.once('listening', () => ok()));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((ok) => { servidor.close(() => ok()); }));

  async function entrar(cif: string, email: string): Promise<Record<string, string>> {
    const r = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cif, email, password: PASS }),
    });
    expect(r.status).toBe(200);
    const { token } = await r.json() as { token: string };
    return { Authorization: `Bearer ${token}` };
  }

  it('no deja resolver por identificador una solicitud de otra unidad', async () => {
    const e = await montar('ALC6');
    await aus.asignarSaldo(e.ctx, { personaId: e.personaB, tipoCodigo: 'VACACIONES', anio: 2025, dias: 22 });
    const sol = await aus.solicitar(e.ctx, {
      personaId: e.personaB, tipoCodigo: 'VACACIONES', fechaInicio: '2025-07-07', fechaFin: '2025-07-08',
    });
    const cabeceras = await entrar(e.cif, e.jefeA.email);

    // No aparece en su cola...
    const cola = await (await fetch(`${base}/ausencias/solicitudes/pendientes`, { headers: cabeceras })).json();
    expect((cola as { id: string }[]).map((s) => s.id)).not.toContain(sol.id);

    // ...y tampoco puede resolverla entrando por identificador.
    const intento = await fetch(`${base}/ausencias/solicitudes/${sol.id}/aprobar`, {
      method: 'POST', headers: cabeceras,
    });
    expect(intento.status).toBe(403);

    const despues = await aus.misSolicitudes(e.ctx, e.personaB);
    expect(despues.find((s) => s.id === sol.id)?.estado).toBe('SOLICITADA');
  });

  it('sí resuelve las de su propia unidad', async () => {
    const e = await montar('ALC7');
    await aus.asignarSaldo(e.ctx, { personaId: e.personaA1, tipoCodigo: 'VACACIONES', anio: 2025, dias: 22 });
    const sol = await aus.solicitar(e.ctx, {
      personaId: e.personaA1, tipoCodigo: 'VACACIONES', fechaInicio: '2025-07-07', fechaFin: '2025-07-08',
    });
    const cabeceras = await entrar(e.cif, e.jefeA.email);

    const cola = await (await fetch(`${base}/ausencias/solicitudes/pendientes`, { headers: cabeceras })).json();
    expect((cola as { id: string }[]).map((s) => s.id)).toContain(sol.id);

    const ok = await fetch(`${base}/ausencias/solicitudes/${sol.id}/aprobar`, {
      method: 'POST', headers: cabeceras,
    });
    expect(ok.status).toBe(200);
  });

  it('un responsable no se descarga la jornada de otra unidad', async () => {
    const e = await montar('ALC9');
    const cabeceras = await entrar(e.cif, e.jefeA.email);
    const rango = 'desde=2025-01-01&hasta=2025-12-31';

    const ajena = await fetch(`${base}/horario/informe.pdf?personaId=${e.personaB}&${rango}`, { headers: cabeceras });
    expect(ajena.status).toBe(403);

    const propia = await fetch(`${base}/horario/fichajes?personaId=${e.personaA1}&${rango}`, { headers: cabeceras });
    expect(propia.status).toBe(200);
  });

  it('un empleado no alcanza la ficha de personal ni el historial de auditoría', async () => {
    const e = await montar('ALC8');
    const email = `curioso-${Date.now()}@test.es`;
    await usr.crearUsuario(e.ctx, {
      email, password: PASS, personaId: e.personaA,
      roles: [{ rol: 'EMPLEADO', unidadId: null }],
    });
    const cabeceras = await entrar(e.cif, email);

    for (const ruta of ['/estructura/personas', '/estructura/relaciones']) {
      expect((await fetch(`${base}${ruta}`, { headers: cabeceras })).status).toBe(403);
    }
    const hist = await fetch(`${base}/estructura/auditoria/relacion_servicio/${e.personaB}`, { headers: cabeceras });
    expect(hist.status).toBe(403);
  });
});
