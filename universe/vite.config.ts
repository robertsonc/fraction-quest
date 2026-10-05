import { defineConfig } from 'vite';
import { precachePlugin } from './scripts/precache-plugin.ts';

/** The Universe is served beside Fraction Quest 2 at /world/ during Phase 1 (DESIGN.md section 9.1). */
export default defineConfig({
  base: '/world/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { main: 'index.html' },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [precachePlugin()],
});
