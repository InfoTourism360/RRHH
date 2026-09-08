import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { ApiError } from '../api';
import { Alerta, Boton, Campo } from '../ui';

export function Login() {
  const { entrar } = useAuth();
  const [cif, setCif] = useState('P4600001A');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [pideTotp, setPideTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await entrar(cif, email, password, pideTotp ? totp : undefined);
    } catch (err) {
      if (err instanceof ApiError && err.codigo === 'MFA_REQUERIDO') {
        setPideTotp(true);
        setError('Introduce tu código de verificación (MFA).');
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-1">Portal del empleado</h1>
        <p className="text-gray-600 mb-6">Accede con tus credenciales.</p>

        <form onSubmit={onSubmit} noValidate>
          {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
          <Campo etiqueta="CIF de la entidad" value={cif} onChange={(e) => setCif(e.target.value)}
                 autoComplete="organization" required />
          <Campo etiqueta="Correo electrónico" type="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          <Campo etiqueta="Contraseña" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          {pideTotp && (
            <Campo etiqueta="Código MFA" ayuda="6 dígitos de tu aplicación de autenticación"
                   inputMode="numeric" value={totp} onChange={(e) => setTotp(e.target.value)} />
          )}
          <Boton type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</Boton>
        </form>

        <p className="mt-6 text-sm">
          <a href="/accesibilidad" className="underline text-marca-oscuro">Declaración de accesibilidad</a>
        </p>
      </div>
    </main>
  );
}
