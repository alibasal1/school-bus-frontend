import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  cacheDir: './node_modules/.vite_tmp',
  server: {
    port: 5173,
    proxy: {
      '/restapis': {
        target: 'http://localhost:4566',
        changeOrigin: true,
      },
    },
  },
});
