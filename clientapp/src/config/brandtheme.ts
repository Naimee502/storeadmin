// Builds the app's brand tokens from the one colour an admin picks in the web
// panel (Settings → General → Theme Colour).
//
// This replaced BRAND_OVERRIDES — a table of hand-written palettes keyed by
// business code, which meant a business wanting its own colours needed a code
// change and a store release. The twin of clientweb/src/config/brandtheme.ts;
// the two must stay in step, and are duplicated rather than shared because
// there is no common package between the app and the web client in this repo.
//
// Only the tokens that carry the brand are derived. Text, borders, surfaces,
// errors and the rest of COLORS are untouched — a business picks a brand, not
// a whole design system.

type RGB = [number, number, number];

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

const parseHex = (value: string): RGB | null => {
  const hex = String(value || '').trim().replace(/^#/, '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const toHex = ([r, g, b]: RGB) =>
  '#' +
  [r, g, b]
    .map(n => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

const mix = (from: RGB, to: RGB, amount: number): RGB => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
];

const rgba = ([r, g, b]: RGB, alpha: number) =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;

/** Perceived brightness, 0 (black) to 1 (white). */
const luminance = ([r, g, b]: RGB) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

export type BrandTokens = Record<string, string | string[]>;

/**
 * Light and dark token sets for one brand colour.
 *
 * The awkward cases are the two ends of the brightness range, and both are the
 * same problem: a token has to stay legible against something it cannot
 * control.
 *
 *   - A near-black brand cannot go darker for its pressed/hover state, and in
 *     dark mode it disappears entirely against the page — so it inverts to
 *     white there, which is what the old hand-written black palette did too.
 *   - A pale brand cannot carry the white text that sits on brand-coloured
 *     buttons, so the token those buttons use is darkened.
 *
 * The tab bar gets its own tokens rather than reusing `brand`, because a
 * business can want a bar painted a colour the brand itself cannot sit on — a
 * black brand on a black bar being the case that forced it.
 */
export const buildBrandTokens = (brandColor: string): { light: BrandTokens; dark: BrandTokens } | null => {
  const seed = parseHex(brandColor);
  if (!seed) return null;

  const lum = luminance(seed);
  const veryDark = lum < 0.12;
  const veryLight = lum > 0.55;

  // What anything carrying white text is painted with.
  const core = veryLight ? mix(seed, BLACK, 0.42) : seed;
  const coreHex = toHex(core);

  const darker = veryDark ? mix(core, WHITE, 0.1) : mix(core, BLACK, 0.22);
  const lighter = mix(core, WHITE, veryDark ? 0.25 : 0.18);

  const light: BrandTokens = {
    brand: coreHex,
    brandDark: toHex(darker),
    brandLight: toHex(lighter),
    brandSoft: toHex(mix(core, WHITE, 0.9)),
    brandSoftAlt: toHex(mix(core, WHITE, 0.95)),
    brandOverlay: rgba(core, 0.16),
    softSurface: toHex(mix(core, WHITE, 0.94)),
    appGradient: [
      toHex(mix(core, WHITE, 0.96)),
      toHex(mix(core, WHITE, 0.98)),
      '#FFFFFF',
    ],
    darkGradient: [
      toHex(mix(core, BLACK, 0.92)),
      toHex(mix(core, BLACK, 0.86)),
      toHex(mix(core, BLACK, 0.96)),
    ],
    heroOverlay: rgba(mix(core, BLACK, 0.72), 0.5),
    modalOverlay: rgba(mix(core, BLACK, 0.82), 0.56),

    tabBarActive: coreHex,
    tabBarPill: toHex(mix(core, WHITE, 0.9)),
    categoryLabel: veryDark ? coreHex : '#666666',
  };

  // In dark mode the page itself is near-black, so a dark brand has to invert
  // or it cannot be seen at all. A normal brand only lifts a little.
  const darkBrand = veryDark ? '#FFFFFF' : toHex(mix(core, WHITE, 0.28));

  const dark: BrandTokens = {
    brand: darkBrand,
    brandDark: coreHex,
    brandLight: toHex(mix(core, WHITE, 0.4)),
    brandSoft: rgba(mix(core, WHITE, 0.5), 0.12),
    brandSoftAlt: rgba(mix(core, WHITE, 0.5), 0.08),
    brandOverlay: rgba(core, 0.2),
    appGradient: [
      toHex(mix(core, BLACK, 0.92)),
      toHex(mix(core, BLACK, 0.86)),
      toHex(mix(core, BLACK, 0.96)),
    ],
    darkGradient: [
      toHex(mix(core, BLACK, 0.92)),
      toHex(mix(core, BLACK, 0.86)),
      toHex(mix(core, BLACK, 0.96)),
    ],
    heroOverlay: rgba(mix(core, BLACK, 0.72), 0.5),

    tabBarActive: darkBrand,
    tabBarPill: rgba(mix(core, WHITE, 0.5), 0.14),
    categoryLabel: veryDark ? '#FFFFFF' : '#B8B8B8',
  };

  return { light, dark };
};
