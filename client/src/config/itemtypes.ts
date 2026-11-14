// Item type decides which product fields show. Blank type = the full form, as before.
export const NON_SELLING = new Set(["raw", "semifinished", "consumable"]);

const SALES_FIELDS = ["unitprices_unitid", "quantity", "mrp", "salesrate", "discount", "discounttype", "offerprice", "add_unit_price"];
const WEBSITE_FIELDS = ["metatitle", "metadescription", "keywords", "slug"];

/** False when the item type hides this field (raw / semi-finished / consumable are not sold). */
export const typeAllows = (itemtype: string | undefined | null, fieldId: string) =>
  !(NON_SELLING.has(String(itemtype || "")) && (SALES_FIELDS.includes(fieldId) || WEBSITE_FIELDS.includes(fieldId)));

/** Item types a BOM can make. Blank counts as finished. */
export const MAKEABLE = new Set(["", "finished", "semifinished", "kit"]);

/** Sell / Buy / Make a new item starts with, from its type (blank type = everywhere). */
export const usesOfType = (itemtype: string | undefined | null) => {
  const t = String(itemtype || "");
  return { cansell: !NON_SELLING.has(t), canbuy: true, canmake: MAKEABLE.has(t) };
};

// Same list in, same list out, so screens that memo on it do not redraw.
const forUseCache = new WeakMap<object, Record<string, any[]>>();

/** Items a form may offer: only an explicit "No" hides one, so items saved earlier show as before. */
export const forUse = <T,>(list: T[], use: "sell" | "buy" | "make"): T[] => {
  if (!list.length) return list;
  let byUse = forUseCache.get(list);
  if (!byUse) forUseCache.set(list, (byUse = {}));
  if (!byUse[use]) {
    const kept = list.filter((p: any) => p?.[`can${use}`] !== false);
    byUse[use] = kept.length === list.length ? list : kept;
  }
  return byUse[use] as T[];
};
