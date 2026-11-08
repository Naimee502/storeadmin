
// Compare rates in base units via the variant's conversion factors; null means "can't validate", let it through.

// Ids arrive as a string or a populated { id } object.
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

/** Lowest sales rate for `unitid` (cost in that unit); slab `quantity` is not a multiplier. Null if unknown. */
export const minAllowedSalesRate = (variant: any, unitid: any): number | null => {
  const perBase = purchaseRatePerBaseUnit(variant);
  if (perBase === null) return null;
  const factor = unitFactorOf(variant, unitid);
  if (!factor) return null;
  return perBase * factor;
};

// Tolerance for floating point noise at exactly cost.
const EPSILON = 0.005;

/** Error text when `rate` is below cost for this unit, else ""; at cost is allowed. */
export const belowCostError = (variant: any, unitid: any, rate: any): string => {
  const entered = Number(rate);
  if (!entered || entered <= 0) return ""; // "required" checks own this case
  const min = minAllowedSalesRate(variant, unitid);
  if (min === null) return "";
  if (entered + EPSILON >= min) return "";
  return `Rate cannot be below purchase rate (₹${min.toFixed(2)}) for this unit.`;
};

/** Below-cost check for a line already in the Products List; `rate` overrides while typing. */
export const lineBelowCostError = (line: any, productData: any[], rate?: any): string => {
  if (!line) return "";
  const product = (productData || []).find(
    (p: any) => idOf(p.id ?? p._id) === idOf(line.productserviceid)
  );
  const variant = (product?.productvariants || []).find(
    (v: any) => idOf(v.id ?? v._id) === idOf(line.variantid)
  );
  if (!variant) return "";
  const unitId = line.salesunitid || variant.baseunitid;
  return belowCostError(variant, unitId, rate ?? line.rate);
};

/** Index → error text for every line priced below cost. Empty map = all fine. */
export const getBelowCostLines = (products: any[], productData: any[]): Map<number, string> => {
  const map = new Map<number, string>();
  (products || []).forEach((line, i) => {
    const err = lineBelowCostError(line, productData);
    if (err) map.set(i, err);
  });
  return map;
};
