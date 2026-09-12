/**
 * Rudra ERP Flavor Configuration
 * This file overrides buildconfig.ts for rudraerp flavor builds
 */

export const BUILD_CONFIG = {
  ADMIN_CODE: '#ADM0003',
  FLAVOR: 'rudraerp',
};

export const getAdminCode = () => BUILD_CONFIG.ADMIN_CODE;
