/**
 * Arsi Agarbatti Flavor Configuration
 * This file overrides buildconfig.ts for arsi flavor builds
 */

export const BUILD_CONFIG = {
  ADMIN_CODE: '#ADM0002',
  FLAVOR: 'arsi',
};

export const getAdminCode = () => BUILD_CONFIG.ADMIN_CODE;
