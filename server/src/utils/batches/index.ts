import cron from "node-cron";
import mongoose, { Types } from "mongoose";
import { Admin } from "../../models/admin";
import { AdminSettings } from "../../models/adminsettings";
import { BatchMove, BatchStock } from "../../models/batch";
import { StockMove } from "../../models/stockmove";
import { ProductService } from "../../models/products";
import { pushNotification } from "../../models/notifications";
import { convertToBaseUnit } from "../unitconversation";
import { istDate } from "../ist";
import { TenantError } from "../tenant";

const oid = (v: any) => (v && typeof v === "object" && !(v instanceof Types.ObjectId) ? v._id || v.id : v);
const s = (v: any) => (v ? String(v) : "");
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const keyOf = (b: any, p: any, v: any, batch = "") => `${s(b)}|${s(p)}|${s(v)}|${batch}`;

/** Batch & Expiry is opt-in: on only when the business has ticked the module. */
export const batchesOn = async (adminid: any) => {
  const a: any = await Admin.findById(oid(adminid)).select("allowedmodules").lean();
  return Array.isArray(a?.allowedmodules) && a.allowedmodules.some((m: string) => String(m).toLowerCase() === "batches");
};

// Documents whose lines may name a batch, and the unit field of their lines.
const LINE_UNIT: Record<string, string> = {
  SalesInvoice: "salesunitid", SalesReturn: "salesunitid", PurchaseInvoice: "purchaseunitid", PurchaseReturn: "purchaseunitid",
};
const SOURCE: Record<string, string> = { SalesReturn: "SalesInvoice", PurchaseReturn: "PurchaseInvoice" };

/** Batch lines of a document in base units, per item. */
const explicitLines = async (docmodel: string, doc: any) => {
  const unit = LINE_UNIT[docmodel];
  const out: any[] = [];
  if (!unit) return out;
  for (const [i, l] of (doc?.productservice || []).entries()) {
    const batchno = String(l.batchno || "").trim();
    if (!batchno || l.batchauto) continue;
    const p: any = await ProductService.findById(l.productserviceid).select("productvariants").lean();
    const variant = p?.productvariants?.find((x: any) => s(x._id) === s(l.variantid));
    out.push({
      i, productid: s(l.productserviceid), variantid: s(l.variantid), batchno, expirydate: l.expirydate || undefined, mfgdate: l.mfgdate || undefined,
      qty: convertToBaseUnit(Number(l.qty || 0) * Number(l.unitqty || 1), l[unit], variant),
    });
  }
  return out;
};

/** Earliest expiry first; expired and empty batches are skipped. */
const fefo = async (adminid: any, branchid: any, productid: any, variantid: any, usedNow: Record<string, number>, ownBefore: Record<string, number>) => {
  const today = istDate();
  const rows: any[] = await BatchStock.find({ adminid, branchid, productid, variantid: variantid || null }).lean();
  return rows
    .map((b) => ({ ...b, avail: Number(b.qty || 0) - Number(ownBefore[b.batchno] || 0) - Number(usedNow[b.batchno] || 0) }))
    .filter((b) => b.avail > 0 && !(b.expirydate && b.expirydate < today))
    .sort((a, b) => (a.expirydate || "9999").localeCompare(b.expirydate || "9999") || +new Date(a.createdAt) - +new Date(b.createdAt));
};

/**
 * Bring a document's batch moves in line with the stock it moved now (from the stock ledger).
 * Out: the batches its lines name, then earliest expiry first. In: named batches, a transfer's
 * own source batches, or a return's source batches; anything else stays unbatched.
 */
export const syncBatches = async (docmodel: string, docid: any) => {
  try {
    if (!docid || !Types.ObjectId.isValid(String(docid))) return;
    const id = new Types.ObjectId(String(docid));
    let Model: any = null;
    try { Model = mongoose.model(docmodel); } catch { return; }
    const doc: any = await Model.findById(id).lean();
    const adminid = doc?.adminid || doc?.admin;
    if (!adminid || !(await batchesOn(adminid))) return;

    const net: any[] = await StockMove.aggregate([
      { $match: { docid: id } },
      { $group: { _id: { b: "$branchid", p: "$productid", v: "$variantid" }, qty: { $sum: "$qty" } } },
    ]);
    const have: Record<string, number> = {};
    for (const m of await BatchMove.find({ docid: id }).lean() as any[]) {
      const k = keyOf(m.branchid, m.productid, m.variantid, m.batchno);
      have[k] = (have[k] || 0) + Number(m.qty);
    }
    const explicit = await explicitLines(docmodel, doc);
    const want: Record<string, number> = {};
    const info: Record<string, any> = {};
    const add = (b: any, p: any, v: any, batch: string, q: number, extra?: any) => {
      const k = keyOf(b, p, v, batch);
      want[k] = r4((want[k] || 0) + q);
      const known = Object.fromEntries(Object.entries(extra || {}).filter(([, x]) => x));
      info[k] = { branchid: b, productid: p, variantid: v || null, batchno: batch, ...(info[k] || {}), ...known };
    };
    const groups = net.filter((g) => Math.abs(Number(g.qty)) > 1e-9)
      .sort((a, b) => Number(a.qty) - Number(b.qty)); // out first, so a transfer's in side can mirror it
    const auto: Record<string, string[]> = {};
    for (const g of groups) {
      const b = g._id.b, p = s(g._id.p), v = s(g._id.v);
      if (!b) continue;
      const mine = explicit.filter((e) => e.productid === p && e.variantid === v);
      let left = Math.abs(Number(g.qty));
      const sign = Number(g.qty) > 0 ? 1 : -1;
      const used: Record<string, number> = {};
      for (const e of mine) {
        const q = Math.min(e.qty, left);
        if (q <= 0) continue;
        add(b, p, v, e.batchno, sign * q, { expirydate: e.expirydate, mfgdate: e.mfgdate });
        used[e.batchno] = (used[e.batchno] || 0) + q;
        left -= q;
      }
      if (left <= 1e-9) continue;
      // Batches this document named for the other side (transfer), or its source document's batches (return).
      let pool: { batchno: string; qty: number; expirydate?: string; mfgdate?: string }[] = [];
      if (sign > 0 && docmodel === "TransferStock") {
        pool = Object.entries(want).filter(([k, q]) => q < 0 && k.split("|")[1] === p && k.split("|")[2] === v)
          .map(([k, q]) => ({ batchno: k.split("|")[3], qty: -q, expirydate: info[k]?.expirydate, mfgdate: info[k]?.mfgdate }));
      } else if (SOURCE[docmodel] && doc?.sourceInvoiceId) {
        const src: any[] = await BatchMove.aggregate([
          { $match: { docid: new Types.ObjectId(String(doc.sourceInvoiceId)), productid: new Types.ObjectId(p), variantid: v ? new Types.ObjectId(v) : null } },
          { $group: { _id: "$batchno", qty: { $sum: "$qty" } } },
        ]);
        pool = src.map((x) => ({ batchno: x._id, qty: Math.abs(Number(x.qty)) })).filter((x) => x.qty > 0);
      }
      for (const x of pool) {
        const q = Math.min(x.qty, left);
        if (q <= 0) continue;
        add(b, p, v, x.batchno, sign * q, { expirydate: x.expirydate, mfgdate: x.mfgdate });
        used[x.batchno] = (used[x.batchno] || 0) + q;
        left -= q;
      }
      if (left <= 1e-9 || sign > 0) continue;
      // Out with nothing named: earliest expiry first from what is on the shelf.
      const own: Record<string, number> = {};
      Object.entries(have).forEach(([k, q]) => { const [kb, kp, kv, kbatch] = k.split("|"); if (kb === s(b) && kp === p && kv === v) own[kbatch] = q; });
      for (const bs of await fefo(adminid, b, p, v || null, used, own)) {
        const q = Math.min(bs.avail, left);
        add(b, p, v, bs.batchno, -q, { expirydate: bs.expirydate, mfgdate: bs.mfgdate });
        (auto[`${p}|${v}`] ||= []).push(bs.batchno);
        left -= q;
        if (left <= 1e-9) break;
      }
    }

    // Write the difference.
    const docno = doc?.billnumber || doc?.transferno || doc?.adjustmentno || undefined;
    for (const k of new Set([...Object.keys(want), ...Object.keys(have)])) {
      const delta = r4((want[k] || 0) - (have[k] || 0));
      const [kb, kp, kv, kbatch] = k.split("|");
      const meta = info[k] || { branchid: kb, productid: kp, variantid: kv || null, batchno: kbatch };
      if (Math.abs(delta) > 1e-9) {
        await BatchMove.create({ adminid, branchid: kb, productid: kp, variantid: kv || null, batchno: kbatch, qty: delta, docmodel, docid: id, docno });
      }
      const set: any = {};
      if (meta.expirydate) set.expirydate = meta.expirydate;
      if (meta.mfgdate) set.mfgdate = meta.mfgdate;
      if (Math.abs(delta) > 1e-9 || Object.keys(set).length) {
        await BatchStock.updateOne(
          { adminid, branchid: kb, productid: kp, variantid: kv || null, batchno: kbatch },
          { $inc: { qty: delta }, ...(Object.keys(set).length ? { $set: set } : {}) },
          { upsert: true }
        );
      }
    }

    // Lines that named no batch show the batches picked for them.
    if (LINE_UNIT[docmodel] && Object.keys(auto).length) {
      const patch: any = {};
      for (const [i, l] of (doc.productservice || []).entries()) {
        if (String(l.batchno || "").trim() && !l.batchauto) continue;
        const list = auto[`${s(l.productserviceid)}|${s(l.variantid)}`];
        if (!list?.length) continue;
        const uniq = [...new Set(list)];
        const exp = (await BatchStock.find({ adminid, productid: l.productserviceid, variantid: l.variantid || null, batchno: { $in: uniq } }).select("expirydate").lean() as any[])
          .map((x) => x.expirydate).filter(Boolean).sort()[0];
        if (l.batchno === uniq.join(", ") && l.batchauto) continue;
        patch[`productservice.${i}.batchno`] = uniq.join(", ");
        patch[`productservice.${i}.batchauto`] = true;
        if (exp) patch[`productservice.${i}.expirydate`] = exp;
      }
      if (Object.keys(patch).length) await Model.collection.updateOne({ _id: id }, { $set: patch });
    }
  } catch (e) {
    console.error("batch sync failed:", e);
  }
};

/** A named batch must exist, be in date and have the quantity (unless negative stock is allowed). */
export const checkNamedBatches = async (docmodel: string, input: any, docid?: any) => {
  if (!input?.productservice?.length) return;
  const adminid = oid(input.adminid);
  const branchid = oid(input.branchid);
  if (!adminid || !branchid || !(await batchesOn(adminid))) return;
  const lines = await explicitLines(docmodel, input);
  if (!lines.length) return;
  const st: any = await AdminSettings.findOne({ adminid }).select("allowNegativeStock").lean();
  const today = istDate();
  const need: Record<string, number> = {};
  for (const l of lines) need[`${l.productid}|${l.variantid}|${l.batchno}`] = (need[`${l.productid}|${l.variantid}|${l.batchno}`] || 0) + l.qty;
  for (const [k, q] of Object.entries(need)) {
    const [p, v, batchno] = k.split("|");
    const b: any = await BatchStock.findOne({ adminid, branchid, productid: p, variantid: v || null, batchno }).lean();
    const name = async () => ((await ProductService.findById(p).select("name").lean()) as any)?.name || "item";
    if (!b) throw new TenantError(`Batch ${batchno} of ${await name()} is not in stock at this branch.`, "BAD_USER_INPUT");
    if (b.expirydate && b.expirydate < today) throw new TenantError(`Batch ${batchno} of ${await name()} expired on ${b.expirydate.split("-").reverse().join("-")}.`, "BAD_USER_INPUT");
    if (st?.allowNegativeStock === true) continue;
    const own = docid ? -((await BatchMove.aggregate([
      { $match: { docid: new Types.ObjectId(String(docid)), productid: new Types.ObjectId(p), batchno } },
      { $group: { _id: null, q: { $sum: "$qty" } } },
    ]))[0]?.q || 0) : 0;
    const avail = Number(b.qty || 0) + own;
    if (q > avail + 1e-9) throw new TenantError(`Batch ${batchno} of ${await name()} has only ${r4(avail)} in stock.`, "BAD_USER_INPUT");
  }
};

const idOf = (args: any[], result: any) => (result && typeof result === "object" ? oid(result) : null) || args[1]?.id;

/** Keep batches in step after these stock mutations. `out` = documents that take stock out (named batches are checked first). */
export const withBatches = (map: any, docmodel: string, fields: string[], out = false) => {
  if (!map?.Mutation) return map;
  const M = { ...map.Mutation };
  for (const f of fields) {
    const orig = M[f];
    if (typeof orig !== "function") continue;
    M[f] = async (...args: any[]) => {
      if (out && args[1]?.input) await checkNamedBatches(docmodel, args[1].input, args[1]?.id);
      const result = await orig(...args);
      const id = idOf(args, result);
      if (f === "convertSalesOrderToInvoice") await syncBatches("SalesInvoice", oid(result));
      else if (id) await syncBatches(docmodel, id);
      // Order-only businesses get the invoice made inside the order steps.
      if (docmodel === "SalesOrder" && id) {
        const inv: any = await mongoose.model("SalesInvoice").findOne({ sourceorderid: id }).select("_id").lean();
        if (inv) await syncBatches("SalesInvoice", inv._id);
      }
      return result;
    };
  }
  return { ...map, Mutation: M };
};

/** Daily: tell the owner which batches expired or expire within 30 days. */
export const startBatchExpiryScheduler = () => {
  cron.schedule("13 9 * * *", async () => {
    try {
      const admins: any[] = await Admin.find({ allowedmodules: { $regex: /^batches$/i } }).select("_id").lean();
      const today = istDate();
      const soon = istDate(new Date(Date.now() + 30 * 86400000));
      for (const a of admins) {
        const [expired, expiring] = await Promise.all([
          BatchStock.countDocuments({ adminid: a._id, qty: { $gt: 0 }, expirydate: { $lt: today } }),
          BatchStock.countDocuments({ adminid: a._id, qty: { $gt: 0 }, expirydate: { $gte: today, $lte: soon } }),
        ]);
        if (!expired && !expiring) continue;
        pushNotification({
          adminid: a._id, targettype: "admin", ntype: "stock", webpath: "/batches",
          title: expired ? `${expired} batch${expired === 1 ? "" : "es"} expired with stock` : `${expiring} batch${expiring === 1 ? "" : "es"} expire within 30 days`,
          message: [expired && `${expired} expired`, expiring && `${expiring} expiring within 30 days`].filter(Boolean).join(" · "),
        }).catch(() => {});
      }
    } catch (e) {
      console.error("batch expiry alert failed:", e);
    }
  }, { timezone: "Asia/Kolkata" });
};
