import { describe, it, expect } from 'vitest';
import { login, resolverSesion, logout, ErrorAuth } from '../src/auth/service.js';
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
