import { Types } from "mongoose";
import { IProductVariant } from "../../models/products";
import { ProductBranchStock } from "../../models/productbranchstock";
import { Branch } from "../../models/branches";
import { convertToBaseUnit } from "../unitconversation";

export type StockAction = "CREATE_PRODUCT" | "PURCHASE" | "SALE" | "TRANSFER" | "ADJUSTMENT" | "SET";

interface StockManagerParams {
  productId: Types.ObjectId;
  branchId: Types.ObjectId;
  variant: IProductVariant;
  qty: number;
  unitId?: Types.ObjectId;
  regionId?: Types.ObjectId; // Optional region to pick pricing
  channel?: string; // Optional channel to pick pricing
  rate?: number; // If passed, overrides pricing
  action: StockAction;
  toBranchId?: Types.ObjectId;
  allowCreate?: boolean;
}

// 🔹 Helper to get purchaserate from pricing structure
function getPurchaseRate(
  variant: IProductVariant,
  unitId?: Types.ObjectId,
  regionId?: Types.ObjectId,
  channel?: string
): number {
  if (!variant.pricing || !variant.pricing.length) return 0;

  let pricingEntry = variant.pricing[0];

  if (channel) {
    pricingEntry =
      variant.pricing.find(
        (p) => p.channel === channel
      ) || pricingEntry;
  }

  if (!pricingEntry || !pricingEntry.unitprices.length) return 0;

  // Convert unitId to ObjectId for comparison
  const unitObjId = unitId instanceof Types.ObjectId ? unitId : new Types.ObjectId(unitId);

  const unitPrice = pricingEntry.unitprices.find(
    (u) => u.unitid instanceof Types.ObjectId
      ? u.unitid.equals(unitObjId)
      : u.unitid === unitObjId.toString()
  );

  return unitPrice?.purchaserate ?? 0;
}

export async function manageStock(params: StockManagerParams & { action: StockAction | "SET" }) {
  const { productId, branchId, variant, qty, unitId, action, allowCreate = true } = params;

  if (!variant._id) throw new Error("Variant _id required");

  const rate = getPurchaseRate(variant, unitId);
  const qtyInBase = convertToBaseUnit(qty, unitId, variant);
  const variantId = variant._id;

  console.log("🔎 Stock check", {
    product: productId.toString(),
    variant: variantId.toString(),
    branch: branchId.toString(),
    action,
    qty,
    qtyInBase,
    rate,
  });

  let stock = await ProductBranchStock.findOne({
    productid: productId,
    variantid: variantId,
    branchid: branchId,
  });

  if (!stock) {
    console.log(`❌ No stock found for branch=${branchId}, variant=${variantId}`);
    if (!allowCreate) {
      console.log("🚫 allowCreate=false → skipping");
      return;
    }

    console.log(`➕ Creating stock row: qty=${qtyInBase}, rate=${rate}`);
    stock = await ProductBranchStock.create({
      productid: productId,
      variantid: variantId,
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
    console.log(`✅ Created stock _id=${stock._id}`);
    return stock;
  }

  if (action === "SET") {
    console.log(
      `♻️ Updating stock (branch=${branchId}, variant=${variantId}) current=${stock.currentstock} → new=${qtyInBase}`
    );

    stock.currentstock = qtyInBase;
    stock.currentstockamount = qtyInBase * rate;
    stock.closingstock = qtyInBase;
    stock.closingstockamount = qtyInBase * rate;
    stock.averagecost = rate;

    await stock.save();
    console.log(`✅ Stock updated for variant=${variantId}, branch=${branchId}`);
    return stock;
  }

  console.log("⚠️ Unknown action, nothing applied");
  return stock;
}

export async function getAvailableStock(
  productId: Types.ObjectId,
  adminId?: Types.ObjectId, // optional, but don’t use if not in schema
  branchId?: Types.ObjectId,
  variantId?: Types.ObjectId
): Promise<number> {
  if (!productId) {
    console.log("❌ No productId provided");
    return 0;
  }

  const match: any = { productid: productId };

  if (branchId) {
    match.branchid = branchId;
  }

  if (variantId) {
    match.variantid = variantId;
  }

  // ⚠️ Only filter by adminId if ProductBranchStock schema doesn’t store adminid directly
  if (adminId && !branchId) {
    const branches = await Branch.find({ adminid: adminId }, "_id").lean();
    const branchIds = branches.map((b) => b._id);
    match.branchid = { $in: branchIds };
  }

  console.log("📝 Final match query:", JSON.stringify(match));
  const stocks = await ProductBranchStock.find(match, "currentstock").lean();

  const totalStock = stocks.reduce((sum, s) => sum + (s.currentstock || 0), 0);
  console.log("✅ Calculated total stock:", totalStock);

  return totalStock;
}

