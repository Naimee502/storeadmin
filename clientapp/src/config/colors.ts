export const COLORS = {
  light: {
    primary: '#000000',
    brand: '#1F7A3A',
    brandDark: '#17622E',
    brandLight: '#2FA34F',
    brandSoft: '#E7F6E8',
    // Second (lighter) stop of the drawer header gradient. Was hardcoded in
    // customdrawer; lives here so per-business-code overrides can reach it.
    brandSoftAlt: '#F0FDF4',
    // Bottom tab bar. These default to the same values the tab bar already
    // resolved from cardGlass/border/brand/subText/brandSoft, so nothing
    // changes for a business code without an override. They are separate
    // tokens because a business can paint the bar a colour that the brand
    // itself cannot sit on — e.g. "#ADM0001" has a black brand AND wants a
    // black bar, so the active icon there has to come from its own token.
    tabBarBg: 'rgba(255,255,255,0.92)',   // = cardGlass
    tabBarBorder: '#EAEAEA',              // = border
    tabBarActive: '#1F7A3A',              // = brand
    tabBarInactive: '#666666',            // = subText
    tabBarPill: '#E7F6E8',                // = brandSoft
    // Unselected label in the Home/Shop category strip. Defaults to subText,
    // so nothing changes for a business code without an override.
    categoryLabel: '#666666',             // = subText
    warmSoft: '#FFF0D8',
    appGradient: ['#F8FFF4', '#FFF9EF', '#FFFFFF'],
    darkGradient: ['#07110C', '#101010', '#000000'],
    cardGlass: 'rgba(255,255,255,0.92)',
    softSurface: '#F4F8F2',
    raisedSurface: '#FFFFFF',
    iconOverlay: 'rgba(255,255,255,0.92)',
    whiteOverlay: 'rgba(255,255,255,0.08)',
    brandOverlay: 'rgba(31,122,58,0.16)',
    warmOverlay: 'rgba(244,180,77,0.10)',
    haloBorder: 'rgba(0,0,0,0.03)',
    heroOverlay: 'rgba(9,35,18,0.5)',
    dimOverlay: 'rgba(0,0,0,0.5)',
    modalOverlay: 'rgba(7,17,12,0.56)',
    shadow: '#000000',
    onBrand: '#FFFFFF',
    rating: '#F4B44D',
    google: '#DB4437',
    secondary: '#F5F5F5',
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#000000',
    subText: '#666666',
    border: '#EAEAEA',
    placeholder: '#CCCCCC',
    error: '#D32F2F',
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
    accentGray: '#E0E0E0',
    gradient: ['#FFFFFF', '#F5F5F5', '#EAEAEA'],
  },
  dark: {
    primary: '#FFFFFF',
    brand: '#5BCB73',
    brandDark: '#1F7A3A',
    brandLight: '#7EE08E',
    brandSoft: 'rgba(31,122,58,0.16)',
    // Dark mode already used brandSoft for both drawer gradient stops, so the
    // alt stop matches it here — the drawer looks exactly as it did before.
    brandSoftAlt: 'rgba(31,122,58,0.16)',
    // Same defaults as light mode: whatever the tab bar resolved before.
    tabBarBg: 'rgba(255,255,255,0.06)',   // = cardGlass
    tabBarBorder: '#2A2A2A',              // = border
    tabBarActive: '#5BCB73',              // = brand
    tabBarInactive: '#A0A0A0',            // = subText
    tabBarPill: 'rgba(31,122,58,0.16)',   // = brandSoft
    categoryLabel: '#A0A0A0',             // = subText
    warmSoft: 'rgba(244,180,77,0.10)',
    appGradient: ['#07110C', '#101010', '#000000'],
    darkGradient: ['#07110C', '#101010', '#000000'],
    cardGlass: 'rgba(255,255,255,0.06)',
    softSurface: '#151515',
    raisedSurface: '#151515',
    iconOverlay: 'rgba(0,0,0,0.45)',
    whiteOverlay: 'rgba(255,255,255,0.08)',
    brandOverlay: 'rgba(31,122,58,0.2)',
    warmOverlay: 'rgba(244,180,77,0.10)',
    haloBorder: 'rgba(255,255,255,0.06)',
    heroOverlay: 'rgba(9,35,18,0.5)',
    dimOverlay: 'rgba(0,0,0,0.5)',
    modalOverlay: 'rgba(0,0,0,0.68)',
    shadow: '#000000',
    onBrand: '#FFFFFF',
    rating: '#F4B44D',
    google: '#DB4437',
    secondary: '#1A1A1A',
    background: '#000000',
    card: '#121212',
    text: '#FFFFFF',
    subText: '#A0A0A0',
    border: '#2A2A2A',
    placeholder: '#4A4A4A',
    error: '#FF453A',
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
    accentGray: '#333333',
    gradient: ['#000000', '#121212', '#1E1E1E'],
  },
};

// Per-business-code brand override.
// Only the brand-family keys listed here replace the default (green) brand for
// the given business code — every other color stays exactly as the base
// light/dark theme. Business codes NOT present here keep the normal green brand,
// so nothing changes for them.
//
// "#ADM0001" -> pure black brand (no gray mixed in). In dark mode the accent is
// white so icons/text stay visible on the dark background, while the button
// gradient stays black with its white label — a clean black/white monochrome.
//
// This client does not want ANY green in the UI, so the override also covers
// the tokens that only carry a faint green *tint* rather than the brand colour
// itself: the page gradients, the soft surface behind icon chips, and the
// hero/modal scrims. Each is replaced by its neutral grey/black equivalent at
// the same lightness and opacity, so layouts and contrast stay identical —
// only the hue is removed. Toast colours are deliberately NOT touched: they
// come from react-native-toast-notifications' own success/danger palette, and
// a green success toast is still wanted.
type ColorKey =
  | 'brand' | 'brandDark' | 'brandLight' | 'brandSoft' | 'brandSoftAlt'
  | 'brandOverlay' | 'softSurface' | 'heroOverlay' | 'modalOverlay'
  | 'tabBarBg' | 'tabBarBorder' | 'tabBarActive' | 'tabBarInactive' | 'tabBarPill'
  | 'categoryLabel';
type GradientKey = 'appGradient' | 'darkGradient';
// Brand colours are no longer listed here. A business picks one colour in the
// web panel (Settings → General → Theme Colour) and config/brandtheme.ts
// derives every brand token from it — see useTheme. What is left in this file
// is the default palette that a business with no colour set still gets.
