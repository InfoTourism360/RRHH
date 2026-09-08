import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La API corre en :3001; en desarrollo se accede vía proxy /api.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
});
