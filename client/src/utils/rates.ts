// ---------------------------------------------------------------------------
// Rate comparison across units.
//
// A product is bought in one unit and sold in several (Piece, Dozen, Box...),
// so a raw "sales rate vs purchase rate" comparison is meaningless — ₹200 a
// Piece and ₹2400 a Dozen are the same price. Everything is therefore
// converted to the BASE unit first using the variant's unit conversion
// factors, and only then compared.
//
//   Purchase: Dozen @ ₹2400, Dozen factor 12  →  2400 / 12 = ₹200 per piece
//   Sales:    Piece @ ₹200,  Piece factor 1   →   200 / 1  = ₹200 per piece
//
// Every function returns null when the data needed for a reliable comparison
// is missing (no purchase rate, no conversion row for the unit). Callers must
// treat null as "cannot validate" and let the value through — a half-filled
// form should never be blocked by a check that can't actually be performed.
// ---------------------------------------------------------------------------

// Ids arrive either as a raw string or a populated { id } object depending on
// whether the data came from the form state or from GraphQL.
const idOf = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  return String(v.id ?? v._id ?? "");
};

/** Conversion factor of `unitid` within a variant, or null if not listed. */
export const unitFactorOf = (variant: any, unitid: any): number | null => {
  const target = idOf(unitid);
  if (!target) return null;
  const conv = (variant?.unitconversions || []).find(
    (c: any) => idOf(c.unitid) === target
  );
  const f = Number(conv?.factor);
  return f > 0 ? f : null;
};

/** Purchase rate expressed per single base unit, or null if unknown. */
export const purchaseRatePerBaseUnit = (variant: any): number | null => {
  const rate = Number(variant?.purchaserate) || 0;
  if (rate <= 0) return null;
  const factor = unitFactorOf(variant, variant?.purchaseunitid);
  if (!factor) return null;
  return rate / factor;
};

/**
 * Lowest sales rate allowed for `unitid` — the cost price expressed in that
 * same unit. Null when it can't be determined.
 *
 * NOTE: a unit price row's `quantity` is deliberately NOT part of this. It is
 * a price-slab key, not a pack size — rates are looked up by matching unitid
 * AND quantity (see components/productsection), while `salesrate` always
 * means the price of ONE unit. Multiplying by it inflated the floor (a 580/pc
 * product with a qty-9 slab demanded ₹5220).
 */
export const minAllowedSalesRate = (variant: any, unitid: any): number | null => {
  const perBase = purchaseRatePerBaseUnit(variant);
  if (perBase === null) return null;
  const factor = unitFactorOf(variant, unitid);
  if (!factor) return null;
  return perBase * factor;
};

// Tiny tolerance so a rate that is equal to cost isn't rejected by floating
// point noise (2400/12*12 can land a hair under 2400).
const EPSILON = 0.005;

/**
 * Error text when `rate` sells below cost for this unit, else "".
 * Selling exactly at cost is allowed.
 */
export const belowCostError = (variant: any, unitid: any, rate: any): string => {
  const entered = Number(rate);
  if (!entered || entered <= 0) return ""; // "required" checks own this case
  const min = minAllowedSalesRate(variant, unitid);
  if (min === null) return "";
  if (entered + EPSILON >= min) return "";
  return `Rate cannot be below purchase rate (₹${min.toFixed(2)}) for this unit.`;
};
