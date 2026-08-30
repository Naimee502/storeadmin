// Builds the storefront's whole palette from the one brand colour an admin
// picks in Settings → General.
//
// This replaced a table of hand-written palettes keyed by business code. That
// table meant a business wanting its own colours needed a code change, a
// review and a deploy — so in practice exactly one business ever got them.
// Everything here is derived instead, and the admin panel writes the seed.
//
// How it reaches the page: the storefront paints its brand through the
// --color-brand-* custom properties declared in index.css's @theme block, so
// every `bg-brand-700`, `text-brand-600`, `border-brand-500`, `from-brand-700`
// … utility already resolves to var(--color-brand-*). Setting those variables
// on :root at runtime re-themes the entire site without touching a component.

type RGB = [number, number, number];

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

const parseHex = (value: string): RGB | null => {
  const hex = String(value || "").trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const toHex = ([r, g, b]: RGB) =>
  "#" +
  [r, g, b]
    .map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0"))
    .join("");

/** `amount` is how far to travel from `from` toward `to` — 0 keeps `from`. */
const mix = (from: RGB, to: RGB, amount: number): RGB => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
];

/** Perceived brightness, 0 (black) to 1 (white). */
const luminance = ([r, g, b]: RGB) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

const BRAND_KEYS = [
  "--color-brand-50", "--color-brand-100", "--color-brand-200",
  "--color-brand-300", "--color-brand-400", "--color-brand-500",
  "--color-brand-600", "--color-brand-700", "--color-brand-800",
  "--color-brand-900",
] as const;

// Fed to the [data-brand="custom"] rules in index.css, which repaint only the
// footer / newsletter / stats-bar subtrees. Those blocks are dark grounds with
// light text; the same ink/slate variables paint body copy and borders
// everywhere else, which is why the swap has to be scoped there rather than
// applied on :root like the brand ramp.
const DARK_BLOCK_KEYS = [
  "--brand-ink-900", "--brand-ink-800",
  "--brand-slate-200", "--brand-slate-300", "--brand-slate-400", "--brand-slate-500",
] as const;

const ALL_KEYS: readonly string[] = [...BRAND_KEYS, ...DARK_BLOCK_KEYS];

/**
 * The ten-step brand ramp, plus the dark-block palette.
 *
 * Two guards keep an unlucky colour choice from producing an unusable site:
 *
 *   - A near-black brand cannot be darkened. `bg-brand-800` is the hover state
 *     of the `bg-brand-700` buttons, and black-on-black gives no feedback at
 *     all, so for a very dark seed the deep end lifts toward white instead.
 *   - A pale brand (a yellow, a pastel) cannot carry white text. The deep end
 *     is built from a toned-down core so buttons stay readable, while the light
 *     tints still come from the colour the admin actually picked.
 */
const buildPalette = (seed: RGB): Record<string, string> => {
  const lum = luminance(seed);
  const veryDark = lum < 0.12;
  const veryLight = lum > 0.55;

  const core = veryLight ? mix(seed, BLACK, 0.42) : seed;
  const deepen = (amount: number): RGB =>
    veryDark ? mix(core, WHITE, amount * 0.55) : mix(core, BLACK, amount);

  return {
    "--color-brand-50": toHex(mix(seed, WHITE, 0.95)),
    "--color-brand-100": toHex(mix(seed, WHITE, 0.9)),
    "--color-brand-200": toHex(mix(seed, WHITE, 0.8)),
    // Sits on the dark utility bar at the top of the page, so it has to stay
    // light no matter what the seed is.
    "--color-brand-300": toHex(mix(seed, WHITE, 0.62)),
    "--color-brand-400": toHex(mix(seed, WHITE, 0.36)),
    "--color-brand-500": toHex(mix(seed, WHITE, 0.16)),
    "--color-brand-600": toHex(deepen(0.12)),
    "--color-brand-700": toHex(core),
    "--color-brand-800": toHex(deepen(0.2)),
    "--color-brand-900": toHex(deepen(0.34)),

    "--brand-ink-900": toHex(mix(core, BLACK, 0.9)),
    // Gradient end. On a black seed this has to lift, or the footer's fade has
    // nothing to fade between.
    "--brand-ink-800": toHex(veryDark ? mix(core, WHITE, 0.1) : mix(core, BLACK, 0.82)),
    "--brand-slate-200": toHex(mix(core, WHITE, 0.9)),
    "--brand-slate-300": toHex(mix(core, WHITE, 0.8)),
    "--brand-slate-400": toHex(mix(core, WHITE, 0.58)),
    "--brand-slate-500": toHex(mix(core, WHITE, 0.4)),
  };
};

/**
 * Paint (or clear) the storefront's brand.
 *
 * Clearing matters because the same tab can navigate from one storefront to
 * another — without it a black brand would leak onto the next business's site.
 * An empty or unparseable colour clears too, which is what makes "leave it
 * blank to keep the default" work with no special case anywhere else.
 */
export function applyBrandTheme(brandColor: string | null | undefined) {
  const root = document.documentElement;
  const seed = brandColor ? parseHex(brandColor) : null;

  if (!seed) {
    ALL_KEYS.forEach((k) => root.style.removeProperty(k));
    delete root.dataset.brand;
    return;
  }

  Object.entries(buildPalette(seed)).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.brand = "custom";
}

/** Exported for previews and tests. */
export const previewBrandPalette = (brandColor: string) => {
  const seed = parseHex(brandColor);
  return seed ? buildPalette(seed) : null;
};
