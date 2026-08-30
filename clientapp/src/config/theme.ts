import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/rootreducer';
import { COLORS } from './colors';
import { buildBrandTokens } from './brandtheme';

/**
 * The app's colours, with the activated business's brand applied.
 *
 * The brand colour is one hex the admin picks in the web panel; every token
 * that carries it — tints, gradients, the tab bar, the category strip — is
 * derived from that in brandtheme.ts. This used to be a lookup in a table of
 * palettes hand-written per business code, so a new business could not have
 * its own colours without a code change and a store release.
 *
 * No colour set (or an unparseable one) means the built-in green, unchanged.
 */
export const useTheme = () => {
  const isDark = useColorScheme() === 'dark';
  const base = isDark ? COLORS.dark : COLORS.light;

  const brandColor = useSelector((s: RootState) => s.tenant.primaryColor);

  const tokens = useMemo(
    () => (brandColor ? buildBrandTokens(brandColor) : null),
    [brandColor],
  );

  const colors = tokens
    ? { ...base, ...(isDark ? tokens.dark : tokens.light) }
    : base;

  return {
    colors,
    isDark,
  };
};
