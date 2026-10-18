import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'node:fs';

export default defineConfig(({ mode }) => {
const apiOrigin = mode === 'development' ? 'http://localhost:8080' : 'https://afterclick-nine.vercel.app';
return {
  define: { __AFTERCLICK_API_ORIGIN__: JSON.stringify(apiOrigin) },
  plugins: [react(), {
    name: 'afterclick-api-permission',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify({
        ...JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8')),
        host_permissions: [`${apiOrigin}/*`],
      }, null, 2) });
    },
  }],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/content-script.ts'),
        inspect: resolve(__dirname, 'inspect.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background/service-worker.js';
          if (chunkInfo.name === 'content') return 'content/content-script.js';
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    target: 'chrome120',
    minify: true,
    sourcemap: false,
  },
};
});
