/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.PROXY_TARGET || 'https://portal2.musesai.com:8443';

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    },
    server: {
      port: 36000,
      open: true,
      host: true,
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true, secure: true },
        '/ws': { target: proxyTarget, ws: true, changeOrigin: true, secure: true },
      },
      ignored: ['**/node_modules/**', '**/build/**']
    },
    preview: { port: 36000, host: true },
    build: { outDir: 'build' },
  };
});
