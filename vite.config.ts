import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createJarvisApiMiddleware } from './server/jarvisBackend.ts';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'jarvis-api-backend',
      configureServer(server) {
        server.middlewares.use(createJarvisApiMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createJarvisApiMiddleware());
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true
  }
});
