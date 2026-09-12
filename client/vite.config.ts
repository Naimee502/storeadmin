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
    // `npm run dev` has no .env.development, so VITE_GRAPHQL_ENDPOINT is
    // undefined and Apollo falls back to same-origin '/graphql' — i.e. these
    // proxy rules decide which server the dev client actually talks to.
    // Pointed at the live server so no local server has to be running; the
    // old http://13.220.211.75:4000 target is dead and every request failed.
    // Going through the proxy (instead of setting VITE_GRAPHQL_ENDPOINT to the
    // live URL) keeps requests same-origin, so the live host needs no CORS
    // entry for localhost:5173.
    //
    // To use a local server instead, swap the target for 'http://localhost:4000'.
    proxy: {
      '/graphql': {
        target: 'https://rudra.digisysindiatech.com',
        changeOrigin: true,
      },
      // Uploaded images that were stored as a relative '/uploads/...' path
      // would otherwise be requested from the dev server and 404.
      '/uploads': {
        target: 'https://rudra.digisysindiatech.com',
        changeOrigin: true,
      },
    },
  },
}));
