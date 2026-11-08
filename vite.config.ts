import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:3001',
        ws: true,
      },
      '/api': {
        target: 'http://127.0.0.1:3001',
      },
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: {
        game: resolve(root, 'index.html'),
        unitLab: resolve(root, 'tools/unit-lab/index.html'),
        mapLab: resolve(root, 'tools/map-lab/index.html'),
      },
    },
  },
});
