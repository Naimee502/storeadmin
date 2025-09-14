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

  const rate = getPurchaseRate(variant, overrideRate);

  if (!stock) {
    if (!allowCreate) return null;

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

  // Always recalc amounts and closing stock
  stock.currentstockamount = stock.currentstock * rate;
  stock.closingstock = stock.currentstock;
  stock.closingstockamount = stock.currentstock * rate;
  stock.averagecost = rate;

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

