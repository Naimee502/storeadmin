/**
 * Rudra ERP Flavor Configuration
 * This file overrides buildconfig.ts for rudraerp flavor builds
 */

export const BUILD_CONFIG = {
  // Rudra ERP business code (live). Do NOT change to #ADM0001 — that is
  // DK Marketing (RKN) and would give Rudra their logo and theme colour.
  ADMIN_CODE: '#ADM0003',
  FLAVOR: 'rudraerp',
};

export const getAdminCode = () => BUILD_CONFIG.ADMIN_CODE;
