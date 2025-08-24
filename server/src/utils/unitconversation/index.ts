import { Types } from "mongoose";
import { IProductVariant } from "../../models/products";

/**
 * Convert a quantity from a given unit (sales or purchase) to the variant's base unit
 * @param qty - quantity in the selected unit
 * @param unitId - selected unit (salesunitid or purchaseunitid)
 * @param variant - product variant object with unitConversions
 * @returns quantity in base unit
 */

export function convertToBaseUnit(
  qty: number,
  unitId?: Types.ObjectId,
  variant?: IProductVariant
): number {
  // No variant or missing IDs → return qty directly
  if (!variant || !unitId || !variant.baseunitid) return qty;

  // If no conversions, assume same unit (factor = 1)
  if (!variant.unitConversions || variant.unitConversions.length === 0) {
    return qty;
  }

  // Try finding a valid conversion
  const conversion = variant.unitConversions.find(
    (u) =>
      u?.fromunitid?.toString() === unitId.toString() &&
      u?.tounitid?.toString() === variant.baseunitid?.toString()
  );

  return conversion ? qty * conversion.factor : qty; // Default = no change
}
