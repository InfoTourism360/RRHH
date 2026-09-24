import { describe, it, expect } from 'vitest';
import { authenticator } from 'otplib';
import {
  login, iniciarAltaMfa, confirmarAltaMfa, desactivarMfa, tieneMfaActivo,
} from '../src/auth/service.js';
import { ownerPool } from '../src/db/pool.js';
import { crearEntidadDemo } from './helpers.js';

// ---------------------------------------------------------------------------
// Alta del segundo factor. El login sabía comprobarlo desde el principio, pero
// no existía forma de activarlo: la semilla no se generaba nunca. El anexo ENS
// lo daba por disponible, así que era una casilla marcada sin nada detrás.
// ---------------------------------------------------------------------------

/** Código válido para esa semilla, como lo daría la app del móvil. */
const codigoDe = (secreto: string) => authenticator.generate(secreto);

describe('Segundo factor (TOTP)', () => {
  it('no queda activo hasta confirmar un código', async () => {
    const a = await crearEntidadDemo('MFA1');
    const { secreto } = await iniciarAltaMfa(a.adminUsuarioId);
    expect(secreto).toBeTruthy();

    // Generada la semilla pero sin confirmar: se entra sin código. Si se
    // activara aquí, quien no llegue a escanear el QR se queda fuera.
    expect(await tieneMfaActivo(a.adminUsuarioId)).toBe(false);
    const { token } = await login({ cif: a.cif, email: a.adminEmail, password: a.adminPassword });
    expect(token).toBeTruthy();

    await confirmarAltaMfa(a.adminUsuarioId, codigoDe(secreto));
    expect(await tieneMfaActivo(a.adminUsuarioId)).toBe(true);
  });

  it('una vez activo, el login sin código se rechaza y con código entra', async () => {
    const a = await crearEntidadDemo('MFA2');
    const { secreto } = await iniciarAltaMfa(a.adminUsuarioId);
    await confirmarAltaMfa(a.adminUsuarioId, codigoDe(secreto));

    await expect(login({ cif: a.cif, email: a.adminEmail, password: a.adminPassword }))
      .rejects.toMatchObject({ codigo: 'MFA_REQUERIDO' });

    const { token } = await login({
      cif: a.cif, email: a.adminEmail, password: a.adminPassword, totp: codigoDe(secreto),
    });
    expect(token).toBeTruthy();
  });

  it('un código equivocado no confirma el alta', async () => {
    const a = await crearEntidadDemo('MFA3');
    await iniciarAltaMfa(a.adminUsuarioId);
    await expect(confirmarAltaMfa(a.adminUsuarioId, '000000'))
      .rejects.toMatchObject({ codigo: 'MFA_INVALIDO' });
    expect(await tieneMfaActivo(a.adminUsuarioId)).toBe(false);
  });

  it('no se puede confirmar sin haber iniciado el alta', async () => {
    const a = await crearEntidadDemo('MFA4');
    await expect(confirmarAltaMfa(a.adminUsuarioId, '123456'))
      .rejects.toMatchObject({ codigo: 'MFA_SIN_INICIAR' });
  });

  it('no se puede volver a dar de alta sobre uno ya activo', async () => {
    const a = await crearEntidadDemo('MFA5');
    const { secreto } = await iniciarAltaMfa(a.adminUsuarioId);
    await confirmarAltaMfa(a.adminUsuarioId, codigoDe(secreto));
    // Si se pudiera, bastaría una sesión robada para sustituir la semilla por
    // otra y quedarse con el segundo factor de la víctima.
    await expect(iniciarAltaMfa(a.adminUsuarioId))
      .rejects.toMatchObject({ codigo: 'MFA_YA_ACTIVO' });
  });

  it('desactivar exige la contraseña, no basta con la sesión', async () => {
    const a = await crearEntidadDemo('MFA6');
    const { secreto } = await iniciarAltaMfa(a.adminUsuarioId);
    await confirmarAltaMfa(a.adminUsuarioId, codigoDe(secreto));

    await expect(desactivarMfa(a.adminUsuarioId, 'la-que-no-es'))
      .rejects.toMatchObject({ codigo: 'CREDENCIALES' });
    expect(await tieneMfaActivo(a.adminUsuarioId)).toBe(true);

    await desactivarMfa(a.adminUsuarioId, a.adminPassword);
    expect(await tieneMfaActivo(a.adminUsuarioId)).toBe(false);
  });

  it('al desactivar se borra la semilla, no solo la marca', async () => {
    const a = await crearEntidadDemo('MFA7');
    const { secreto } = await iniciarAltaMfa(a.adminUsuarioId);
    await confirmarAltaMfa(a.adminUsuarioId, codigoDe(secreto));
    await desactivarMfa(a.adminUsuarioId, a.adminPassword);

    const r = await ownerPool.query<{ mfa_totp_secret: Buffer | null }>(
      'SELECT mfa_totp_secret FROM usuario WHERE id = $1', [a.adminUsuarioId]);
    expect(r.rows[0]!.mfa_totp_secret).toBeNull();
  });

  it('la semilla nunca se guarda en claro', async () => {
    const a = await crearEntidadDemo('MFA8');
    const { secreto } = await iniciarAltaMfa(a.adminUsuarioId);
    const r = await ownerPool.query<{ mfa_totp_secret: Buffer }>(
      'SELECT mfa_totp_secret FROM usuario WHERE id = $1', [a.adminUsuarioId]);
    const guardado = r.rows[0]!.mfa_totp_secret;
    expect(guardado).not.toBeNull();
    expect(guardado.toString('utf8')).not.toContain(secreto);
    expect(guardado.toString('base64')).not.toContain(secreto);
  });
});
