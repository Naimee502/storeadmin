// ─────────────────────────────────────────────────────────────────────────────
// SERVER MODE — dev vs production, no manual switching:
//
//   npm run dev            (nodemon, server/.env → NODE_ENV=development) → LOCAL
//   npm start / pm2        (NODE_ENV=production, forced by the start script
//                           and by ecosystem.config.js)                 → LIVE
//
// Only affects the public URL written into uploaded-image links (and the
// secure-cookie flag). The same idea as clientapp/src/config/apiconfig.ts.
// ─────────────────────────────────────────────────────────────────────────────
export const IS_PROD = process.env.NODE_ENV === 'production';

const PUBLIC_URL_DEV = process.env.PUBLIC_BASE_URL_DEV || process.env.PUBLIC_BASE_URL || 'http://localhost:4000';
const PUBLIC_URL_PROD = process.env.PUBLIC_BASE_URL_PROD || 'https://rudra.digisysindiatech.com';

export const PUBLIC_BASE_URL = IS_PROD ? PUBLIC_URL_PROD : PUBLIC_URL_DEV;
