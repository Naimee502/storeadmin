// Per-business-code brand override — the web counterpart of clientapp's
// BRAND_OVERRIDES (clientapp/src/config/colors.ts).
//
// The whole storefront paints its brand through the --color-brand-* custom
// properties declared in index.css's @theme block, so every `bg-brand-700`,
// `text-brand-600`, `border-brand-500`, `from-brand-700` … utility already
// resolves to var(--color-brand-*). Overriding those variables on :root at
// runtime therefore re-themes the entire site without touching a single
// component.
//
// "#ADM0001" (DK Marketing, storeslug "rkn") wants a pure black brand instead
// of the default teal — the same monochrome look the mobile app already gives
// that business. The teal scale is replaced by a neutral grey ramp of the same
// lightness ordering, so contrast and hierarchy stay identical and only the
// hue is removed.
//
// A business code that is not listed here keeps the default teal brand, so
// nothing changes for anyone else.

type BrandVars = Record<`--color-${string}`, string>;

export const BRAND_OVERRIDES: Record<string, BrandVars> = {
  "#ADM0001": {
    "--color-brand-50": "#f5f5f5",  // was #ecfdf5 — faint tint behind cards
    "--color-brand-100": "#ededed", // was #d1fae5
    "--color-brand-200": "#e0e0e0", // was #a7f3d0
    // Sits on the dark ink-900 utility bar, so it has to stay light.
    "--color-brand-300": "#d4d4d4", // was #6ee7b7
    "--color-brand-400": "#a3a3a3", // was #34d399
    "--color-brand-500": "#525252", // was #10b981 — focus ring / borders
    "--color-brand-600": "#262626", // was #0d9488 — secondary text/links
    "--color-brand-700": "#000000", // was #0f766e — the primary brand colour
    // Kept a hair off pure black on purpose: `hover:bg-brand-800` is the hover
    // state of the black `bg-brand-700` buttons, and black-on-black would give
    // no feedback at all. Still reads as black.
    "--color-brand-800": "#1a1a1a", // was #115e59
    "--color-brand-900": "#000000", // was #134e4a
  },
};

const BRAND_KEYS = [
  "--color-brand-50", "--color-brand-100", "--color-brand-200",
  "--color-brand-300", "--color-brand-400", "--color-brand-500",
  "--color-brand-600", "--color-brand-700", "--color-brand-800",
  "--color-brand-900",
] as const;

// Business code -> the value stamped on <html data-brand="...">. Some pieces of
// the override can't be expressed as a flat :root variable swap because they
// must apply to one subtree only — the footer's dark palette is the case in
// point: it needs a neutral ink/slate ramp, but the very same variables paint
// body copy and borders everywhere else and must stay untouched there. Those
// live as `[data-brand="adm0001"] footer { ... }` rules in index.css.
const BRAND_ATTR: Record<string, string> = {
  "#ADM0001": "adm0001",
};

/**
 * Paints (or clears) the brand override for a business code. Clearing matters
 * because the same tab can navigate from one storefront to another — without
 * it, a black brand would leak onto the next business's teal site.
 */
export function applyBrandOverride(adminCode: string | null) {
  const root = document.documentElement;
  const vars = adminCode ? BRAND_OVERRIDES[adminCode] : undefined;
  const attr = adminCode ? BRAND_ATTR[adminCode] : undefined;

  if (attr) root.dataset.brand = attr;
  else delete root.dataset.brand;

  if (!vars) {
    BRAND_KEYS.forEach((k) => root.style.removeProperty(k));
    return;
  }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}
