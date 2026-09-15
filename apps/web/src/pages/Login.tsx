import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { ApiError } from '../api';
import { Alerta, Campo } from '../ui';
import { useAjustes } from '../config';

// El CIF de la entidad se repite en cada acceso y no es un secreto, así que se
// recuerda en el navegador. Antes venía fijo en el código con el CIF de la
// entidad de demostración: cualquier cliente habría visto el de otro.
const CIF_RECORDADO = 'rrhh.cif';

export function Login() {
  const { entrar, caducada } = useAuth();
  const { modoDemo } = useAjustes();
  const [cif, setCif] = useState(() => {
    try { return localStorage.getItem(CIF_RECORDADO) ?? ''; } catch { return ''; }
  });
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
      try { localStorage.setItem(CIF_RECORDADO, cif); } catch { /* sin almacenamiento */ }
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
            <div className="text-xs text-white/85 uppercase tracking-wider">Sector público</div>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight mb-4">La gestión de personal de tu entidad, en una sola plataforma.</h2>
          <ul className="space-y-2.5 text-white/85">
            <li className="flex gap-2.5"><span aria-hidden="true">✓</span> Registro horario que no se edita ni se borra: cada corrección deja rastro.</li>
            <li className="flex gap-2.5"><span aria-hidden="true">✓</span> Plantilla, RPT y ausencias con trazabilidad completa.</li>
            <li className="flex gap-2.5"><span aria-hidden="true">✓</span> Datos de cada entidad aislados y sin tratamiento biométrico.</li>
          </ul>
        </div>
        <p className="text-white/85 text-xs">
          {modoDemo ? 'Entorno de demostración · datos ficticios' : 'Gestión de personal · Sector público'}
        </p>
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
              {caducada && !error && (
                <div className="mb-4">
                  <Alerta tipo="info">
                    Tu sesión ha caducado por inactividad. Vuelve a identificarte para continuar.
                  </Alerta>
                </div>
              )}
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
                className="w-full inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold bg-marca-600 text-white hover:bg-marca-700 disabled:bg-linea disabled:text-apagado transition">
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
