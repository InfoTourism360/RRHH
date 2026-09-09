import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { ApiError } from '../api';
import { Alerta, Campo } from '../ui';

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
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Panel de marca */}
      <div className="hidden lg:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-marca-600 via-marca-700 to-marca-800">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/15 font-extrabold text-lg">GP</span>
          <div>
            <div className="font-bold text-lg leading-tight">Gestión de Personal</div>
            <div className="text-xs text-white/60 uppercase tracking-wider">Sector público</div>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight mb-4">La gestión de personal de tu entidad, en una sola plataforma.</h2>
          <ul className="space-y-2.5 text-white/85">
            <li className="flex gap-2.5"><span aria-hidden="true">✓</span> Registro horario digital inmutable y conforme a norma.</li>
            <li className="flex gap-2.5"><span aria-hidden="true">✓</span> Plantilla, RPT y ausencias con trazabilidad completa.</li>
            <li className="flex gap-2.5"><span aria-hidden="true">✓</span> Preparado para el ENS (categoría media) y el RGPD.</li>
          </ul>
        </div>
        <p className="text-white/50 text-xs">Entorno de demostración · datos ficticios</p>
      </div>

      {/* Formulario */}
      <div className="min-h-screen lg:min-h-0 grid place-items-center px-4 py-10 bg-lienzo">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-marca-600 text-white font-extrabold">GP</span>
            <div className="font-bold text-lg">Gestión de Personal</div>
          </div>
          <div className="bg-white rounded-xl2 shadow-tarjeta border border-linea p-7 sm:p-8">
            <h1 className="text-2xl font-extrabold mb-1">Iniciar sesión</h1>
            <p className="text-apagado mb-6">Accede con las credenciales de tu entidad.</p>

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
              <button type="submit" disabled={enviando}
                className="w-full inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold bg-marca-600 text-white hover:bg-marca-700 disabled:opacity-60 transition">
                {enviando ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          </div>
          <p className="mt-5 text-sm text-center text-apagado">
            <a href="/accesibilidad" className="underline hover:text-marca-700">Declaración de accesibilidad</a>
          </p>
        </div>
      </div>
    </main>
  );
}
