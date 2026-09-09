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
        tinta: '#0f172a',
        apagado: '#64748b',
        tenue: '#94a3b8',
        linea: '#e2e8f0',
        lienzo: '#f6f7fb',
        exito: '#15803d',
        aviso: '#b45309',
        error: '#dc2626',
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
