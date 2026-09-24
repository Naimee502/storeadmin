/**
 * Powergold Agro Product Flavor Configuration
 * This file overrides buildconfig.ts for powergold flavor builds
 */

export const BUILD_CONFIG = {
  ADMIN_CODE: '#ADM0004',
  FLAVOR: 'powergold',
};

export const getAdminCode = () => BUILD_CONFIG.ADMIN_CODE;
