// Dev server uses SERVER_URL, production builds use SERVER_URL_PROD.
const SERVER_URL = 'http://localhost:4000';

// Production domain.
const SERVER_URL_PROD = 'https://rudra.digisysindiatech.com';

const ACTIVE_SERVER_URL = import.meta.env.DEV ? SERVER_URL : SERVER_URL_PROD;

export const API_CONFIG = {
  SERVER_URL: ACTIVE_SERVER_URL,
  GRAPHQL_URL: `${ACTIVE_SERVER_URL}/graphql`,
};
