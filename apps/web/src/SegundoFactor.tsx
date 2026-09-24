import { useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import { Alerta, Boton, Campo, Etiqueta, Tarjeta } from './ui';

/**
 * Alta y baja del segundo factor.
 *
 * El alta va en dos pasos y el factor no queda activo hasta que se confirma un
 * código: así nadie se queda fuera de su cuenta por no haber llegado a
 * registrar la semilla en su aplicación.
 */

interface Alta { secreto: string; uri: string }

/** En grupos de cuatro: se teclea a mano en el móvil y hay que poder leerlo. */
const enGrupos = (s: string) => s.replace(/(.{4})/g, '$1 ').trim();

export function SegundoFactor({ activo, onCambio }: { activo: boolean; onCambio: () => void }) {
  const [alta, setAlta] = useState<Alta | null>(null);
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [bajaAbierta, setBajaAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const fallo = (e: unknown, alt: string) =>
    setError(e instanceof ApiError ? e.message : alt);

  async function empezar() {
    setError(null); setAviso(null);
    try { setAlta(await api.post<Alta>('/auth/mfa/iniciar')); }
    catch (e) { fallo(e, 'No se pudo iniciar el alta del segundo factor.'); }
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setError(null); setEnviando(true);
    try {
      await api.post('/auth/mfa/confirmar', { codigo });
      setAlta(null); setCodigo('');
      setAviso('Segundo factor activado. A partir de ahora se te pedirá el código al entrar.');
      onCambio();
    } catch (e) { fallo(e, 'No se pudo confirmar el código.'); }
    finally { setEnviando(false); }
  }

  async function desactivar(e: FormEvent) {
    e.preventDefault();
    setError(null); setEnviando(true);
    try {
      await api.post('/auth/mfa/desactivar', { password });
      setPassword(''); setBajaAbierta(false);
      setAviso('Segundo factor desactivado.');
      onCambio();
    } catch (e) { fallo(e, 'No se pudo desactivar el segundo factor.'); }
    finally { setEnviando(false); }
  }

  return (
    <Tarjeta titulo="Verificación en dos pasos">
      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
      {aviso && <div className="mb-4"><Alerta tipo="exito">{aviso}</Alerta></div>}

      <p className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-apagado">Estado:</span>
        {activo
          ? <Etiqueta tono="exito">Activada</Etiqueta>
          : <Etiqueta tono="aviso">Sin activar</Etiqueta>}
      </p>

      {!activo && !alta && (
        <>
          <p className="text-sm text-apagado mb-4">
            Añade un código de un solo uso a tu contraseña. Necesitas una aplicación de
            autenticación en el móvil; sirve cualquiera compatible con el estándar TOTP.
          </p>
          <Boton onClick={empezar}>Activar</Boton>
        </>
      )}

      {alta && (
        <form onSubmit={confirmar} noValidate>
          <p className="text-sm mb-3">
            Añade esta clave en tu aplicación de autenticación y escribe después el código
            de seis dígitos que te muestre.
          </p>
          <p className="num text-lg font-semibold tracking-wide bg-lienzo border border-linea rounded-lg px-4 py-3 mb-1 break-all">
            {enGrupos(alta.secreto)}
          </p>
          <p className="text-xs text-tenue mb-4">
            Tu aplicación puede pedirte también el nombre de la cuenta: es tu correo.
          </p>
          <Campo etiqueta="Código de verificación" ayuda="Los seis dígitos que muestra la aplicación"
                 inputMode="numeric" value={codigo}
                 onChange={(e) => setCodigo(e.target.value.trim())} required />
          <div className="flex gap-2">
            <Boton type="submit" disabled={enviando || codigo.length !== 6}>
              {enviando ? 'Comprobando…' : 'Confirmar'}
            </Boton>
            <Boton variante="secundario" type="button"
                   onClick={() => { setAlta(null); setCodigo(''); }}>Cancelar</Boton>
          </div>
        </form>
      )}

      {activo && !bajaAbierta && (
        <>
          <p className="text-sm text-apagado mb-4">
            Si cambias de móvil, desactívala antes y vuelve a activarla en el nuevo.
          </p>
          <Boton variante="secundario" onClick={() => setBajaAbierta(true)}>Desactivar</Boton>
        </>
      )}

      {activo && bajaAbierta && (
        <form onSubmit={desactivar} noValidate>
          <p className="text-sm mb-3">
            Confirma con tu contraseña: quitar una medida de seguridad no debería depender
            solo de tener la sesión abierta.
          </p>
          <Campo etiqueta="Contraseña" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 autoComplete="current-password" required />
          <div className="flex gap-2">
            <Boton type="submit" disabled={enviando || !password}>
              {enviando ? 'Desactivando…' : 'Desactivar'}
            </Boton>
            <Boton variante="secundario" type="button"
                   onClick={() => { setBajaAbierta(false); setPassword(''); }}>Cancelar</Boton>
          </div>
        </form>
      )}
    </Tarjeta>
  );
}
