// Iconos de línea minimalistas (24x24, stroke), heredan color con currentColor.
type P = { className?: string };
const base = (d: string) => ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"
       style={{ width: '1.25rem', height: '1.25rem' }}>
    {d.split('|').map((seg, i) => <path key={i} d={seg} />)}
  </svg>
);

export const IcoPanel = base('M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z');
export const IcoReloj = base('M12 7v5l3 2|M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z');
export const IcoAusencias = base('M8 2v4M16 2v4M3 10h18|M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z|M9 16l2 2 4-4');
export const IcoCalendario = base('M8 2v4M16 2v4M3 10h18|M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z');
export const IcoDoc = base('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M9 13h6M9 17h6');
export const IcoUsuario = base('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M4 21a8 8 0 0 1 16 0');
export const IcoSalir = base('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9');
export const IcoMenu = base('M4 6h16M4 12h16M4 18h16');
export const IcoCerrar = base('M6 6l12 12M18 6L6 18');
export const IcoInicio = base('M3 10.5 12 3l9 7.5|M5 9.5V21h14V9.5');
