import { describe, it, expect } from 'vitest';
import { conTenant, ownerPool } from '../src/db/pool.js';
import { autenticarQuiosco, establecerPin } from '../src/auth/service.js';
import { hashearPassword } from '../src/auth/passwords.js';
import * as est from '../src/domain/estructura.js';
import {
  fichar, corregirFichaje, listarFichajes, notificacionesDe,
  marcarNotificacionLeida, marcarTodasLeidas,
} from '../src/domain/fichaje.js';
import { totalizar, resolverEfectivos } from '../src/domain/totalizacion.js';
import { crearEntidadDemo } from './helpers.js';

async function personaEn(entidadId: string, doc: string) {
  return est.crearPersona({ entidadId, usuarioId: null }, {
    tipoDocumento: 'DNI', numDocumento: doc, nombre: 'Test', apellido1: 'Persona',
  });
}

// Inserta un evento con momento_servidor controlado (para totalización determinista).
async function insertarEvento(entidadId: string, personaId: string, tipo: string, iso: string) {
  return conTenant({ entidadId, usuarioId: null }, async (ej) => {
    const r = await ej.query(
      `INSERT INTO fichaje_evento (entidad_id, persona_id, tipo, origen, momento_servidor)
       VALUES (app_entidad_id(), $1, $2, 'WEB', $3) RETURNING *`,
      [personaId, tipo, iso],
    );
    return r.rows[0]!;
  });
}

describe('Control horario', () => {
  it('resolverEfectivos aplica MODIFICA, ANULA y ANADE (unitario)', () => {
    const brutos: any[] = [
      { id: 'e1', tipo: 'ENTRADA', origen: 'WEB', momento_servidor: '2025-03-03T09:00:00+01:00', momento_cliente: null, corrige_evento_id: null, accion_correccion: null },
      { id: 'e2', tipo: 'SALIDA', origen: 'WEB', momento_servidor: '2025-03-03T15:00:00+01:00', momento_cliente: null, corrige_evento_id: null, accion_correccion: null },
      // Corrige la salida de las 15:00 a las 17:00.
      { id: 'c1', tipo: 'SALIDA', origen: 'CORRECCION', momento_servidor: '2025-03-04T10:00:00+01:00', momento_cliente: '2025-03-03T17:00:00+01:00', corrige_evento_id: 'e2', accion_correccion: 'MODIFICA' },
    ];
    const ef = resolverEfectivos(brutos);
    expect(ef).toHaveLength(2);
    expect(ef[1]!.tipo).toBe('SALIDA');
    expect(ef[1]!.momento.toISOString()).toBe(new Date('2025-03-03T17:00:00+01:00').toISOString());
  });

  it('totaliza jornada con saldo y extras', async () => {
    const a = await crearEntidadDemo('FICH1');
    const p = await personaEn(a.entidadId, '10000001A');
    await insertarEvento(a.entidadId, p.id as string, 'ENTRADA', '2025-03-03T09:00:00+01:00');
    await insertarEvento(a.entidadId, p.id as string, 'SALIDA', '2025-03-03T17:00:00+01:00');
    const t = await totalizar({ entidadId: a.entidadId, usuarioId: null }, p.id as string, '2025-03-03', '2025-03-03');
    expect(t.dias).toHaveLength(1);
    expect(t.dias[0]!.trabajadoMin).toBe(480); // 8 h
    expect(t.dias[0]!.teoricoMin).toBe(450);   // 7,5 h (lunes)
    expect(t.dias[0]!.saldoMin).toBe(30);
    expect(t.dias[0]!.extrasMin).toBe(30);
    expect(t.dias[0]!.esFestivo).toBe(false);
  });

  it('descuenta las pausas del tiempo trabajado', async () => {
    const a = await crearEntidadDemo('FICH2');
    const p = await personaEn(a.entidadId, '10000002B');
    await insertarEvento(a.entidadId, p.id as string, 'ENTRADA', '2025-03-04T08:00:00+01:00');
    await insertarEvento(a.entidadId, p.id as string, 'INICIO_PAUSA', '2025-03-04T10:00:00+01:00');
    await insertarEvento(a.entidadId, p.id as string, 'FIN_PAUSA', '2025-03-04T10:30:00+01:00');
    await insertarEvento(a.entidadId, p.id as string, 'SALIDA', '2025-03-04T15:30:00+01:00');
    const t = await totalizar({ entidadId: a.entidadId, usuarioId: null }, p.id as string, '2025-03-04', '2025-03-04');
    expect(t.dias[0]!.trabajadoMin).toBe(420); // 7,5 h presencia - 0,5 h pausa = 7 h... 7,5-0,5=7h=420
  });

  it('la corrección crea un evento nuevo, conserva el original y notifica', async () => {
    const a = await crearEntidadDemo('FICH3');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const p = await personaEn(a.entidadId, '10000003C');
    const orig = await fichar(ctx, { personaId: p.id as string, tipo: 'ENTRADA', origen: 'WEB' });
    const corr = await corregirFichaje(ctx, {
      accion: 'MODIFICA', corrigeEventoId: orig.id as string, tipo: 'ENTRADA',
      momentoCliente: '2025-03-03T08:00:00+01:00', motivo: 'Olvidó fichar la entrada real',
    });
    expect(corr.origen).toBe('CORRECCION');
    expect(corr.corrige_evento_id).toBe(orig.id);
    // El original sigue existiendo.
    const eventos = await listarFichajes(ctx, p.id as string, '2000-01-01', '2100-01-01');
    expect(eventos.some((e) => e.id === orig.id)).toBe(true);
    // Se notifica a la persona.
    const notis = await notificacionesDe(ctx, p.id as string);
    expect(notis.some((n) => n.tipo === 'FICHAJE_CORREGIDO')).toBe(true);
  });

  it('el empleado puede marcar sus avisos como leídos', async () => {
    const a = await crearEntidadDemo('FICH5');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const p = await personaEn(a.entidadId, '10000005Y');
    const orig = await fichar(ctx, { personaId: p.id as string, tipo: 'ENTRADA', origen: 'WEB' });
    await corregirFichaje(ctx, {
      accion: 'ANULA', corrigeEventoId: orig.id as string, motivo: 'Fichaje duplicado',
    });

    let notis = await notificacionesDe(ctx, p.id as string);
    const pendiente = notis.find((n) => !n.leida_en)!;
    expect(pendiente).toBeTruthy();

    // Otra persona no puede marcarlo como leído.
    const otra = await personaEn(a.entidadId, '10000006F');
    expect(await marcarNotificacionLeida(ctx, pendiente.id as string, otra.id as string)).toBeNull();

    // El destinatario sí.
    const leida = await marcarNotificacionLeida(ctx, pendiente.id as string, p.id as string);
    expect(leida?.leida_en).toBeTruthy();

    // Y "leer todas" no deja pendientes.
    await marcarTodasLeidas(ctx, p.id as string);
    notis = await notificacionesDe(ctx, p.id as string);
    expect(notis.filter((n) => !n.leida_en)).toHaveLength(0);
  });

  it('el fichaje es append-only: no admite UPDATE/DELETE del rol de app', async () => {
    const a = await crearEntidadDemo('FICH4');
    const p = await personaEn(a.entidadId, '10000004D');
    await insertarEvento(a.entidadId, p.id as string, 'ENTRADA', '2025-03-03T09:00:00+01:00');
    await expect(
      conTenant({ entidadId: a.entidadId, usuarioId: null }, async (ej) => {
        await ej.query(`UPDATE fichaje_evento SET tipo = 'SALIDA' WHERE persona_id = $1`, [p.id]);
      }),
    ).rejects.toThrow(/append-only|permission denied/i);
    await expect(
      conTenant({ entidadId: a.entidadId, usuarioId: null }, async (ej) => {
        await ej.query(`DELETE FROM fichaje_evento WHERE persona_id = $1`, [p.id]);
      }),
    ).rejects.toThrow(/append-only|permission denied/i);
  });

  it('autentica en quiosco por DNI o por email indistintamente', async () => {
    const a = await crearEntidadDemo('QUIOS');
    const p = await personaEn(a.entidadId, '44556677Z');
    const hash = await hashearPassword('Clave1234!');
    const u = await ownerPool.query<{ id: string }>(
      `INSERT INTO usuario (entidad_id, persona_id, email, password_hash)
       VALUES ($1, $2, 'quiosco.test@demo.es', $3) RETURNING id`,
      [a.entidadId, p.id, hash],
    );
    await establecerPin(u.rows[0]!.id, '4321');

    // 1) Autenticación por DNI exacto
    const q1 = await autenticarQuiosco({ cif: a.cif, identificador: '44556677Z', pin: '4321' });
    expect(q1.usuarioId).toBe(u.rows[0]!.id);
    expect(q1.personaId).toBe(p.id);

    // 2) Autenticación por DNI con guión o minúsculas
    const q2 = await autenticarQuiosco({ cif: a.cif, identificador: '44556677-z', pin: '4321' });
    expect(q2.usuarioId).toBe(u.rows[0]!.id);

    // 3) Autenticación por correo
    const q3 = await autenticarQuiosco({ cif: a.cif, identificador: 'quiosco.test@demo.es', pin: '4321' });
    expect(q3.usuarioId).toBe(u.rows[0]!.id);

    // 4) PIN incorrecto falla
    await expect(autenticarQuiosco({ cif: a.cif, identificador: '44556677Z', pin: '9999' }))
      .rejects.toMatchObject({ codigo: 'CREDENCIALES' });

    // 5) DNI inexistente falla
    await expect(autenticarQuiosco({ cif: a.cif, identificador: '99999999R', pin: '4321' }))
      .rejects.toMatchObject({ codigo: 'CREDENCIALES' });
  });
});
