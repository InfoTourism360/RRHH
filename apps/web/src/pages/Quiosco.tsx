import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';

// ---------------------------------------------------------------------------
// Modo quiosco: un dispositivo compartido en el vestíbulo. Sin sesión iniciada.
// Identificación por credencial (correo) + PIN, NUNCA por biometría.
// El CIF de la entidad se configura una vez en el propio dispositivo.
// ---------------------------------------------------------------------------

type Tipo = 'ENTRADA' | 'SALIDA' | 'INICIO_PAUSA' | 'FIN_PAUSA';
const ACCIONES: { t: Tipo; txt: string; principal?: boolean }[] = [
  { t: 'ENTRADA', txt: 'Entrada', principal: true },
  { t: 'SALIDA', txt: 'Salida', principal: true },
  { t: 'INICIO_PAUSA', txt: 'Inicio de pausa' },
  { t: 'FIN_PAUSA', txt: 'Fin de pausa' },
];
const CLAVE_CIF = 'rrhh_quiosco_cif';

export function Quiosco() {
  const [cif, setCif] = useState<string>(() => {
    try { return localStorage.getItem(CLAVE_CIF) ?? ''; } catch { return ''; }
  });
  const [cifTmp, setCifTmp] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState<Tipo | null>(null);
  const [res, setRes] = useState<{ ok: boolean; texto: string } | null>(null);
  const [reloj, setReloj] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Tras un fichaje correcto se limpia solo: es un dispositivo compartido y no
  // debe quedar el correo de nadie en pantalla.
  const limpiar = useCallback(() => { setEmail(''); setPin(''); setRes(null); }, []);
  useEffect(() => {
    if (!res?.ok) return;
    const id = setTimeout(limpiar, 6000);
    return () => clearTimeout(id);
  }, [res, limpiar]);

  function guardarCif(e: React.FormEvent) {
    e.preventDefault();
    const v = cifTmp.trim().toUpperCase();
    try { localStorage.setItem(CLAVE_CIF, v); } catch { /* modo privado */ }
    setCif(v);
  }

  async function fichar(tipo: Tipo) {
    setRes(null); setEnviando(tipo);
    try {
      await api.post('/horario/quiosco/fichar', { cif, email: email.trim(), pin, tipo, origen: 'QUIOSCO' });
      const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const txt = ACCIONES.find((a) => a.t === tipo)!.txt;
      setRes({ ok: true, texto: `${txt} registrada a las ${hora}` });
      setPin('');
    } catch (err) {
      setRes({ ok: false, texto: err instanceof ApiError ? err.message : 'No se pudo registrar el fichaje.' });
      setPin('');
    } finally { setEnviando(null); }
  }

  const listo = /.+@.+\..+/.test(email) && /^\d{4,8}$/.test(pin);

  // ---------- Configuración inicial del dispositivo ----------
  if (!cif) {
    return (
      <main className="min-h-screen grid place-items-center bg-marca-800 p-6">
        <form onSubmit={guardarCif} className="bg-white rounded-xl2 shadow-flotante p-8 w-full max-w-md">
          <h1 className="text-2xl font-extrabold mb-1">Configurar el quiosco</h1>
          <p className="text-apagado mb-6">Indica el CIF de la entidad. Solo se pide una vez en este dispositivo.</p>
          <label htmlFor="cif" className="block text-sm font-semibold mb-1.5">CIF de la entidad</label>
          <input id="cif" value={cifTmp} onChange={(e) => setCifTmp(e.target.value)} required
                 className="w-full rounded-lg border border-linea px-4 py-3 text-lg num mb-5
                            focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none" />
          <button type="submit"
                  className="w-full rounded-lg bg-marca-600 text-white font-bold py-3 hover:bg-marca-700">
            Guardar
          </button>
        </form>
      </main>
    );
  }

  // ---------- Pantalla de fichaje ----------
  return (
    <main className="min-h-screen bg-marca-800 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/15 font-extrabold">GP</span>
          <div className="leading-tight">
            <div className="font-bold text-lg">Registro de jornada</div>
            <div className="text-xs text-white/60 uppercase tracking-wider num">{cif}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="num text-3xl font-bold">{reloj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="text-xs text-white/60 capitalize">
            {reloj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-2 gap-6 px-6 pb-8 max-w-5xl w-full mx-auto content-start">
        {/* Identificación */}
        <section className="bg-white text-tinta rounded-xl2 p-6 shadow-flotante">
          <h2 className="text-lg font-bold mb-4">1 · Identifícate</h2>

          <label htmlFor="qmail" className="block text-sm font-semibold mb-1.5">Correo electrónico</label>
          <input id="qmail" type="email" inputMode="email" autoComplete="off" value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 className="w-full rounded-lg border border-linea px-4 py-3 text-lg mb-4
                            focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none" />

          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="qpin" className="block text-sm font-semibold">PIN</label>
            <span className="num text-sm text-apagado" aria-hidden="true">{'•'.repeat(pin.length)}</span>
          </div>
          <input id="qpin" type="password" inputMode="numeric" autoComplete="off" value={pin}
                 onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                 aria-describedby="qpin-ayuda"
                 className="w-full rounded-lg border border-linea px-4 py-3 text-lg num mb-2
                            focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none" />
          <p id="qpin-ayuda" className="text-xs text-tenue mb-3">De 4 a 8 dígitos, facilitado por Recursos Humanos.</p>

          {/* Teclado numérico para pantalla táctil */}
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado numérico">
            {['1','2','3','4','5','6','7','8','9'].map((n) => (
              <button key={n} type="button" onClick={() => setPin((p) => (p + n).slice(0, 8))}
                      className="num text-xl font-bold py-3.5 rounded-lg bg-lienzo border border-linea hover:bg-marca-50">
                {n}
              </button>
            ))}
            <button type="button" onClick={() => setPin('')}
                    className="text-sm font-semibold py-3.5 rounded-lg bg-lienzo border border-linea hover:bg-marca-50">
              Borrar
            </button>
            <button type="button" onClick={() => setPin((p) => (p + '0').slice(0, 8))}
                    className="num text-xl font-bold py-3.5 rounded-lg bg-lienzo border border-linea hover:bg-marca-50">
              0
            </button>
            <button type="button" onClick={() => setPin((p) => p.slice(0, -1))}
                    className="text-sm font-semibold py-3.5 rounded-lg bg-lienzo border border-linea hover:bg-marca-50">
              ←
            </button>
          </div>
        </section>

        {/* Acción */}
        <section className="bg-white text-tinta rounded-xl2 p-6 shadow-flotante">
          <h2 className="text-lg font-bold mb-4">2 · Registra tu jornada</h2>

          <div aria-live="polite" className="min-h-[76px] mb-4">
            {res && (
              <div role={res.ok ? 'status' : 'alert'}
                   className={`rounded-xl px-4 py-3.5 border font-semibold ${
                     res.ok ? 'bg-green-50 text-exito border-exito/30' : 'bg-red-50 text-error border-error/30'}`}>
                {res.texto}
                {res.ok && <div className="text-xs font-normal mt-1">La pantalla se limpiará sola.</div>}
              </div>
            )}
            {!res && !listo && (
              <p className="text-apagado text-sm">Introduce tu correo y tu PIN para habilitar los botones.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {ACCIONES.map((a) => (
              <button key={a.t} onClick={() => fichar(a.t)} disabled={!listo || enviando !== null}
                      className={`rounded-xl font-bold transition disabled:opacity-40 disabled:cursor-not-allowed
                        ${a.principal
                          ? 'py-7 text-xl bg-marca-600 text-white hover:bg-marca-700'
                          : 'py-5 text-base bg-white text-marca-700 border-2 border-linea hover:border-marca-300 hover:bg-marca-50'}`}>
                {enviando === a.t ? 'Registrando…' : a.txt}
              </button>
            ))}
          </div>

          <p className="text-xs text-tenue mt-5">
            La hora que vale es la del servidor. El registro es inmutable: si hay un error, Recursos
            Humanos anota una corrección, sin borrar el original. Este terminal no usa datos biométricos.
          </p>
        </section>
      </div>

      <footer className="px-6 py-4 text-xs text-white/50 flex flex-wrap gap-4 justify-between">
        <span>Identificación por credencial y PIN · sin biometría</span>
        <button onClick={() => { try { localStorage.removeItem(CLAVE_CIF); } catch { /* noop */ } setCif(''); }}
                className="underline hover:text-white/80">Cambiar entidad</button>
      </footer>
    </main>
  );
}
