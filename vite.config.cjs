const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  cacheDir: './node_modules/.vite_tmp',
  server: {
    port: 5173,
    proxy: {
      '/restapis': {
        target: 'http://localhost:4566',
        changeOrigin: true,
      },
      '/floci-sts': {
        target: 'http://localhost:4566',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/floci-sts/, '') || '/',
      },
    },
  },
});
