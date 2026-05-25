import { useColorScheme } from 'react-native';
import { COLORS } from './colors';

export const useTheme = () => {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS.dark : COLORS.light;

  return {
    colors,
    isDark,
  };
};
