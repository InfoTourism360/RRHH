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

// Mensaje accesible: region con aria-live para que el lector lo anuncie.
export function Alerta({ tipo, children }: { tipo: 'error' | 'exito' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'bg-red-50 text-error border-error',
    exito: 'bg-green-50 text-exito border-exito',
    info: 'bg-marca-claro text-marca-oscuro border-marca',
  }[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} aria-live={tipo === 'error' ? 'assertive' : 'polite'}
         className={`border-l-4 rounded px-4 py-3 ${estilos}`}>
      {children}
    </div>
  );
}

export function Campo(
  { etiqueta, ayuda, error, ...props }:
  { etiqueta: string; ayuda?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>,
) {
  const id = useId();
  const ayudaId = `${id}-ayuda`;
  const errId = `${id}-err`;
  const descrito = [ayuda ? ayudaId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block font-medium mb-1">{etiqueta}</label>
      {ayuda && <p id={ayudaId} className="text-sm text-gray-600 mb-1">{ayuda}</p>}
      <input id={id} aria-describedby={descrito} aria-invalid={!!error}
             className="w-full rounded border border-gray-400 px-3 py-2 focus-visible:border-marca"
             {...props} />
      {error && <p id={errId} className="text-sm text-error mt-1">{error}</p>}
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
      <label htmlFor={id} className="block font-medium mb-1">{etiqueta}</label>
      <select id={id} className="w-full rounded border border-gray-400 px-3 py-2 bg-white" {...props}>
        {children}
      </select>
    </div>
  );
}

export function Boton(
  { children, variante = 'primario', ...props }:
  { children: ReactNode; variante?: 'primario' | 'secundario' | 'peligro' } &
  React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const estilos = {
    primario: 'bg-marca text-white hover:bg-marca-oscuro',
    secundario: 'bg-white text-marca border border-marca hover:bg-marca-claro',
    peligro: 'bg-error text-white hover:brightness-90',
  }[variante];
  return (
    <button className={`inline-flex items-center justify-center rounded px-4 py-2 font-semibold disabled:opacity-60 ${estilos}`} {...props}>
      {children}
    </button>
  );
}

export function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h2 className="text-lg font-semibold mb-3">{titulo}</h2>
      {children}
    </section>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <p role="status" aria-live="polite" className="text-gray-600">{texto}</p>;
}
