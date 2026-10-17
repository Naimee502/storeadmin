/**
 * Pelican Chocolate Industry Flavor Configuration
 * This file overrides buildconfig.ts for pelican flavor builds
 */

export const BUILD_CONFIG = {
  ADMIN_CODE: '#ADM0005',
  FLAVOR: 'pelican',
};

export const getAdminCode = () => BUILD_CONFIG.ADMIN_CODE;
