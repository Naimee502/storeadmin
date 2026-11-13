// Item type decides which product fields show. Blank type = the full form, as before.
export const NON_SELLING = new Set(["raw", "semifinished", "consumable"]);

const SALES_FIELDS = ["unitprices_unitid", "quantity", "mrp", "salesrate", "discount", "discounttype", "offerprice", "add_unit_price"];
const WEBSITE_FIELDS = ["metatitle", "metadescription", "keywords", "slug"];

/** False when the item type hides this field (raw / semi-finished / consumable are not sold). */
export const typeAllows = (itemtype: string | undefined | null, fieldId: string) =>
  !(NON_SELLING.has(String(itemtype || "")) && (SALES_FIELDS.includes(fieldId) || WEBSITE_FIELDS.includes(fieldId)));

/** Item types a BOM can make. Blank counts as finished. */
export const MAKEABLE = new Set(["", "finished", "semifinished", "kit"]);
