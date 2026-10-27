import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET || 'http://127.0.0.1:5001',
          changeOrigin: true,
        },
      },
    },
  };
})
