import mongoose from "mongoose";
import { ProductService } from "../../models/products";
import { ProductBranchStock } from "../../models/productbranchstock";
import { convertToBaseUnit } from "../unitconversation";

/**
 * Sales-side stock guard.
 *
 * The admin panel's Add Products box validates quantity against available
 * stock, but that check only runs when a line is typed in by hand. Lines that
 * arrive pre-filled — Convert to Invoice from a Sales Order punched on the app
 * or the website, where the catalogue only gates on "in stock / out of stock"
 * and never on the actual number — bypass it completely, and the stock hook in
 * models/salesinvoice then happily drives `currentstock` negative.
 *
 * So the real guard lives here, on the server, and every path that writes a
 * Sales Invoice goes through it before the document is created/updated.
 */

export interface StockShortfall {
  productname: string;
  variantname?: string | null;
  required: number;
  available: number;
}

export class InsufficientStockError extends Error {
  shortfalls: StockShortfall[];
  constructor(shortfalls: StockShortfall[]) {
    super(
      "Not enough stock: " +
        shortfalls
          .map(
            (s) =>
              `${s.productname}${s.variantname ? ` - ${s.variantname}` : ""} — ` +
              `required ${s.required}, available ${s.available} (base units)`
          )
          .join("; ")
    );
    this.name = "InsufficientStockError";
    this.shortfalls = shortfalls;
  }
}

const key = (productid: any, variantid: any) =>
  `${String(productid || "")}:${String(variantid || "")}`;

// Same arithmetic the stock hook in models/salesinvoice uses to deduct, so the
// guard can never disagree with what actually gets written.
const lineBaseQty = (item: any, variant: any) =>
  convertToBaseUnit(
    Number(item.qty || 0) * Number(item.unitqty || 1),
    item.salesunitid,
    variant
  );

/**
 * Throws InsufficientStockError when the invoice would push any line's branch
 * stock below zero. Lines of the same variant are summed, and — on an edit —
 * the quantity the old version of the invoice had reserved is credited back
 * first, because the stock hook restores it before deducting the new one.
 */
export async function assertSalesStockAvailable(opts: {
  adminid?: any;
  branchid: any;
  productservice: any[];
  isservice?: boolean;
  /** The invoice's own previous version, on edit. */
  oldInv?: any;
  /** Skip when stock auto-posting is off — nothing is deducted then. */
  wantsStock?: boolean;
}): Promise<void> {
  const { branchid, productservice, isservice, oldInv } = opts;
  if (opts.wantsStock === false) return;
  if (isservice) return;
  if (!branchid || !Array.isArray(productservice) || productservice.length === 0) return;

  const branchId =
    typeof branchid === "string" ? new mongoose.Types.ObjectId(branchid) : branchid;

  // Cache products so a 20-line invoice of one product is one lookup.
  const productCache = new Map<string, any>();
  const getProduct = async (id: any) => {
    const k = String(id || "");
    if (!k) return null;
    if (!productCache.has(k)) productCache.set(k, await ProductService.findById(k));
    return productCache.get(k);
  };

  // Net requirement per variant: new lines − what this invoice already held.
  const required = new Map<
    string,
    { productid: any; variantid: any; qty: number; product: any; variant: any }
  >();

  for (const item of productservice) {
    const product = await getProduct(item.productserviceid);
    if (!product) continue;
    const variant = product.productvariants?.find(
      (v: any) => String(v._id) === String(item.variantid)
    );
    const k = key(item.productserviceid, item.variantid);
    const prev = required.get(k);
    const qty = lineBaseQty(item, variant);
    if (prev) prev.qty += qty;
    else
      required.set(k, {
        productid: item.productserviceid,
        variantid: item.variantid,
        qty,
        product,
        variant,
      });
  }

  if (oldInv && !oldInv.isservice) {
    for (const item of oldInv.productservice || []) {
      const k = key(item.productserviceid, item.variantid);
      const entry = required.get(k);
      if (!entry) continue;
      const product = await getProduct(item.productserviceid);
      const variant = product?.productvariants?.find(
        (v: any) => String(v._id) === String(item.variantid)
      );
      entry.qty -= lineBaseQty(item, variant);
    }
  }

  const shortfalls: StockShortfall[] = [];

  for (const entry of required.values()) {
    if (entry.qty <= 0) continue;
    const stock: any = await ProductBranchStock.findOne({
      productid: entry.productid,
      variantid: entry.variantid,
      branchid: branchId,
    });
    const available = Number(stock?.currentstock ?? 0);
    if (entry.qty > available) {
      shortfalls.push({
        productname: entry.product?.name || "Unknown product",
        variantname: entry.variant?.name || null,
        required: parseFloat(entry.qty.toFixed(2)),
        available: parseFloat(available.toFixed(2)),
      });
    }
  }

  if (shortfalls.length) throw new InsufficientStockError(shortfalls);
}
