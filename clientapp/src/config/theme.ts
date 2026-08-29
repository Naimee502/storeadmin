import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/rootreducer';
import { COLORS, BRAND_OVERRIDES } from './colors';

export const useTheme = () => {
  const isDark = useColorScheme() === 'dark';
  const base = isDark ? COLORS.dark : COLORS.light;

  // Per-business-code brand override (e.g. "#ADM0001" -> pure black brand).
  // Only the overridden brand keys are merged onto the base theme; any business
  // code without an entry keeps the default green brand unchanged.
  const businessCode = useSelector((s: RootState) => s.tenant.businessCode);
  const override = businessCode ? BRAND_OVERRIDES[businessCode] : undefined;

  const colors = override
    ? { ...base, ...(isDark ? override.dark : override.light) }
    : base;

  return {
    colors,
    isDark,
  };
};
