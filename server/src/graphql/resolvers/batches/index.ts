import { Types } from "mongoose";
import { BatchMove, BatchStock } from "../../../models/batch";
import { Branch } from "../../../models/branches";
import { ProductService } from "../../../models/products";
import { ProductBranchStock } from "../../../models/productbranchstock";
import { requireBackofficeTenant, TenantError } from "../../../utils/tenant";
import { assertModuleOn } from "../../../utils/modulegate";
import { containsRx } from "../../../utils/listquery";
import { istDate } from "../../../utils/ist";

const s = (v: any) => (v ? String(v) : "");
const ymd = /^\d{4}-\d{2}-\d{2}$/;
const daysTo = (d?: string) => (d ? Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${istDate()}T00:00:00Z`)) / 86400000) : null);

/** Back office of a business with Batch & Expiry on; a branch or staff login sees its own branch. */
const scopeOf = async (context: any) => {
  const scope = await requireBackofficeTenant(context);
  await assertModuleOn("batches", "Batch & Expiry", { adminid: scope.adminid });
  return { ...scope, ownBranch: scope.userType === "admin" ? null : scope.branchid };
};

/** Names for rows: item, variant and branch. */
const named = async (rows: any[]) => {
  const [products, branches]: any[] = await Promise.all([
    ProductService.find({ _id: { $in: [...new Set(rows.map((r) => s(r.productid)))] } }).select("name productvariants._id productvariants.name").lean(),
    Branch.find({ _id: { $in: [...new Set(rows.map((r) => s(r.branchid)))] } }).select("branchname").lean(),
  ]);
  const p = new Map(products.map((x: any) => [s(x._id), x]));
  const b = new Map(branches.map((x: any) => [s(x._id), x.branchname]));
  return (r: any) => {
    const prod: any = p.get(s(r.productid));
    return {
      productname: prod?.name || null,
      variantname: prod?.productvariants?.find((v: any) => s(v._id) === s(r.variantid))?.name || null,
      branchname: b.get(s(r.branchid)) || null,
    };
  };
};
const shape = (r: any, names: (r: any) => any) => ({
  id: s(r._id), branchid: s(r.branchid), productid: s(r.productid), variantid: r.variantid ? s(r.variantid) : null,
  batchno: r.batchno, expirydate: r.expirydate || null, mfgdate: r.mfgdate || null, qty: Number(r.qty || 0), daysleft: daysTo(r.expirydate), ...names(r),
});

export const batchResolvers = {
  Query: {
    getBatches: async (_: any, { filter = {} }: any, context: any) => {
      const sc = await scopeOf(context);
      const q: any = { adminid: sc.adminid };
      const branch = sc.ownBranch || filter.branchid;
      if (branch) q.branchid = branch;
      if (filter.productid) q.productid = filter.productid;
      if (!filter.includeempty) q.qty = { $gt: 0 };
      const today = istDate();
      if (filter.expired) q.expirydate = { $lt: today };
      else if (filter.expiringdays != null) q.expirydate = { $lte: istDate(new Date(Date.now() + Number(filter.expiringdays) * 86400000)) };
      if (filter.search) {
        const ids = (await ProductService.find({ adminid: sc.adminid, name: containsRx(String(filter.search)) }).select("_id").limit(500).lean()).map((x: any) => x._id);
        q.$or = [{ productid: { $in: ids } }, { batchno: containsRx(String(filter.search)) }];
      }
      const rows: any[] = await BatchStock.find(q).sort({ expirydate: 1, batchno: 1 }).limit(2000).lean();
      const names = await named(rows);
      return rows.map((r) => shape(r, names));
    },
    getProductBatches: async (_: any, { productid, variantid, branchid }: any, context: any) => {
      const sc = await scopeOf(context);
      const today = istDate();
      const rows: any[] = await BatchStock.find({ adminid: sc.adminid, branchid: sc.ownBranch || branchid, productid, variantid: variantid || null, qty: { $gt: 0 } }).lean();
      const live = rows.filter((r) => !(r.expirydate && r.expirydate < today))
        .sort((a, b) => (a.expirydate || "9999").localeCompare(b.expirydate || "9999"));
      const names = await named(live);
      return live.map((r) => shape(r, names));
    },
    getUnbatchedStock: async (_: any, { branchid }: any, context: any) => {
      const sc = await scopeOf(context);
      const branch = sc.ownBranch || branchid;
      const stock: any[] = await ProductBranchStock.find({ adminid: sc.adminid, ...(branch ? { branchid: branch } : {}), currentstock: { $gt: 0 } })
        .select("branchid productid variantid currentstock").limit(5000).lean();
      const inBatches: any[] = await BatchStock.aggregate([
        { $match: { adminid: new Types.ObjectId(String(sc.adminid)), ...(branch ? { branchid: new Types.ObjectId(String(branch)) } : {}), qty: { $gt: 0 } } },
        { $group: { _id: { b: "$branchid", p: "$productid", v: "$variantid" }, q: { $sum: "$qty" } } },
      ]);
      const got = new Map(inBatches.map((x) => [`${s(x._id.b)}|${s(x._id.p)}|${s(x._id.v)}`, Number(x.q)]));
      const rows = stock.map((r) => {
        const inb = got.get(`${s(r.branchid)}|${s(r.productid)}|${s(r.variantid)}`) || 0;
        return { ...r, stock: Number(r.currentstock), inbatches: inb, unbatched: Math.round((Number(r.currentstock) - inb) * 10000) / 10000 };
      }).filter((r) => r.unbatched > 0);
      const names = await named(rows);
      return rows.map((r) => ({ branchid: s(r.branchid), productid: s(r.productid), variantid: r.variantid ? s(r.variantid) : null, stock: r.stock, inbatches: r.inbatches, unbatched: r.unbatched, ...names(r) }));
    },
  },
  Mutation: {
    addOpeningBatch: async (_: any, { input }: any, context: any) => {
      const sc = await scopeOf(context);
      const branchid = sc.ownBranch || input.branchid;
      const batchno = String(input.batchno || "").trim();
      const qty = Number(input.qty);
      if (!batchno) throw new TenantError("Enter the batch number.", "BAD_USER_INPUT");
      if (!(qty > 0)) throw new TenantError("Enter the quantity.", "BAD_USER_INPUT");
      for (const d of [input.expirydate, input.mfgdate]) if (d && !ymd.test(d)) throw new TenantError("Dates must be YYYY-MM-DD.", "BAD_USER_INPUT");
      if (!(await ProductService.exists({ _id: input.productid, adminid: sc.adminid }))) throw new TenantError("Item not found.", "NOT_FOUND");
      if (!(await Branch.exists({ _id: branchid, admin: sc.adminid }))) throw new TenantError("Branch not found.", "NOT_FOUND");
      // Only stock already on hand and not yet in a batch can be put into one.
      const row: any = await ProductBranchStock.findOne({ adminid: sc.adminid, branchid, productid: input.productid, variantid: input.variantid || null }).select("currentstock").lean();
      const [inb] = await BatchStock.aggregate([
        { $match: { adminid: new Types.ObjectId(String(sc.adminid)), branchid: new Types.ObjectId(String(branchid)), productid: new Types.ObjectId(String(input.productid)), variantid: input.variantid ? new Types.ObjectId(String(input.variantid)) : null, qty: { $gt: 0 } } },
        { $group: { _id: null, q: { $sum: "$qty" } } },
      ]);
      const free = Number(row?.currentstock || 0) - Number(inb?.q || 0);
      if (qty > free + 1e-9) throw new TenantError(`Only ${Math.max(0, Math.round(free * 10000) / 10000)} of this item is not in a batch yet.`, "BAD_USER_INPUT");
      const key = { adminid: sc.adminid, branchid, productid: input.productid, variantid: input.variantid || null, batchno };
      const set: any = {};
      if (input.expirydate) set.expirydate = input.expirydate;
      if (input.mfgdate) set.mfgdate = input.mfgdate;
      await BatchStock.updateOne(key, { $inc: { qty }, ...(Object.keys(set).length ? { $set: set } : {}) }, { upsert: true });
      await BatchMove.create({ ...key, qty, docmodel: "Opening", docid: new Types.ObjectId(), docno: "Opening" });
      const b: any = await BatchStock.findOne(key).lean();
      return shape(b, await named([b]));
    },
    editBatch: async (_: any, { id, expirydate, mfgdate }: any, context: any) => {
      const sc = await scopeOf(context);
      for (const d of [expirydate, mfgdate]) if (d && !ymd.test(d)) throw new TenantError("Dates must be YYYY-MM-DD.", "BAD_USER_INPUT");
      const b: any = await BatchStock.findOne({ _id: id, adminid: sc.adminid, ...(sc.ownBranch ? { branchid: sc.ownBranch } : {}) }).lean();
      if (!b) throw new TenantError("Batch not found.", "NOT_FOUND");
      const set: any = {};
      if (expirydate !== undefined) set.expirydate = expirydate || null;
      if (mfgdate !== undefined) set.mfgdate = mfgdate || null;
      await BatchStock.updateOne({ _id: b._id }, { $set: set });
      const fresh: any = await BatchStock.findById(b._id).lean();
      return shape(fresh, await named([fresh]));
    },
  },
};
