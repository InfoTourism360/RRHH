/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Primario "SaaS": índigo. Neutros fríos (slate).
        marca: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3',
        },
        // Contraste verificado sobre `lienzo` (#f6f7fb): todos >= 4.5:1 (WCAG 2.1 AA).
        // No aclarar estos tonos sin recalcular el contraste: la conformidad AA
        // es obligatoria (RD 1112/2018).
        tinta: '#0f172a',   // 16.7:1
        apagado: '#556173', //  5.9:1
        tenue: '#5d6b80',   //  5.1:1
        linea: '#e2e8f0',
        lienzo: '#f6f7fb',
        // Los tres semánticos se usan como texto sobre su propio fondo tintado
        // (bg-green-50 / bg-amber-50 / bg-red-50), que es el peor caso y va por
        // debajo de `lienzo`. Verificado ahí: exito 4.79, aviso 4.84, error 5.91.
        exito: '#15803d',
        aviso: '#b45309',
        error: '#b91c1c',
      },
      boxShadow: {
        tarjeta: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.12)',
        flotante: '0 10px 40px -12px rgba(15,23,42,.25)',
      },
      borderRadius: { xl2: '1rem' },
    },
  },
  plugins: [],
};
