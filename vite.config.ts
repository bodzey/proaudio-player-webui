import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.PROAUDIO_BACKEND || 'http://127.0.0.1:8080';
  const base = process.env.PROAUDIO_BASE || env.PROAUDIO_BASE || '/';

  return {
    base,
    plugins: [solid(), tailwindcss()],
    build: {
      target: 'es2022',
      assetsDir: 'assets',
      sourcemap: false,
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
