import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { IcoEntrar, IcoSalir, IcoPausa, IcoReanudar } from '../icons';

// ---------------------------------------------------------------------------
// Modo quiosco: un dispositivo compartido en el vestíbulo. Sin sesión iniciada.
// Identificación por DNI / identificador / credencial + PIN, NUNCA por biometría.
// El CIF de la entidad se configura una vez en el propio dispositivo.
// ---------------------------------------------------------------------------

type Tipo = 'ENTRADA' | 'SALIDA' | 'INICIO_PAUSA' | 'FIN_PAUSA';
type Icono = (p: { className?: string }) => JSX.Element;

const ACCIONES: { t: Tipo; txt: string; pie: string; icono: Icono; principal?: boolean }[] = [
  { t: 'ENTRADA', txt: 'Entrada', pie: 'Inicio de la jornada', icono: IcoEntrar, principal: true },
  { t: 'SALIDA', txt: 'Salida', pie: 'Fin de la jornada', icono: IcoSalir, principal: true },
  { t: 'INICIO_PAUSA', txt: 'Inicio de pausa', pie: 'Interrumpe el cómputo', icono: IcoPausa },
  { t: 'FIN_PAUSA', txt: 'Fin de pausa', pie: 'Reanuda el cómputo', icono: IcoReanudar },
];

const CLAVE_CIF = 'rrhh_quiosco_cif';
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const SEGUNDOS_LIMPIEZA = 6;

/** Letra de control de un DNI (8 dígitos) o NIE (X/Y/Z + 7 dígitos). */
function calcularLetraControl(v: string): string | null {
  const s = v.trim().toUpperCase();
  if (/^\d{8}$/.test(s)) return LETRAS_DNI[Number(s) % 23] ?? null;
  const nie = /^([XYZ])(\d{7})$/.exec(s);
  if (nie) return LETRAS_DNI[Number(`${'XYZ'.indexOf(nie[1]!)}${nie[2]!}`) % 23] ?? null;
  return null;
}

export function Quiosco() {
  const [cif, setCif] = useState<string>(() => {
    try { return localStorage.getItem(CLAVE_CIF) ?? ''; } catch { return ''; }
  });
  const [cifTmp, setCifTmp] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [campoActivo, setCampoActivo] = useState<'identificador' | 'pin'>('identificador');
  const [enviando, setEnviando] = useState<Tipo | null>(null);
  const [res, setRes] = useState<{ ok: boolean; texto: string } | null>(null);
  const [cuenta, setCuenta] = useState(0);
  const [reloj, setReloj] = useState(new Date());
  const refIdentificador = useRef<HTMLInputElement>(null);
  const refPin = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Tras un fichaje correcto se limpia solo: es un dispositivo compartido y no
  // debe quedar el DNI ni el correo de nadie en pantalla.
  const limpiar = useCallback(() => {
    setIdentificador('');
    setPin('');
    setRes(null);
    setCuenta(0);
    setCampoActivo('identificador');
    refIdentificador.current?.focus();
  }, []);

  useEffect(() => {
    if (!res?.ok) return;
    setCuenta(SEGUNDOS_LIMPIEZA);
    const tic = setInterval(() => setCuenta((c) => Math.max(0, c - 1)), 1000);
    const fin = setTimeout(limpiar, SEGUNDOS_LIMPIEZA * 1000);
    return () => { clearInterval(tic); clearTimeout(fin); };
  }, [res, limpiar]);

  function guardarCif(e: React.FormEvent) {
    e.preventDefault();
    const v = cifTmp.trim().toUpperCase();
    try { localStorage.setItem(CLAVE_CIF, v); } catch { /* modo privado */ }
    setCif(v);
  }

  async function fichar(tipo: Tipo) {
    setRes(null);
    setEnviando(tipo);
    try {
      const ev = await api.post<{ id: string; tipo: Tipo; momento: string }>(
        '/horario/quiosco/fichar',
        { cif, identificador: identificador.trim().toUpperCase(), pin, tipo, origen: 'QUIOSCO' },
      );
      // La hora que se muestra es la que ha sellado el servidor, no la del
      // terminal: es la que consta en el registro y puede ir desfasada.
      const hora = new Date(ev.momento).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const txt = ACCIONES.find((a) => a.t === tipo)!.txt;
      setRes({ ok: true, texto: `${txt} registrada a las ${hora}` });
    } catch (err) {
      setRes({ ok: false, texto: mensajeError(err) });
    } finally {
      setEnviando(null);
      setPin('');
      setCampoActivo('pin');
    }
  }

  const letraSugerida = calcularLetraControl(identificador);
  const listo = identificador.trim().length >= 3 && /^\d{4,8}$/.test(pin);
  const bloqueado = !listo || enviando !== null;

  function escribir(car: string) {
    if (campoActivo === 'identificador') {
      setIdentificador((prev) => (prev + car).slice(0, 15).toUpperCase());
    } else if (/\d/.test(car)) {
      setPin((prev) => (prev + car).slice(0, 8));
    }
  }

  function borrarUltimo() {
    if (campoActivo === 'identificador') setIdentificador((prev) => prev.slice(0, -1));
    else setPin((prev) => prev.slice(0, -1));
  }

  function borrarCampo() {
    if (campoActivo === 'identificador') setIdentificador('');
    else setPin('');
  }

  function irAlPin() {
    setCampoActivo('pin');
    refPin.current?.focus();
  }

  function aplicarLetraSugerida(letra: string) {
    setIdentificador((prev) => prev + letra);
    irAlPin();
  }

  // ---------- Configuración inicial del dispositivo ----------
  if (!cif) {
    return (
      <main className="min-h-screen grid place-items-center bg-marca-800 p-6">
        <form onSubmit={guardarCif} className="bg-white rounded-xl2 shadow-flotante p-8 w-full max-w-md">
          <h1 className="text-2xl font-extrabold mb-1">Configurar el quiosco</h1>
          <p className="text-apagado mb-6">Indica el CIF de la entidad. Solo se pide una vez en este dispositivo.</p>
          <label htmlFor="cif" className="block text-sm font-semibold mb-1.5">CIF de la entidad</label>
          <input
            id="cif"
            value={cifTmp}
            onChange={(e) => setCifTmp(e.target.value)}
            required
            placeholder="Ej. P4600001A"
            className="w-full rounded-lg border border-linea px-4 py-3 text-lg num mb-5
                       focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none uppercase"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-marca-600 text-white font-bold py-3 hover:bg-marca-700"
          >
            Guardar
          </button>
        </form>
      </main>
    );
  }

  // ---------- Pantalla de fichaje ----------
  return (
    <main className="min-h-screen bg-marca-800 text-white flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/15 font-extrabold" aria-hidden="true">GP</span>
          <div className="leading-tight">
            <h1 className="font-bold text-lg">Registro de jornada</h1>
            <div className="text-xs text-white/70 uppercase tracking-wider num">{cif}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="num text-4xl font-bold leading-none tabular-nums">
            {reloj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            <span className="text-2xl text-white/70">
              :{String(reloj.getSeconds()).padStart(2, '0')}
            </span>
          </div>
          <div className="text-xs text-white/70 first-letter:uppercase mt-1">
            {reloj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-12 gap-6 px-6 pb-8 max-w-6xl w-full mx-auto content-start">
        {/* Identificación */}
        <section className="lg:col-span-7 bg-white text-tinta rounded-xl2 p-6 shadow-flotante">
          <h2 className="text-lg font-bold mb-4">1 · Identifícate</h2>

          {/* Selector táctil de campo activo */}
          <div className="flex rounded-lg bg-lienzo p-1 mb-4 border border-linea">
            <button
              type="button"
              aria-pressed={campoActivo === 'identificador'}
              onClick={() => { setCampoActivo('identificador'); refIdentificador.current?.focus(); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition ${
                campoActivo === 'identificador' ? 'bg-white shadow-sm text-marca-700' : 'text-apagado hover:text-tinta'
              }`}
            >
              DNI / Identificador
            </button>
            <button
              type="button"
              aria-pressed={campoActivo === 'pin'}
              onClick={irAlPin}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition ${
                campoActivo === 'pin' ? 'bg-white shadow-sm text-marca-700' : 'text-apagado hover:text-tinta'
              }`}
            >
              Código PIN
            </button>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor="qidentificador" className="block text-sm font-semibold">
                DNI / Identificador
              </label>
              {letraSugerida && (
                <button
                  type="button"
                  onClick={() => aplicarLetraSugerida(letraSugerida)}
                  className="text-xs font-bold text-marca-700 bg-marca-50 px-2.5 py-1 rounded border border-marca-200 hover:bg-marca-100"
                >
                  Añadir letra {letraSugerida} →
                </button>
              )}
            </div>
            <input
              id="qidentificador"
              ref={refIdentificador}
              type="text"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Ej. 00000001R o correo"
              value={identificador}
              onFocus={() => setCampoActivo('identificador')}
              onChange={(e) => setIdentificador(e.target.value.toUpperCase())}
              className={`w-full rounded-lg border px-4 py-3.5 text-xl num uppercase font-semibold outline-none transition ${
                campoActivo === 'identificador'
                  ? 'border-marca-500 ring-4 ring-marca-500/15'
                  : 'border-linea'
              }`}
            />
            <p className="text-xs text-tenue mt-1">
              Introduce tu DNI/NIE, identificador de empleado o correo corporativo.
            </p>
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor="qpin" className="block text-sm font-semibold">PIN</label>
              <span className="flex items-center gap-1.5" aria-hidden="true">
                {pin.length === 0
                  ? <span className="text-xs text-tenue">Sin introducir</span>
                  : Array.from({ length: pin.length }, (_, i) => (
                      <span key={i} className="w-2.5 h-2.5 rounded-full bg-marca-600" />
                    ))}
              </span>
            </div>
            <input
              id="qpin"
              ref={refPin}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              value={pin}
              onFocus={() => setCampoActivo('pin')}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              aria-describedby="qpin-ayuda"
              className={`w-full rounded-lg border px-4 py-3.5 text-xl num outline-none transition tracking-widest ${
                campoActivo === 'pin' ? 'border-marca-500 ring-4 ring-marca-500/15' : 'border-linea'
              }`}
            />
            <p id="qpin-ayuda" className="text-xs text-tenue mt-1">
              De 4 a 8 dígitos numéricos facilitados por Recursos Humanos.
            </p>
          </div>

          {/* Teclado táctil */}
          <div className="flex items-center justify-between gap-2 mb-2 text-xs text-apagado">
            <span aria-live="polite">
              Teclado para: <strong>{campoActivo === 'identificador' ? 'DNI / Identificador' : 'PIN'}</strong>
            </span>
            {campoActivo === 'identificador' && (
              <button type="button" onClick={irAlPin} className="text-marca-700 underline font-semibold">
                Ir al PIN →
              </button>
            )}
          </div>

          {/* Prefijos de NIE: sin esto un NIE no se puede teclear solo con dedos. */}
          {campoActivo === 'identificador' && (
            <div className="grid grid-cols-3 gap-2 mb-2" role="group" aria-label="Letra inicial de NIE">
              {['X', 'Y', 'Z'].map((l) => (
                <button
                  key={l}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escribir(l)}
                  className="num text-lg font-bold py-2.5 rounded-lg bg-white border border-linea text-marca-700
                             hover:bg-marca-50 active:bg-marca-100"
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* onMouseDown/preventDefault: el campo conserva el foco, para que un
              lector de DNI (que teclea como un teclado físico) siga funcionando. */}
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado numérico">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
              <button
                key={n}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escribir(n)}
                className="num text-2xl font-bold py-4 rounded-lg bg-lienzo border border-linea hover:bg-marca-50 active:bg-marca-100"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={borrarCampo}
              aria-label="Borrar el campo completo"
              className="text-sm font-semibold py-4 rounded-lg bg-lienzo border border-linea hover:bg-marca-50 active:bg-marca-100"
            >
              Borrar
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escribir('0')}
              className="num text-2xl font-bold py-4 rounded-lg bg-lienzo border border-linea hover:bg-marca-50 active:bg-marca-100"
            >
              0
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={borrarUltimo}
              aria-label="Borrar el último carácter"
              className="text-xl font-semibold py-4 rounded-lg bg-lienzo border border-linea hover:bg-marca-50 active:bg-marca-100"
            >
              ←
            </button>
          </div>
        </section>

        {/* Acción */}
        <section className="lg:col-span-5 bg-white text-tinta rounded-xl2 p-6 shadow-flotante flex flex-col">
          <h2 className="text-lg font-bold mb-4">2 · Registra tu jornada</h2>

          <div aria-live="polite" className="min-h-[88px] mb-4">
            {res && (
              <div
                role={res.ok ? 'status' : 'alert'}
                className={`rounded-xl px-4 py-3.5 border font-semibold ${
                  res.ok ? 'bg-green-50 text-exito border-exito/30' : 'bg-red-50 text-error border-error/30'
                }`}
              >
                {res.texto}
                {res.ok && (
                  <div className="flex items-center justify-between gap-3 mt-2">
                    <span className="text-xs font-normal text-apagado">
                      La pantalla se limpiará en {cuenta} s.
                    </span>
                    <button
                      type="button"
                      onClick={limpiar}
                      className="text-xs font-bold text-marca-700 underline"
                    >
                      Terminar ahora
                    </button>
                  </div>
                )}
              </div>
            )}
            {!res && !listo && (
              <p className="text-apagado text-sm">
                Introduce tu <strong>DNI o identificador</strong> y tu <strong>PIN</strong> para habilitar los botones.
              </p>
            )}
            {!res && listo && (
              <p className="text-exito font-semibold text-sm">
                Identificación completada. Pulsa la acción que quieres registrar:
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {ACCIONES.map((a) => {
              const Icono = a.icono;
              return (
                <button
                  key={a.t}
                  onClick={() => fichar(a.t)}
                  disabled={bloqueado}
                  className={`w-full min-h-[76px] rounded-xl px-4 py-3 flex items-center gap-4 text-left
                              font-bold transition disabled:bg-linea disabled:text-apagado
                              disabled:border-linea disabled:cursor-not-allowed ${
                    a.principal
                      ? 'bg-marca-600 text-white hover:bg-marca-700 active:scale-[0.99]'
                      : 'bg-white text-marca-700 border-2 border-linea hover:border-marca-300 hover:bg-marca-50 active:scale-[0.99]'
                  }`}
                >
                  <span
                    className={`grid place-items-center w-11 h-11 rounded-lg flex-none ${
                      a.principal && !bloqueado ? 'bg-white/20' : 'bg-marca-50'
                    }`}
                  >
                    <Icono />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg leading-tight">
                      {enviando === a.t ? 'Registrando…' : a.txt}
                    </span>
                    <span
                      // El color propio no lo alcanza `disabled:text-apagado` del
                      // botón, así que en bloqueado hay que bajarlo a mano.
                      className={`block text-xs font-medium mt-0.5 ${
                        a.principal && !bloqueado ? 'text-white/90' : 'text-apagado'
                      }`}
                    >
                      {a.pie}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-tenue mt-5">
            La hora que consta es la del servidor. El registro es inmutable: si hay un error, Recursos
            Humanos anota una corrección trazada sin borrar el original. Este terminal no utiliza datos biométricos.
          </p>
        </section>
      </div>

      <footer className="px-6 py-4 text-xs text-white/70 flex flex-wrap gap-4 justify-between">
        <span>Identificación por DNI / identificador y PIN · sin biometría</span>
        <button
          onClick={() => {
            try { localStorage.removeItem(CLAVE_CIF); } catch { /* noop */ }
            setCif('');
          }}
          className="underline hover:text-white"
        >
          Cambiar entidad
        </button>
      </footer>
    </main>
  );
}

function mensajeError(err: unknown): string {
  if (err instanceof ApiError) {
    // El endpoint limita a 30 intentos/minuto por origen: sin este aviso el
    // terminal parece averiado justo en las horas punta de entrada y salida.
    if (err.status === 429) return 'Demasiados intentos desde este terminal. Espera unos segundos y repite.';
    return err.message;
  }
  return 'No hay conexión con el servidor. Avisa a Recursos Humanos.';
}
