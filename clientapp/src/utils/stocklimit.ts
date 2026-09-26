import type { CartItem } from '../store/slices/cart';

/**
 * Stock cap for the party cart — Business Settings -> "Restrict quantity by
 * stock".
 *
 * Stock is held in BASE units; the cart counts packs (a unit price: "1 Box",
 * "2 x Piece"). So a pack uses up `unit quantity x the unit's conversion
 * factor` base units, and every line of the same variant — whatever unit it
 * was added in — draws on the same stock.
 *
 * Returns Infinity whenever nothing should cap: the setting is off, or the
 * stock isn't known (a line added by an older app version). The server holds
 * party orders to the same rule, so an uncapped line can't slip through.
 */

/** Base units in one pack of `unitId` on this variant. */
export const baseQtyOf = (variant: any, unitId: string | undefined, unitqty: any): number => {
  const conv = (variant?.unitconversions ?? []).find(
    (c: any) => c?.unitid?.id && c.unitid.id === unitId,
  );
  const factor = Number(conv?.factor) > 0 ? Number(conv.factor) : 1;
  return (Number(unitqty) || 1) * factor;
};

/** Variant stock in base units, or undefined when the product carries none. */
export const stockOf = (variant: any): number | undefined =>
  typeof variant?.currentstock === 'number' ? Number(variant.currentstock) : undefined;

const sameLine = (i: CartItem, productId: string, variantId: string, unitId?: string) =>
  i.productId === productId && i.variantId === variantId && i.unitId === unitId;

/**
 * How many packs this line may hold IN TOTAL (not "more").
 */
export const maxPacksFor = (opts: {
  restrict: boolean;
  stock: number | undefined;
  baseqty: number | undefined;
  items: CartItem[];
  productId: string;
  variantId: string;
  unitId?: string;
}): number => {
  const { restrict, stock, items, productId, variantId, unitId } = opts;
  if (!restrict || typeof stock !== 'number') return Infinity;
  const perPack = opts.baseqty && opts.baseqty > 0 ? opts.baseqty : 1;
  const usedElsewhere = items
    .filter(i => i.variantId === variantId && !sameLine(i, productId, variantId, unitId))
    .reduce((sum, i) => sum + i.qty * (i.baseqty ?? 1), 0);
  return Math.max(0, Math.floor((stock - usedElsewhere) / perPack + 1e-9));
};

/** Same, for a line already in the cart (uses what was stored when it was added). */
export const maxPacksForItem = (restrict: boolean, item: CartItem, items: CartItem[]): number =>
  maxPacksFor({
    restrict,
    stock: item.stock,
    baseqty: item.baseqty,
    items,
    productId: item.productId,
    variantId: item.variantId,
    unitId: item.unitId,
  });
