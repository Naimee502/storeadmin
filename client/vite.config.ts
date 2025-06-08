import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['apollo-upload-client'],
  },
  server: {
    proxy: {
      '/graphql': {
        target: 'http://13.220.211.75:4000', // or 'http://localhost:4000' if running locally
        changeOrigin: true,
      },
    },
  },
});
