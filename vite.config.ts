import { defineConfig } from 'vite';
import path from 'node:path';
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  esbuild: { jsx: 'automatic' },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: { port: 5199, strictPort: false },
});
