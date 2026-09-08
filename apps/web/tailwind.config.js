/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta con contraste AA sobre blanco (>= 4.5:1).
        marca: { DEFAULT: '#0b5cab', oscuro: '#08417a', claro: '#e8f0f9' },
        exito: '#1a7f37',
        error: '#b3261e',
        aviso: '#8a5a00',
      },
    },
  },
  plugins: [],
};
