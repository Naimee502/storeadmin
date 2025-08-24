import { Types } from "mongoose";
import { IProductVariant } from "../../models/products";
import { ProductBranchStock } from "../../models/productbranchstock";
import { Branch } from "../../models/branches";
import { convertToBaseUnit } from "../unitconversation";

export type StockAction = "CREATE_PRODUCT" | "PURCHASE" | "SALE" | "TRANSFER" | "ADJUSTMENT";

interface StockManagerParams {
  productId: Types.ObjectId;
  branchId: Types.ObjectId;
  variant: IProductVariant;
  qty: number;
  unitId?: Types.ObjectId;
  rate?: number;
  action: StockAction;
  toBranchId?: Types.ObjectId;
  allowCreate?: boolean; // new flag to prevent creating new stock during updates
}

export async function manageStock(params: StockManagerParams) {
  const { 
    productId, 
    branchId, 
    variant, 
    qty, 
    unitId, 
    rate = variant.purchaserate || 0, 
    action, 
    toBranchId, 
    allowCreate = true 
  } = params;

  const qtyInBase = convertToBaseUnit(qty, unitId, variant);
  const variantId = variant._id || new Types.ObjectId();

  async function updateBranch(branch: Types.ObjectId, qtyDelta: number) {
    const stock = await ProductBranchStock.findOne({ productid: productId, variantid: variantId, branchid: branch });

    if (!stock) {
      if (!allowCreate) return; // ⚡ prevent creating new stock during product update

      // Create stock only if allowed
      await ProductBranchStock.create({
        productid: productId,
        variantid: variantId,
        branchid: branch,
        openingstock: qtyDelta > 0 ? qtyDelta : 0,
        openingstockamount: qtyDelta > 0 ? qtyDelta * rate : 0,
        currentstock: qtyDelta > 0 ? qtyDelta : 0,
        currentstockamount: qtyDelta > 0 ? qtyDelta * rate : 0,
        closingstock: qtyDelta > 0 ? qtyDelta : 0,
        closingstockamount: qtyDelta > 0 ? qtyDelta * rate : 0,
        minimumstock: variant.minimumstock || 0,
        reorderlevel: variant.reorderlevel || 0,
        averagecost: qtyDelta > 0 ? rate : 0,
      });
      return;
    }

    const newStock = stock.currentstock + qtyDelta;
    const newAmount = stock.currentstockamount + qtyDelta * rate;
    const avgCost = action === "PURCHASE" && newStock > 0 ? newAmount / newStock : stock.averagecost || rate;

    Object.assign(stock, {
      currentstock: newStock,
      currentstockamount: newAmount,
      closingstock: newStock,
      closingstockamount: newAmount,
      averagecost: avgCost,
    });

    await stock.save();
  }

  switch (action) {
    case "CREATE_PRODUCT":
      const branches = await Branch.find({}, "_id");
      await Promise.all(
        branches.map(b =>
          updateBranch(b._id, b._id.equals(branchId) ? qtyInBase : 0)
        )
      );
      break;

    case "PURCHASE":
    case "ADJUSTMENT":
      await updateBranch(branchId, qtyInBase);
      break;

    case "SALE":
      await updateBranch(branchId, -qtyInBase);
      break;

    case "TRANSFER":
      if (!toBranchId) throw new Error("toBranchId required for TRANSFER");
      await updateBranch(branchId, -qtyInBase);
      await updateBranch(toBranchId, qtyInBase);
      break;
  }
}

export async function getAvailableStock(
  productId: Types.ObjectId,
  adminId?: Types.ObjectId,
  branchId?: Types.ObjectId,
  variantId?: Types.ObjectId
): Promise<number> {
  if (!productId) return 0;

  const match: any = { productid: productId };

  // 🔹 Branch-level priority
  if (branchId) {
    match.branchid = branchId;
  } else if (adminId) {
    // 🔹 Fallback to admin-level
    match.adminid = adminId;
  }

  if (variantId) {
    match.variantid = variantId;
  }

  const result = await ProductBranchStock.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalStock: { $sum: "$currentstock" },
      },
    },
  ]);

  return result[0]?.totalStock || 0;
}

