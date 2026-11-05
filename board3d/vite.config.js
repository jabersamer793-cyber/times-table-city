// Builds the 2.5D board (React + three.js) into one script, src/board3d.js,
// which src/build.mjs (or src/build.ps1) inlines into index.html so the game stays a single offline file.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: '../src/board3d',
    emptyOutDir: true,
    target: 'es2019',
    minify: true,
    lib: { entry: 'src/main.jsx', name: 'Board3D', formats: ['iife'], fileName: () => 'board3d.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
