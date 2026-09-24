/**
 * RKN Flavor Configuration  
 * This file overrides buildconfig.ts for rkn flavor builds
 */

export const BUILD_CONFIG = {
  ADMIN_CODE: '#ADM0001',
  FLAVOR: 'rkn',
};

export const getAdminCode = () => BUILD_CONFIG.ADMIN_CODE;
