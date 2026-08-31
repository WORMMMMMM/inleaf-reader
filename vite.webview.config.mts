import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.DRAGGABLE_DEBUG': 'false'
  },
  build: {
    codeSplitting: false,
    emptyOutDir: false,
    outDir: 'media',
    sourcemap: false,
    lib: {
      entry: 'webview/src/main.tsx',
      formats: ['es'],
      fileName: () => 'reader-app.js'
    },
    rollupOptions: {
      output: {
        chunkFileNames: 'reader-[name].js',
        assetFileNames: assetInfo => assetInfo.name?.endsWith('.css') ? 'reader-app.css' : 'reader-app-[name][extname]'
      }
    }
  }
});
