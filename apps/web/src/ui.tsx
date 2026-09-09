import { useId, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';

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

export function Alerta({ tipo, children }: { tipo: 'error' | 'exito' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'bg-red-50 text-error border-error/30',
    exito: 'bg-green-50 text-exito border-exito/30',
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
  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${estilos}`} {...props}>
      {children}
    </button>
  );
}

export function Tarjeta({ titulo, children, accion }: { titulo?: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <section className="bg-white rounded-xl2 shadow-tarjeta border border-linea p-5 sm:p-6">
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
