import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['apollo-upload-client'],
  },
  // Deployed under /admin in production (see src/App.tsx's BASE_PATH
  // comment) — this makes every built asset URL (JS/CSS referenced in
  // index.html) resolve as /admin/assets/... instead of /assets/..., which
  // would 404 once nginx only owns /admin/ for this app. Dev server stays
  // at "/" (localhost:5173) so `npm run dev` is unaffected. Uses Vite's
  // `mode` (not `process.env.NODE_ENV`) so this file doesn't need
  // @types/node just to type-check.
  base: mode === 'production' ? '/admin/' : '/',
  server: {
    proxy: {
      '/graphql': {
        target: 'http://13.220.211.75:4000', // or 'http://localhost:4000' if running locally
        changeOrigin: true,
      },
    },
  },
}));
