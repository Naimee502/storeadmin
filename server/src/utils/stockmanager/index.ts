import { Types } from "mongoose";
import { IProductVariant } from "../../models/products";
import { ProductBranchStock } from "../../models/productbranchstock";
import { convertToBaseUnit } from "../unitconversation";

export type StockAction = "SET" | "PURCHASE" | "SALE" | "TRANSFER_IN" | "TRANSFER_OUT" | "ADJUST";

interface StockManagerParams {
  adminId: Types.ObjectId;
  productId: Types.ObjectId;
  branchId: Types.ObjectId;
  variant: IProductVariant;
  qty: number;
  unitId?: Types.ObjectId;
  action: StockAction;
  allowCreate?: boolean;
  rate?: number;
  /** The given `rate` is already per BASE unit (stock adjustments enter qty in
   *  base units), so it must not be divided by the purchase-unit factor again. */
  rateIsBase?: boolean;
}

function getPurchaseRate(variant: IProductVariant, overrideRate?: number): number {
  let rate = overrideRate ?? variant.purchaserate ?? 0;

  const purchaseUnitId = variant.purchaseunitid?.toString();
  const baseUnitId = variant.baseunitid?.toString();

  if (purchaseUnitId && baseUnitId && variant.unitconversions?.length) {
    const purchaseConversion = variant.unitconversions.find(
      (u) => u.unitid?.toString() === purchaseUnitId
    );
    if (purchaseConversion && purchaseConversion.factor > 0) {
      rate = rate / purchaseConversion.factor;
    }
  }
  return rate;
}

export async function manageStock(params: StockManagerParams): Promise<any> {
  const {
    adminId,
    productId,
    branchId,
    variant,
    qty,
    unitId,
    action,
    allowCreate = true,
    rate: overrideRate,
    rateIsBase = false,
  } = params;

  if (!variant._id) throw new Error("Variant _id required");

  // Find stock record scoped by admin & branch
  let stock = await ProductBranchStock.findOne({
    adminid: adminId,
    productid: productId,
    variantid: variant._id,
    branchid: branchId,
  });

  // Normalize quantity to base unit
  const qtyInBase = convertToBaseUnit(qty, unitId, variant);

  const rate =
    rateIsBase && overrideRate != null ? Number(overrideRate) || 0 : getPurchaseRate(variant, overrideRate);

  // TRANSFER_IN / TRANSFER_OUT are used only by Stock Adjustments (Excess /
  // Shortage). They move stock by a quantity and value it like a perpetual
  // inventory: incoming at its rate (weighted average), outgoing at the
  // CURRENT average cost — instead of re-valuing the whole stock at the
  // voucher's rate (a ₹0 / typo rate used to wipe the stock value).
  const isMovement = action === "TRANSFER_IN" || action === "TRANSFER_OUT";

  if (!stock) {
    if (!allowCreate) return null;

    if (isMovement) {
      // No row yet: a decrease must create NEGATIVE stock, not +qty, and an
      // adjustment is not opening stock.
      const q = action === "TRANSFER_OUT" ? -qtyInBase : qtyInBase;
      stock = await ProductBranchStock.create({
        adminid: adminId,
        productid: productId,
        variantid: variant._id,
        branchid: branchId,
        openingstock: 0,
        openingstockamount: 0,
        currentstock: q,
        currentstockamount: q * rate,
        closingstock: q,
        closingstockamount: q * rate,
        minimumstock: variant.minimumstock || 0,
        reorderlevel: variant.reorderlevel || 0,
        averagecost: rate,
      });
      return stock;
    }

    stock = await ProductBranchStock.create({
      adminid: adminId,
      productid: productId,
      variantid: variant._id,
      branchid: branchId,
      openingstock: qtyInBase,
      openingstockamount: qtyInBase * rate,
      currentstock: qtyInBase,
      currentstockamount: qtyInBase * rate,
      closingstock: qtyInBase,
      closingstockamount: qtyInBase * rate,
      minimumstock: variant.minimumstock || 0,
      reorderlevel: variant.reorderlevel || 0,
      averagecost: rate,
    });
    return stock;
  }

  // --- Update stock based on action ---
  switch (action) {
    case "SET":      // overwrite stock
    case "ADJUST":   // manual adjustment
      stock.currentstock = qtyInBase;
      break;

    case "PURCHASE":     // incoming purchase
    case "TRANSFER_IN":  // stock received from another branch
      stock.currentstock += qtyInBase;
      break;

    case "SALE":         // outgoing sale
    case "TRANSFER_OUT": // stock sent to another branch
      stock.currentstock -= qtyInBase;
      break;

    default:
      throw new Error(`Unknown stock action: ${action}`);
  }

  if (isMovement) {
    const prevAvg = Number(stock.averagecost) > 0 ? Number(stock.averagecost) : rate;
    let amt = Number(stock.currentstockamount) || 0;
    if (action === "TRANSFER_IN") amt += qtyInBase * rate;
    else amt -= qtyInBase * prevAvg;
    // Nothing (or less than nothing) left on hand: value what remains at the
    // last average so a zero/negative quantity never carries a stray amount.
    if (stock.currentstock <= 0) amt = stock.currentstock * prevAvg;
    amt = Math.round(amt * 100) / 100;
    stock.currentstockamount = amt;
    stock.closingstock = stock.currentstock;
    stock.closingstockamount = amt;
    stock.averagecost = stock.currentstock > 0 ? amt / stock.currentstock : prevAvg;
  } else {
    // Always recalc amounts and closing stock
    stock.currentstockamount = stock.currentstock * rate;
    stock.closingstock = stock.currentstock;
    stock.closingstockamount = stock.currentstock * rate;
    stock.averagecost = rate;
  }

  await stock.save();
  return stock;
}

export async function getStockDetails(
  productId: Types.ObjectId,
  adminId?: Types.ObjectId,
  branchId?: Types.ObjectId,
  variantId?: Types.ObjectId
): Promise<{
  openingstock: number;
  closingstock: number;
  currentstock: number;
  openingstockamount: number;
  currentstockamount: number;
  closingstockamount: number;
}> {
  if (!productId) {
    return {
      openingstock: 0,
      closingstock: 0,
      currentstock: 0,
      openingstockamount: 0,
      currentstockamount: 0,
      closingstockamount: 0,
    };
  }

  const match: any = { productid: productId };
  if (adminId) match.adminid = adminId;
  if (branchId) match.branchid = branchId;
  if (variantId) match.variantid = variantId;

  const result = await ProductBranchStock.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        openingstock: { $sum: "$openingstock" },
        closingstock: { $sum: "$closingstock" },
        currentstock: { $sum: "$currentstock" },
        openingstockamount: { $sum: "$openingstockamount" },
        currentstockamount: { $sum: "$currentstockamount" },
        closingstockamount: { $sum: "$closingstockamount" },
      },
    },
  ]);

  return {
    openingstock: result[0]?.openingstock || 0,
    closingstock: result[0]?.closingstock || 0,
    currentstock: result[0]?.currentstock || 0,
    openingstockamount: result[0]?.openingstockamount || 0,
    currentstockamount: result[0]?.currentstockamount || 0,
    closingstockamount: result[0]?.closingstockamount || 0,
  };
}

