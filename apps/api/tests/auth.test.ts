import { describe, it, expect } from 'vitest';
import {
  login, resolverSesion, logout, ErrorAuth, autenticarQuiosco, establecerPin,
} from '../src/auth/service.js';
import * as est from '../src/domain/estructura.js';
import * as usr from '../src/domain/usuarios.js';
import { crearEntidadDemo } from './helpers.js';
import { env } from '../src/config/env.js';

describe('Autenticación y sesiones', () => {
  it('login correcto devuelve token y sesión resoluble', async () => {
    const a = await crearEntidadDemo('AUTH1');
    const { token, sesion } = await login({ cif: a.cif, email: a.adminEmail, password: a.adminPassword });
    expect(token).toBeTruthy();
    expect(sesion.roles.map((r) => r.rol)).toContain('ADMIN_ENTIDAD');
    const resuelta = await resolverSesion(token);
    expect(resuelta?.entidadId).toBe(a.entidadId);
  });

  it('password incorrecta falla con mensaje genérico', async () => {
    const a = await crearEntidadDemo('AUTH2');
    await expect(login({ cif: a.cif, email: a.adminEmail, password: 'malísima' }))
      .rejects.toMatchObject({ codigo: 'CREDENCIALES' });
  });

  it('se bloquea la cuenta tras superar el máximo de intentos', async () => {
    const a = await crearEntidadDemo('AUTH3');
    for (let i = 0; i < env.MAX_INTENTOS_LOGIN; i++) {
      await login({ cif: a.cif, email: a.adminEmail, password: 'no' }).catch(() => {});
    }
    // Incluso con la password correcta, ahora está bloqueada.
    await expect(login({ cif: a.cif, email: a.adminEmail, password: a.adminPassword }))
      .rejects.toMatchObject({ codigo: 'BLOQUEADO' });
  });

  it('logout revoca la sesión', async () => {
    const a = await crearEntidadDemo('AUTH4');
    const { token } = await login({ cif: a.cif, email: a.adminEmail, password: a.adminPassword });
    await logout(token);
    expect(await resolverSesion(token)).toBeNull();
  });

  it('no revela si la entidad existe', async () => {
    await expect(login({ cif: 'X00000000X', email: 'x@x.es', password: 'x' }))
      .rejects.toBeInstanceOf(ErrorAuth);
  });
});

// ---------------------------------------------------------------------------
// PIN de quiosco. Son cuatro dígitos: sin freno se agotan probando. El freno
// tiene que ser suyo, porque si compartiera contador con la contraseña,
// cualquiera dejaría a un compañero sin acceso web desde el terminal.
// ---------------------------------------------------------------------------

const PASS_QUIOSCO = 'ContraseñaLarga2026';
let docQuiosco = 50000000;

async function usuarioConPin(prefijo: string, pin: string) {
  const a = await crearEntidadDemo(prefijo);
  const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
  const persona = await est.crearPersona(ctx, {
    tipoDocumento: 'DNI', numDocumento: `${docQuiosco++}K`, nombre: 'Quios', apellido1: 'Co',
  });
  const email = `quiosco-${prefijo}@test.es`.toLowerCase();
  const u = await usr.crearUsuario(ctx, {
    email, password: PASS_QUIOSCO, personaId: persona.id as string,
    roles: [{ rol: 'EMPLEADO', unidadId: null }],
  });
  await establecerPin(u.id as string, pin);
  return { a, email, usuarioId: u.id as string, dni: persona.num_documento as string };
}

describe('PIN de quiosco', () => {
  it('bloquea tras el máximo de intentos, incluso con el PIN correcto', async () => {
    const q = await usuarioConPin('PIN1', '4321');
    for (let i = 0; i < env.MAX_INTENTOS_PIN; i++) {
      await autenticarQuiosco({ cif: q.a.cif, dni: q.dni, pin: '0000' }).catch(() => {});
    }
    await expect(autenticarQuiosco({ cif: q.a.cif, dni: q.dni, pin: '4321' }))
      .rejects.toMatchObject({ codigo: 'BLOQUEADO' });
  });

  it('bloquear el quiosco no deja a la persona sin acceso web', async () => {
    const q = await usuarioConPin('PIN2', '4321');
    for (let i = 0; i < env.MAX_INTENTOS_PIN; i++) {
      await autenticarQuiosco({ cif: q.a.cif, dni: q.dni, pin: '0000' }).catch(() => {});
    }
    const { token } = await login({ cif: q.a.cif, email: q.email, password: PASS_QUIOSCO });
    expect(token).toBeTruthy();
  });

  it('acertar antes del tope borra los fallos acumulados', async () => {
    const q = await usuarioConPin('PIN3', '4321');
    for (let i = 0; i < env.MAX_INTENTOS_PIN - 1; i++) {
      await autenticarQuiosco({ cif: q.a.cif, dni: q.dni, pin: '0000' }).catch(() => {});
    }
    await expect(autenticarQuiosco({ cif: q.a.cif, dni: q.dni, pin: '4321' })).resolves.toBeTruthy();
    // El contador quedó a cero: vuelve a haber margen completo.
    for (let i = 0; i < env.MAX_INTENTOS_PIN - 1; i++) {
      await autenticarQuiosco({ cif: q.a.cif, dni: q.dni, pin: '0000' }).catch(() => {});
    }
    await expect(autenticarQuiosco({ cif: q.a.cif, dni: q.dni, pin: '4321' })).resolves.toBeTruthy();
  });

  it('cambiar el PIN levanta el bloqueo', async () => {
    const q = await usuarioConPin('PIN4', '4321');
    for (let i = 0; i < env.MAX_INTENTOS_PIN; i++) {
      await autenticarQuiosco({ cif: q.a.cif, dni: q.dni, pin: '0000' }).catch(() => {});
    }
    await establecerPin(q.usuarioId, '8765');
    await expect(autenticarQuiosco({ cif: q.a.cif, dni: q.dni, pin: '8765' })).resolves.toBeTruthy();
  });
});
