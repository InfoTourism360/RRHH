import { describe, it, expect } from 'vitest';
import * as est from '../src/domain/estructura.js';
import * as usr from '../src/domain/usuarios.js';
import { login } from '../src/auth/service.js';
import { crearEntidadDemo } from './helpers.js';

const PASS = 'ContraseñaLarga2026';

describe('Gestión de accesos', () => {
  it('crea un usuario con roles y permite iniciar sesión', async () => {
    const a = await crearEntidadDemo('USR1');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const p = await est.crearPersona(ctx, {
      tipoDocumento: 'DNI', numDocumento: '30000001A', nombre: 'Nuevo', apellido1: 'Empleado',
    });

    const creado = await usr.crearUsuario(ctx, {
      email: 'nuevo@demo.es', password: PASS, personaId: p.id as string, roles: [{ rol: 'EMPLEADO', unidadId: null }],
    });
    expect(creado.id).toBeTruthy();

    // El acceso funciona de verdad y llega con su persona vinculada.
    const { sesion } = await login({ cif: a.cif, email: 'nuevo@demo.es', password: PASS });
    expect(sesion.personaId).toBe(p.id);
    expect(sesion.roles.map((r) => r.rol)).toEqual(['EMPLEADO']);
  });

  it('no permite dos usuarios con el mismo correo en la entidad', async () => {
    const a = await crearEntidadDemo('USR2');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    await usr.crearUsuario(ctx, { email: 'dup@demo.es', password: PASS, roles: [{ rol: 'EMPLEADO', unidadId: null }] });
    await expect(usr.crearUsuario(ctx, { email: 'dup@demo.es', password: PASS, roles: [{ rol: 'EMPLEADO', unidadId: null }] }))
      .rejects.toMatchObject({ codigo: 'EMAIL_DUPLICADO' });
  });

  it('no permite dar dos accesos a la misma persona', async () => {
    const a = await crearEntidadDemo('USR3');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const p = await est.crearPersona(ctx, {
      tipoDocumento: 'DNI', numDocumento: '30000003C', nombre: 'Una', apellido1: 'Sola',
    });
    await usr.crearUsuario(ctx, { email: 'p1@demo.es', password: PASS, personaId: p.id as string, roles: [{ rol: 'EMPLEADO', unidadId: null }] });
    await expect(usr.crearUsuario(ctx, { email: 'p2@demo.es', password: PASS, personaId: p.id as string, roles: [{ rol: 'EMPLEADO', unidadId: null }] }))
      .rejects.toMatchObject({ codigo: 'PERSONA_CON_ACCESO' });
  });

  it('desactivar impide el acceso, y no puedes desactivarte a ti mismo', async () => {
    const a = await crearEntidadDemo('USR4');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const u = await usr.crearUsuario(ctx, { email: 'baja@demo.es', password: PASS, roles: [{ rol: 'EMPLEADO', unidadId: null }] });

    await usr.cambiarEstado(ctx, u.id as string, false, 'Cese de la relación de servicio');
    await expect(login({ cif: a.cif, email: 'baja@demo.es', password: PASS }))
      .rejects.toMatchObject({ codigo: 'CREDENCIALES' });

    await expect(usr.cambiarEstado(ctx, a.adminUsuarioId, false, 'prueba'))
      .rejects.toMatchObject({ codigo: 'AUTO_BLOQUEO' });
  });

  it('los usuarios de otra entidad no son visibles ni manipulables', async () => {
    const a = await crearEntidadDemo('USR5');
    const b = await crearEntidadDemo('USR6');
    const ctxA = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const ctxB = { entidadId: b.entidadId, usuarioId: b.adminUsuarioId };

    const deB = await usr.crearUsuario(ctxB, { email: 'solo-b@demo.es', password: PASS, roles: [{ rol: 'EMPLEADO', unidadId: null }] });

    const listaA = await usr.listarUsuarios(ctxA);
    expect(listaA.some((u) => u.email === 'solo-b@demo.es')).toBe(false);

    // A no puede tocar un usuario de B aunque conozca su identificador.
    await expect(usr.cambiarEstado(ctxA, deB.id as string, false, 'intento'))
      .rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('restablecer la contraseña desbloquea y no guarda la contraseña en el log', async () => {
    const a = await crearEntidadDemo('USR7');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const u = await usr.crearUsuario(ctx, { email: 'reset@demo.es', password: PASS, roles: [{ rol: 'EMPLEADO', unidadId: null }] });

    const NUEVA = 'OtraContraseña2026';
    await usr.restablecerPassword(ctx, u.id as string, NUEVA);
    const { token } = await login({ cif: a.cif, email: 'reset@demo.es', password: NUEVA });
    expect(token).toBeTruthy();

    const hist = await est.historialAuditoria(ctx, 'usuario', u.id as string);
    const traza = JSON.stringify(hist);
    expect(traza).toContain('RESTABLECER_PASSWORD');
    expect(traza).not.toContain(NUEVA);
  });
});
