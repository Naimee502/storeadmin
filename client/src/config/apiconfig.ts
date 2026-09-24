// ─────────────────────────────────────────────────────────────────────────────
// SERVER URL — debug vs release, no manual switching (same idea as
// clientapp/src/config/apiconfig.ts):
//
//   npm run dev    → SERVER_URL       (LOCAL)
//   npm run build  → SERVER_URL_PROD  (LIVE)
//
// Vite's `import.meta.env.DEV` is true only for the dev server and is always
// false in a production build, so a built bundle can never call localhost.
// ─────────────────────────────────────────────────────────────────────────────
const SERVER_URL = 'http://localhost:4000';

// Production domain. Update here if it ever changes.
const SERVER_URL_PROD = 'https://rudra.digisysindiatech.com';

const ACTIVE_SERVER_URL = import.meta.env.DEV ? SERVER_URL : SERVER_URL_PROD;

export const API_CONFIG = {
  SERVER_URL: ACTIVE_SERVER_URL,
  GRAPHQL_URL: `${ACTIVE_SERVER_URL}/graphql`,
};
