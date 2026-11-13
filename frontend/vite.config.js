// Vite: Vue, Tailwind y un proxy de /api al backend para no necesitar CORS en desarrollo.
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

const API = process.env.MOTOSTORE_API ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: API, changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: API, changeOrigin: true } },
  },
});
