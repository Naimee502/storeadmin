import { Types } from "mongoose";
import { Insight } from "../../models/insight";
import { Account } from "../../models/accounts";
import { SalesInvoice } from "../../models/salesinvoice";
import { Payment } from "../../models/payments";
import { ProductService } from "../../models/products";
import { ProductBranchStock } from "../../models/productbranchstock";
import { Branch } from "../../models/branches";
import { getPartiesTotalDue, getPartyOutstandingBills, getPartyTotalDue } from "../allocation";
import { partyTypeQuery } from "../partytype";

// What changed in the business, from its own data. Plain queries, no AI, so the
// strip works with AI switched off; AI only rewrites the reason and the message.
// Every card carries the rows it was read from, and a detector stays quiet until
// the party or item has enough history to compare against.

const DAY = 86400000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY));
const dateOf = (s: any) => new Date(`${String(s).slice(0, 10)}T00:00:00`);
const money = (n: any) => `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;
const oid = (v: any) => (v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v)));

export type Evidence = { label: string; detail?: string; amount?: number };

/** What a party owes, read through the shared helpers so every screen agrees. */
async function outstandingOf(partyid: any) {
  const [bills, amount] = await Promise.all([
    getPartyOutstandingBills({ partyid, invoicemodel: "SalesInvoice" }),
    getPartyTotalDue({ partyid, invoicemodel: "SalesInvoice" }),
  ]);
  const today = new Date();
  let overdueDays = 0;
  let oldestDays = 0;
  let dueDate = "";
  for (const b of bills) {
    const age = daysBetween(dateOf(b.billdate), today);
    if (age > oldestDays) oldestDays = age;
    if (!b.duedate) continue;
    const due = dateOf(b.duedate);
    if (!dueDate || due < dateOf(dueDate)) dueDate = String(b.duedate).slice(0, 10);
    const over = daysBetween(due, today);
    if (due.getTime() < today.getTime() && over > overdueDays) overdueDays = over;
  }
  return { amount: Number(amount) || 0, pendingBills: bills.length, overdueDays, oldestDays, dueDate };
}

export type Insighted = {
  kind: string;
  dedupekey: string;
  branchid?: any;
  partyacc?: any;
  productid?: any;
  variantid?: any;
  name: string;
  mobile?: string;
  city?: string;
  title: string;
  reason: string;
  evidence: Evidence[];
  value: number;
  score: number;
  dueAt?: Date | null;
  lastorderAt?: Date | null;
  draftmessage: string;
};

/** 0-100. Rupees at stake decide the order; how overdue it is only breaks ties. */
const scoreOf = (value: number, overdueDays: number, base: number) =>
  Math.min(100, Math.round(base + Math.min(Math.log10(Math.max(value, 1)) * 9, 34) + Math.min(overdueDays / 10, 14)));

const liveBills = (adminid: any, from: Date) => ({
  adminid: oid(adminid),
  status: true,
  cancelStatus: { $ne: "cancelled" },
  billdate: { $gte: ymd(from) },
});

async function customers(adminid: any, ids: any[]) {
  if (!ids.length) return new Map<string, any>();
  const rows: any[] = await Account.find({
    _id: { $in: ids }, admin: adminid, status: true, type: partyTypeQuery("customer"),
  }).select("name mobile city").lean();
  return new Map(rows.map((p: any) => [String(p._id), p]));
}

/**
 * Buying less than they used to: the last 30 days against the average of the
 * three 30-day blocks before it, so each party is judged on its own pace.
 */
async function slipping(adminid: any): Promise<Insighted[]> {
  // billdate is a YYYY-MM-DD string, so the blocks are plain string compares.
  const [c0, c1, c2, c3] = [30, 60, 90, 120].map((d) => ymd(daysAgo(d)));
  const inBlock = (from: string, to?: string) =>
    to ? { $and: [{ $gte: ["$billdate", from] }, { $lt: ["$billdate", to] }] } : { $gte: ["$billdate", from] };
  const sumIf = (from: string, to?: string) => ({ $sum: { $cond: [inBlock(from, to), "$totalamount", 0] } });

  const rows: any[] = await SalesInvoice.aggregate([
    { $match: liveBills(adminid, daysAgo(120)) },
    { $group: {
      _id: "$partyacc",
      now: sumIf(c0),
      b1: sumIf(c1, c0),
      b2: sumIf(c2, c1),
      b3: sumIf(c3, c2),
      bills: { $sum: 1 },
      last: { $max: "$billdate" },
    } },
    { $match: { bills: { $gte: 3 } } },
  ]);
  const found: { r: any; now: number; base: number }[] = [];
  for (const r of rows) {
    const earlier = [Number(r.b1) || 0, Number(r.b2) || 0, Number(r.b3) || 0];
    const base = (earlier[0] + earlier[1] + earlier[2]) / 3;
    const now = Number(r.now) || 0;
    // Needs a steady earlier run and a clear drop, so a quiet week is not a card.
    if (base < 1000 || now >= base * 0.5) continue;
    if (earlier.filter((v) => v > 0).length < 2) continue;
    found.push({ r, now, base });
  }
  if (!found.length) return [];
  const byId = await customers(adminid, found.map((f) => f.r._id));
  const picked = found.filter((f) => byId.has(String(f.r._id))).sort((a, b) => b.base - a.base).slice(0, 40);

  const bills: any[] = await SalesInvoice.find({
    ...liveBills(adminid, daysAgo(120)), partyacc: { $in: picked.map((f) => f.r._id) },
  }).select("partyacc billdate totalamount billnumber offlineNumber").sort({ billdate: -1 }).lean();
  const lastThree = new Map<string, any[]>();
  for (const b of bills) {
    const k = String(b.partyacc);
    const list = lastThree.get(k) || [];
    if (list.length < 3) { list.push(b); lastThree.set(k, list); }
  }

  return picked.map((f) => {
    const p: any = byId.get(String(f.r._id));
    const drop = Math.round(((f.base - f.now) / f.base) * 100);
    const last = dateOf(f.r.last);
    return {
      kind: "slipping",
      dedupekey: `slipping:${f.r._id}`,
      partyacc: f.r._id,
      name: p.name,
      mobile: p.mobile,
      city: p.city,
      title: `Orders down ${drop}%`,
      reason: `Used to order about ${money(f.base)} a month; the last 30 days came to ${money(f.now)}. Last order ${daysBetween(last, new Date())} days ago.`,
      evidence: (lastThree.get(String(f.r._id)) || []).map((b: any) => ({
        label: b.billnumber || b.offlineNumber || "Bill",
        detail: String(b.billdate).slice(0, 10),
        amount: Number(b.totalamount) || 0,
      })),
      value: Math.round(f.base - f.now),
      score: scoreOf(f.base - f.now, drop, 52),
      lastorderAt: last,
      draftmessage: `Hello ${p.name}, we have not had an order from you in a while. Can we send you our latest rates?`,
    };
  });
}

/**
 * Late by their own standard: how long this party normally takes to pay,
 * against how long the money has been sitting now.
 */
async function paymentRisk(adminid: any): Promise<Insighted[]> {
  const parties: any[] = await Account.find({
    admin: adminid, status: true, type: partyTypeQuery("customer"),
  }).select("name mobile city").limit(2000).lean();
  if (!parties.length) return [];

  const dues = await getPartiesTotalDue({ partyids: parties.map((p) => p._id), adminid });
  const owing = parties
    .filter((p) => Number(dues[String(p._id)] || 0) > 1)
    .sort((a, b) => Number(dues[String(b._id)]) - Number(dues[String(a._id)]))
    .slice(0, 50);
  if (!owing.length) return [];

  // How many days this party usually takes, read from settled bills.
  const paid: any[] = await Payment.aggregate([
    { $match: { adminid: oid(adminid), type: "receipt", status: true, partyid: { $in: owing.map((p) => p._id) }, paymentdate: { $gte: daysAgo(540) } } },
    { $unwind: "$invoices" },
    { $match: { "invoices.invoicemodel": "SalesInvoice", "invoices.settledamount": { $gt: 0 } } },
    { $lookup: { from: "salesinvoices", localField: "invoices.invoiceid", foreignField: "_id", as: "bill" } },
    { $unwind: "$bill" },
    { $project: { partyid: 1, paymentdate: 1, billdate: "$bill.billdate" } },
    { $limit: 4000 },
  ]);
  const spans = new Map<string, number[]>();
  for (const r of paid) {
    const days = daysBetween(dateOf(r.billdate), new Date(r.paymentdate));
    if (!isFinite(days) || days > 365) continue;
    const k = String(r.partyid);
    spans.set(k, [...(spans.get(k) || []), days]);
  }
  const habit = new Map(
    Array.from(spans, ([k, list]) => [k, { days: Math.round(list.reduce((t, d) => t + d, 0) / list.length), n: list.length }])
  );

  const out: Insighted[] = [];
  for (const p of owing) {
    const o = await outstandingOf(p._id).catch(() => null);
    if (!o || o.amount <= 1) continue;
    const h = habit.get(String(p._id));
    // No payment history yet: fall back to the due date on the bill.
    const limit = h && h.n >= 3 ? Math.max(Math.round(h.days * 1.5), h.days + 15) : 0;
    const late = limit ? o.overdueDays > 0 || o.oldestDays > limit : o.overdueDays > 0;
    if (!late) continue;
    const by = limit ? o.oldestDays - limit : o.overdueDays;
    out.push({
      kind: "paymentrisk",
      dedupekey: `paymentrisk:${p._id}`,
      partyacc: p._id,
      name: p.name,
      mobile: p.mobile,
      city: p.city,
      title: `${money(o.amount)} outstanding`,
      reason: h && h.n >= 3
        ? `This party normally pays in about ${h.days} days; the oldest bill has been open ${o.oldestDays} days.`
        : `${o.pendingBills} bill(s) open${o.overdueDays ? `, the oldest ${o.overdueDays} days past its due date` : ""}.`,
      evidence: [
        { label: "Outstanding", detail: `${o.pendingBills} open bill(s)`, amount: o.amount },
        ...(h && h.n >= 3 ? [{ label: "Usually pays in", detail: `${h.days} days (${h.n} bills)` }] : []),
        ...(o.dueDate ? [{ label: "Earliest due date", detail: o.dueDate }] : []),
      ],
      value: Math.round(o.amount),
      score: scoreOf(o.amount, Math.max(by, 0), 58),
      dueAt: o.dueDate ? dateOf(o.dueDate) : null,
      draftmessage: `Hello ${p.name}, ${money(o.amount)} is outstanding on your account. Could you please arrange the payment?`,
    });
  }
  return out;
}

/**
 * Still buying, but stopped one item they always took — usually another
 * supplier. Only for parties still active, so it is not just churn again.
 */
async function stoppedItem(adminid: any): Promise<Insighted[]> {
  const rows: any[] = await SalesInvoice.aggregate([
    { $match: liveBills(adminid, daysAgo(365)) },
    { $unwind: "$productservice" },
    { $group: {
      _id: { p: "$partyacc", i: "$productservice.productserviceid" },
      times: { $sum: 1 },
      amount: { $sum: "$productservice.amount" },
      first: { $min: "$billdate" },
      last: { $max: "$billdate" },
    } },
    { $match: { times: { $gte: 3 } } },
  ]);
  if (!rows.length) return [];

  // Only parties who are still ordering: the point is the item, not the customer.
  const active: any[] = await SalesInvoice.aggregate([
    { $match: liveBills(adminid, daysAgo(60)) },
    { $group: { _id: "$partyacc", last: { $max: "$billdate" } } },
  ]);
  const activeBy = new Map(active.map((a: any) => [String(a._id), a.last]));

  const found = rows.flatMap((r) => {
    const recent = activeBy.get(String(r._id.p));
    if (!recent) return [];
    const first = dateOf(r.first);
    const last = dateOf(r.last);
    const span = daysBetween(first, last);
    if (span < 30) return [];
    const gap = span / Math.max(r.times - 1, 1);
    const since = daysBetween(last, new Date());
    // Stopped only when well past their own rhythm for this item.
    if (since < gap * 2.5 || since < 30) return [];
    if (dateOf(recent) <= last) return [];
    return [{ r, gap: Math.round(gap), since, per: r.amount / r.times }];
  });
  if (!found.length) return [];

  const picked = found.sort((a, b) => b.per - a.per).slice(0, 30);
  const [byId, items] = await Promise.all([
    customers(adminid, picked.map((f) => f.r._id.p)),
    ProductService.find({ _id: { $in: picked.map((f) => f.r._id.i) } }).select("name").lean(),
  ]);
  const itemName = new Map(items.map((i: any) => [String(i._id), i.name]));

  return picked.flatMap((f) => {
    const p: any = byId.get(String(f.r._id.p));
    const item = itemName.get(String(f.r._id.i));
    if (!p || !item) return [];
    return [{
      kind: "stoppeditem",
      dedupekey: `stoppeditem:${f.r._id.p}:${f.r._id.i}`,
      partyacc: f.r._id.p,
      productid: f.r._id.i,
      name: p.name,
      mobile: p.mobile,
      city: p.city,
      title: `Stopped buying ${item}`,
      reason: `Took ${item} ${f.r.times} times, about every ${f.gap} days, averaging ${money(f.per)}. Nothing for ${f.since} days, though they are still ordering other items.`,
      evidence: [
        { label: item, detail: `${f.r.times} times in a year`, amount: Math.round(f.r.amount) },
        { label: "Last taken", detail: String(f.r.last).slice(0, 10) },
        { label: "Still ordering", detail: `last bill ${String(activeBy.get(String(f.r._id.p))).slice(0, 10)}` },
      ],
      value: Math.round(f.per),
      score: scoreOf(f.per, f.since - f.gap, 55),
      lastorderAt: dateOf(f.r.last),
      draftmessage: `Hello ${p.name}, we noticed ${item} has not been on your recent orders. Shall I add it to your next one?`,
    }];
  });
}

/** Will run out, going by what it actually sells per day rather than a fixed level. */
async function stockOut(adminid: any): Promise<Insighted[]> {
  const sold: any[] = await SalesInvoice.aggregate([
    { $match: liveBills(adminid, daysAgo(60)) },
    { $unwind: "$productservice" },
    { $group: {
      _id: { i: "$productservice.productserviceid", v: "$productservice.variantid", b: "$branchid" },
      qty: { $sum: "$productservice.qty" },
      amount: { $sum: "$productservice.amount" },
      bills: { $sum: 1 },
    } },
    { $match: { qty: { $gt: 0 }, bills: { $gte: 3 } } },
  ]);
  if (!sold.length) return [];

  const stocks: any[] = await ProductBranchStock.find({
    adminid, productid: { $in: sold.map((s) => s._id.i) },
  }).select("productid variantid branchid currentstock").lean();
  const stockBy = new Map(stocks.map((s: any) => [`${s.productid}|${s.variantid || ""}|${s.branchid}`, Number(s.currentstock) || 0]));

  const found = sold.flatMap((s) => {
    const key = `${s._id.i}|${s._id.v || ""}|${s._id.b}`;
    if (!stockBy.has(key)) return [];
    const stock = stockBy.get(key)!;
    const perDay = Number(s.qty) / 60;
    if (perDay <= 0) return [];
    const daysLeft = Math.floor(stock / perDay);
    if (daysLeft > 10) return [];
    // A month of sales at this pace is what running out would cost.
    return [{ s, stock, perDay, daysLeft, value: (Number(s.amount) / Number(s.qty)) * perDay * 30 }];
  });
  if (!found.length) return [];

  const picked = found.sort((a, b) => b.value - a.value).slice(0, 25);
  const [items, branches] = await Promise.all([
    ProductService.find({ _id: { $in: picked.map((f) => f.s._id.i) } }).select("name productvariants._id productvariants.name").lean(),
    Branch.find({ admin: adminid }).select("branchname").lean(),
  ]);
  const itemBy = new Map(items.map((i: any) => [String(i._id), i]));
  const branchBy = new Map(branches.map((b: any) => [String(b._id), b.branchname]));

  return picked.flatMap((f) => {
    const item: any = itemBy.get(String(f.s._id.i));
    if (!item) return [];
    const variant = f.s._id.v ? (item.productvariants || []).find((v: any) => String(v._id) === String(f.s._id.v)) : null;
    const label = variant?.name ? `${item.name} (${variant.name})` : item.name;
    const branch = branchBy.get(String(f.s._id.b));
    return [{
      kind: "stockout",
      dedupekey: `stockout:${f.s._id.i}:${f.s._id.v || ""}:${f.s._id.b}`,
      branchid: f.s._id.b,
      productid: f.s._id.i,
      variantid: f.s._id.v || undefined,
      name: label,
      title: f.daysLeft <= 0 ? "Out of stock" : `About ${f.daysLeft} days of stock left`,
      reason: `${f.stock} left${branch ? ` at ${branch}` : ""}, selling about ${f.perDay.toFixed(1)} a day. Around ${money(f.value)} of sales a month depend on it.`,
      evidence: [
        { label: "In stock", detail: branch || "", amount: f.stock },
        { label: "Sold in 60 days", detail: `${Math.round(Number(f.s.qty))} units`, amount: Math.round(Number(f.s.amount)) },
        { label: "Runs out in", detail: f.daysLeft <= 0 ? "already out" : `${f.daysLeft} days` },
      ],
      value: Math.round(f.value),
      score: scoreOf(f.value, 10 - f.daysLeft, 56),
      draftmessage: `Purchase order needed: ${label}, about ${Math.ceil(f.perDay * 30)} units for a month.`,
    }];
  });
}

/** Runs every detector and saves what it found, one row per thing and kind. */
export async function findInsights(adminid: any): Promise<{ found: number; kinds: Record<string, number> }> {
  const lists = await Promise.all([
    slipping(adminid).catch(() => []),
    paymentRisk(adminid).catch(() => []),
    stoppedItem(adminid).catch(() => []),
    stockOut(adminid).catch(() => []),
  ]);
  // No rows to check the claim against, no card.
  const all = lists.flat().filter((f) => f.evidence.length > 0);
  const kinds: Record<string, number> = {};
  const now = new Date();
  for (const f of all) {
    kinds[f.kind] = (kinds[f.kind] || 0) + 1;
    await Insight.updateOne(
      { adminid, dedupekey: f.dedupekey },
      { $set: { ...f, adminid, foundAt: now, status: true }, $setOnInsert: { state: "open" } },
      { upsert: true }
    );
  }
  // Whatever the reason was has gone: order placed, money paid, stock bought.
  await Insight.updateMany(
    { adminid, state: "open", status: true, foundAt: { $lt: now } },
    { $set: { status: false } }
  );
  return { found: all.length, kinds };
}
