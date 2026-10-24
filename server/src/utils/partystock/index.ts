import mongoose from "mongoose";
import { PartyStock } from "../../models/partystock";
import { ProductService } from "../../models/products";
import { Account } from "../../models/accounts";
import { AdminSettings } from "../../models/adminsettings";
import { convertToBaseUnit } from "../unitconversation";

/**
 * Party stock (party under party). Off unless the business has BOTH
 * "Party manages downline" and "Track party stock" on — every other business
 * keeps exactly the old behaviour (only the company's branch stock moves).
 */
export const partyStockEnabled = async (adminid: any): Promise<boolean> => {
  if (!adminid) return false;
  const st: any = await AdminSettings.findOne({ adminid })
    .select("partyManagesDownline trackPartyStock").lean();
  return !!(st?.partyManagesDownline && st?.trackPartyStock);
};

/** Who sells to this party: its parent party, or null = the company. */
export const sellerPartyOf = async (buyerId: any): Promise<string | null> => {
  if (!buyerId) return null;
  const acc: any = await Account.findById(buyerId).select("assignaccountid").lean();
  return acc?.assignaccountid ? String(acc.assignaccountid) : null;
};

const oid = (v: any) => (v ? new mongoose.Types.ObjectId(String(v)) : null);
const key = (p: any, v: any) => `${String(p || "")}:${String(v || "")}`;

/** Invoice lines summed per product+variant, in base units. */
export const invoiceBaseLines = async (productservice: any[]) => {
  const out = new Map<string, { productid: any; variantid: any; qty: number; name: string }>();
  for (const item of productservice || []) {
    if (!item?.productserviceid) continue;
    const product: any = await ProductService.findById(item.productserviceid).select("name productvariants").lean();
    if (!product) continue;
    const variant = product.productvariants?.find((v: any) => String(v._id) === String(item.variantid));
    const qty = convertToBaseUnit(Number(item.qty || 0) * Number(item.unitqty || 1), item.salesunitid, variant);
    const k = key(item.productserviceid, item.variantid);
    const prev = out.get(k);
    out.set(k, {
      productid: item.productserviceid,
      variantid: item.variantid || null,
      qty: (prev?.qty || 0) + qty,
      name: `${product.name}${variant?.name ? ` - ${variant.name}` : ""}`,
    });
  }
  return [...out.values()];
};

const addQty = async (adminid: any, partyid: any, productid: any, variantid: any, delta: number) => {
  if (!delta) return;
  await PartyStock.updateOne(
    { partyid: oid(partyid), productid: oid(productid), variantid: oid(variantid) },
    { $inc: { qty: delta }, $setOnInsert: { adminid: oid(adminid) } },
    { upsert: true }
  );
};

/**
 * One invoice's effect on party stock: buyer +qty, seller party −qty (when the
 * seller is a parent party; the company's side is ProductBranchStock).
 * sign = +1 applies it, −1 reverses it.
 */
export const applyInvoiceToPartyStock = async (opts: {
  adminid: any;
  buyerId: any;
  sellerId: string | null;
  productservice: any[];
  sign: 1 | -1;
}) => {
  const lines = await invoiceBaseLines(opts.productservice);
  for (const l of lines) {
    await addQty(opts.adminid, opts.buyerId, l.productid, l.variantid, opts.sign * l.qty);
    if (opts.sellerId) await addQty(opts.adminid, opts.sellerId, l.productid, l.variantid, -opts.sign * l.qty);
  }
};

/**
 * A parent party can only invoice what it holds (unless the business allows
 * negative stock). On an edit, what the old version took is credited back first.
 */
export const assertPartyStockAvailable = async (opts: {
  sellerId: string;
  productservice: any[];
  oldProductservice?: any[];
}) => {
  const need = await invoiceBaseLines(opts.productservice);
  const back = new Map<string, number>();
  for (const l of await invoiceBaseLines(opts.oldProductservice || [])) back.set(key(l.productid, l.variantid), l.qty);
  const short: string[] = [];
  for (const l of need) {
    const row: any = await PartyStock.findOne({
      partyid: oid(opts.sellerId), productid: oid(l.productid), variantid: oid(l.variantid),
    }).lean();
    const have = Number(row?.qty || 0) + (back.get(key(l.productid, l.variantid)) || 0);
    if (have < l.qty) short.push(`${l.name} — required ${l.qty}, available ${have}`);
  }
  if (short.length) {
    const seller: any = await Account.findById(opts.sellerId).select("name").lean();
    throw new Error(`Not enough stock with ${seller?.name || "the parent party"}: ${short.join("; ")}`);
  }
};
