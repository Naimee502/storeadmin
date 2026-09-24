import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Server URL (local for dev, live for build) lives in src/config/apiconfig.ts.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['apollo-upload-client'],
  },
  // Deployed under /admin in production (see src/App.tsx's BASE_PATH).
  // Dev server stays at "/" (localhost:5173).
  base: mode === 'production' ? '/admin/' : '/',
}));
