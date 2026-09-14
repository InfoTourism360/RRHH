import { useEffect, useId, useRef, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';

export function minAHoras(min: number | undefined | null): string {
  if (min == null) return '—';
  const s = min < 0 ? '-' : '';
  const a = Math.abs(min);
  return `${s}${Math.floor(a / 60)}h ${String(a % 60).padStart(2, '0')}m`;
}

export function fechaLarga(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

export function Alerta({ tipo, children }: { tipo: 'error' | 'exito' | 'aviso' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'bg-red-50 text-error border-error/30',
    exito: 'bg-green-50 text-exito border-exito/30',
    aviso: 'bg-amber-50 text-aviso border-aviso/30',
    info: 'bg-marca-50 text-marca-700 border-marca-200',
  }[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} aria-live={tipo === 'error' ? 'assertive' : 'polite'}
         className={`border rounded-xl px-4 py-3 text-sm font-medium ${estilos}`}>
      {children}
    </div>
  );
}

const campoCls =
  'w-full rounded-lg border border-linea bg-white px-3.5 py-2.5 text-tinta placeholder:text-tenue ' +
  'focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none transition';

export function Campo(
  { etiqueta, ayuda, error, ...props }:
  { etiqueta: string; ayuda?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>,
) {
  const id = useId();
  const ayudaId = `${id}-a`, errId = `${id}-e`;
  const descrito = [ayuda ? ayudaId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-semibold mb-1.5">{etiqueta}</label>
      {ayuda && <p id={ayudaId} className="text-sm text-apagado mb-1.5">{ayuda}</p>}
      <input id={id} aria-describedby={descrito} aria-invalid={!!error} className={campoCls} {...props} />
      {error && <p id={errId} className="text-sm text-error mt-1.5">{error}</p>}
    </div>
  );
}

export function Selector(
  { etiqueta, children, ...props }:
  { etiqueta: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>,
) {
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-semibold mb-1.5">{etiqueta}</label>
      <select id={id} className={campoCls} {...props}>{children}</select>
    </div>
  );
}

export function Boton(
  { children, variante = 'primario', ...props }:
  { children: ReactNode; variante?: 'primario' | 'secundario' | 'peligro' } &
  React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const estilos = {
    primario: 'bg-marca-600 text-white hover:bg-marca-700 shadow-sm',
    secundario: 'bg-white text-marca-700 border border-linea hover:border-marca-300 hover:bg-marca-50',
    peligro: 'bg-error text-white hover:brightness-95',
  }[variante];
  // El estado inactivo va en gris plano y no con opacidad: al desvanecer el
  // botón entero, texto y fondo se aclaran juntos y el texto deja de leerse.
  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:bg-linea disabled:text-apagado disabled:border-linea disabled:shadow-none ${estilos}`} {...props}>
      {children}
    </button>
  );
}

export function Tarjeta({ titulo, children, accion }: { titulo?: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <section className="bg-white rounded-xl2 shadow-tarjeta border border-linea p-5 sm:p-6 h-full">
      {titulo && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold">{titulo}</h2>
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-apagado">
      <span className="w-4 h-4 rounded-full border-2 border-marca-300 border-t-marca-600 animate-spin" aria-hidden="true" />
      {texto}
    </div>
  );
}

/** Campo de búsqueda para filtrar tablas largas. */
export function Buscador({ valor, onCambio, etiqueta = 'Buscar', placeholder = 'Buscar…' }:
{ valor: string; onCambio: (v: string) => void; etiqueta?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="sr-only">{etiqueta}</label>
      <input id={id} type="search" value={valor} placeholder={placeholder}
             onChange={(e) => onCambio(e.target.value)}
             className="w-full sm:max-w-xs rounded-lg border border-linea bg-white px-3.5 py-2.5 text-sm
                        focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none" />
    </div>
  );
}

/** Filtra filas por coincidencia de texto en los campos indicados. */
export function filtrar<T extends object>(filas: T[], campos: string[], q: string): T[] {
  const t = q.trim().toLowerCase();
  if (!t) return filas;
  return filas.filter((f) =>
    campos.some((c) => String((f as Record<string, unknown>)[c] ?? '').toLowerCase().includes(t)),
  );
}

const ENFOCABLES =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ titulo, children, onCerrar }: { titulo: string; children: ReactNode; onCerrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    // Quién tenía el foco antes de abrir: hay que devolvérselo al cerrar.
    const previo = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    // Enfoca el primer control del diálogo; si no hay, el propio panel.
    const primero = panel?.querySelector<HTMLElement>(ENFOCABLES);
    (primero ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCerrar(); return; }
      if (e.key !== 'Tab' || !panel) return;
      // Retiene el foco dentro del diálogo: sin esto el tabulador se escapa al
      // contenido de detrás, que es justo lo que un diálogo modal no debe hacer.
      const focos = [...panel.querySelectorAll<HTMLElement>(ENFOCABLES)]
        .filter((el) => el.offsetParent !== null);
      if (focos.length === 0) { e.preventDefault(); panel.focus(); return; }
      const inicio = focos[0]!, fin = focos[focos.length - 1]!;
      const activo = document.activeElement;
      if (e.shiftKey && (activo === inicio || activo === panel)) { e.preventDefault(); fin.focus(); }
      else if (!e.shiftKey && activo === fin) { e.preventDefault(); inicio.focus(); }
      else if (!panel.contains(activo)) { e.preventDefault(); inicio.focus(); }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previo?.focus?.();
    };
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-tinta/50" onClick={onCerrar} aria-hidden="true" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id}
           className="relative bg-white rounded-xl2 shadow-flotante border border-linea w-full max-w-lg my-8 outline-none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-linea">
          <h2 id={id} className="text-lg font-bold">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="text-apagado hover:text-tinta text-xl leading-none px-2">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export interface Columna<T> { k: string; txt: string; render?: (fila: T) => ReactNode; alinear?: 'der' }
export function Tabla<T extends object>(
  { columnas, filas, vacio = 'Sin datos.' }: { columnas: Columna<T>[]; filas: T[]; vacio?: string },
) {
  if (filas.length === 0) return <p className="text-apagado">{vacio}</p>;
  const val = (f: T, k: string) => (f as Record<string, unknown>)[k];
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-linea">
            {columnas.map((c) => (
              <th key={c.k} scope="col"
                  className={`py-2.5 px-2 font-semibold text-apagado uppercase text-xs tracking-wide ${c.alinear === 'der' ? 'text-right' : ''}`}>
                {c.txt}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={(val(f, 'id') as string) ?? i} className="border-b border-linea/70 hover:bg-lienzo">
              {columnas.map((c) => (
                <td key={c.k} className={`py-2.5 px-2 ${c.alinear === 'der' ? 'text-right num' : ''}`}>
                  {c.render ? c.render(f) : String(val(f, c.k) ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Etiqueta({ tono = 'neutro', children }: { tono?: 'neutro' | 'exito' | 'aviso' | 'error' | 'marca'; children: ReactNode }) {
  const c = {
    neutro: 'bg-lienzo text-apagado border-linea',
    exito: 'bg-green-50 text-exito border-exito/30',
    aviso: 'bg-amber-50 text-aviso border-aviso/30',
    error: 'bg-red-50 text-error border-error/30',
    marca: 'bg-marca-50 text-marca-700 border-marca-200',
  }[tono];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Componentes compartidos. Antes estaban reimplementados en varias páginas, lo
// que ya había producido diferencias visuales entre pantallas equivalentes.
// ---------------------------------------------------------------------------

/** Cabecera estándar de página. Sustituye 15 cabeceras duplicadas. */
export function CabeceraPagina(
  { titulo, descripcion, accion }: { titulo: string; descripcion?: ReactNode; accion?: ReactNode },
) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[26px] font-extrabold leading-tight">{titulo}</h1>
        {descripcion && <div className="text-apagado mt-1">{descripcion}</div>}
      </div>
      {accion}
    </div>
  );
}

export type TonoKpi = 'ok' | 'aviso' | 'neutro';

/** Tarjeta de indicador. Única implementación para todo el producto. */
export function Kpi(
  { etiqueta, valor, pie, tono = 'neutro' }:
  { etiqueta: string; valor: ReactNode; pie?: string; tono?: TonoKpi },
) {
  const punto = tono === 'ok' ? 'bg-exito' : tono === 'aviso' ? 'bg-aviso' : 'bg-marca-600';
  return (
    <div className="bg-white rounded-xl2 border border-linea shadow-tarjeta p-4">
      <div className="flex items-start gap-2 text-xs font-semibold text-apagado uppercase tracking-wide">
        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-none ${punto}`} aria-hidden="true" />
        <span>{etiqueta}</span>
      </div>
      <div className="num text-[28px] leading-none font-bold mt-2.5">{valor}</div>
      {pie && <div className="text-xs text-tenue mt-1.5">{pie}</div>}
    </div>
  );
}

/** Barra de consumo de un saldo de ausencias (empleado y gestión comparten esta). */
export function BarraSaldo(
  { denominacion, asignado, consumido, disponible }:
  { denominacion: string; asignado: number; consumido: number; disponible: number },
) {
  const pct = asignado > 0 ? Math.min(100, Math.round((consumido / asignado) * 100)) : 0;
  return (
    <li>
      <div className="flex justify-between items-baseline gap-3 mb-1.5">
        <span className="font-semibold text-sm">{denominacion}</span>
        <span className="num text-sm"><strong>{disponible}</strong> <span className="text-apagado">/ {asignado}</span></span>
      </div>
      <div className="h-2 rounded-full bg-lienzo border border-linea overflow-hidden"
           role="img" aria-label={`${consumido} consumidos de ${asignado}`}>
        <div className="h-full bg-marca-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-tenue mt-1">{consumido} consumidos · {disponible} disponibles</p>
    </li>
  );
}

/** Selector de mes (periodo) con el mismo estilo que el resto de campos. */
export function SelectorMes({ valor, onCambio, etiqueta = 'Periodo' }:
{ valor: string; onCambio: (v: string) => void; etiqueta?: string }) {
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-semibold mb-1.5">{etiqueta}</label>
      <input id={id} type="month" value={valor} onChange={(e) => onCambio(e.target.value)}
             className="w-full rounded-lg border border-linea bg-white px-3.5 py-2.5
                        focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none" />
    </div>
  );
}
