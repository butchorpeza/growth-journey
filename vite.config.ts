import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps the build portable: it can be served from /about/ on butchorpeza.com or from any sub-folder.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    // three.js, R3F and the scenes are reached only through dynamic import() (src/three/mountScene.tsx),
    // so they land in their own chunks and never block the HTML story.
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5173 },
});
