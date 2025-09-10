import { Types } from "mongoose";
import { IProductVariant } from "../../models/products";

/**
 * Convert a quantity from a given unit (sales or purchase) to the variant's base unit
 * @param qty - quantity in the selected unit
 * @param unitId - selected unit (salesunitid or purchaseunitid)
 * @param variant - product variant object with unitconversions
 * @returns quantity in base unit
 */
export function convertToBaseUnit(
  qty: number,
  unitId?: Types.ObjectId | string,
  variant?: IProductVariant
): number {
  if (!variant || !unitId || !variant.baseunitid) return qty;

  // Normalize unitId to string for safe comparison
  const unitIdStr = unitId instanceof Types.ObjectId ? unitId.toString() : unitId;

  if (!variant.unitconversions || variant.unitconversions.length === 0) {
    return qty;
  }

  const conversion = variant.unitconversions.find((u) => {
    if (!u.unitid) return false;
    const uIdStr = u.unitid instanceof Types.ObjectId ? u.unitid.toString() : u.unitid;
    return uIdStr === unitIdStr;
  });

  return conversion ? qty * conversion.factor : qty;
}
