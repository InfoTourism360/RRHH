import { authenticator } from 'otplib';

// MFA opcional por TOTP (RFC 6238). Ventana de 1 paso para tolerar desfase.
authenticator.options = { window: 1 };

export function generarSecretoTotp(): string {
  return authenticator.generateSecret();
}

export function uriTotp(secreto: string, emailUsuario: string, emisor = 'RRHH'): string {
  return authenticator.keyuri(emailUsuario, emisor, secreto);
}

export function verificarTotp(secreto: string, codigo: string): boolean {
  return authenticator.verify({ token: codigo, secret: secreto });
}
