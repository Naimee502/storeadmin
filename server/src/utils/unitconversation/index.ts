import { Types } from "mongoose";
import { IProductVariant } from "../../models/products";

export function convertToBaseUnit(
  qty: number,
  unitId?: Types.ObjectId | string,
  variant?: IProductVariant
): number {
  if (!variant || !unitId || !variant.baseunitid) {
    return qty;
  }

  // Normalize unitId to string for safe comparison
  const unitIdStr = unitId instanceof Types.ObjectId ? unitId.toString() : unitId;
  const baseUnitIdStr = variant.baseunitid instanceof Types.ObjectId ? variant.baseunitid.toString() : variant.baseunitid;

  if (!variant.unitconversions || variant.unitconversions.length === 0) {
    return qty;
  }

  const conversion = variant.unitconversions.find((u) => {
    if (!u.unitid) return false;
    const uIdStr = u.unitid instanceof Types.ObjectId ? u.unitid.toString() : u.unitid;
    return uIdStr === unitIdStr;
  });

  if (conversion) {
    const convertedQty = qty * conversion.factor;
    return convertedQty;
  } else {
    return qty;
  }
}
