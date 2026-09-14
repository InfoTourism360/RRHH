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
export const IcoPlantilla = base('M3 21h18|M5 21V7l7-4 7 4v14|M9 21v-4h6v4|M9 11h.01M15 11h.01M9 14h.01M15 14h.01');
export const IcoActividad = base('M3 12h4l2 6 4-14 2 8h6');
export const IcoAprobar = base('M9 12l2 2 4-4|M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z');
export const IcoCampana = base('M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9|M13.7 21a2 2 0 0 1-3.4 0');
export const IcoAjustes = base('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z');
export const IcoLlave = base('M15 7a4 4 0 1 1-3.9 5H8v3H5v3H2v-3l6.1-6.1A4 4 0 0 1 15 7z|M16.5 7.5h.01');
export const IcoEntrar = base('M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4|M10 17l5-5-5-5|M15 12H3');
export const IcoPausa = base('M10 9v6M14 9v6|M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z');
export const IcoReanudar = base('M10 8.5l5.5 3.5-5.5 3.5z|M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z');
