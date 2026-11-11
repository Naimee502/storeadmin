import { Types } from "mongoose";
import { Opportunity } from "../../models/ai";
import { Account } from "../../models/accounts";
import { SalesInvoice } from "../../models/salesinvoice";
import { Quotation } from "../../models/quotation";
import { Lead } from "../../models/lead";
import { Contract, Appointment, JobCard } from "../../models/service";
import { ProductService } from "../../models/products";

// Finds the day's lead list inside the business's own data. No AI needed: these are
// plain queries, so they work with AI switched off. AI only rewrites the reason and
// the draft message afterwards.

const DAY = 86400000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY));
const money = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const oid = (v: any) => (v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v)));

export type Found = {
  kind: string;
  dedupekey: string;
  partyacc?: any;
  leadid?: any;
  name: string;
  mobile?: string;
  city?: string;
  title: string;
  reason: string;
  score: number;
  value?: number;
  dueAt?: Date | null;
  lastorderAt?: Date | null;
  draftmessage: string;
};

/** 0-100: how worth a call this is. Value matters, then how overdue it is. */
const scoreOf = (value: number, overdueDays: number, base: number) =>
  Math.min(100, Math.round(base + Math.min(Math.log10(Math.max(value, 1)) * 8, 32) + Math.min(overdueDays / 10, 20)));

/** Customers who used to buy and have gone quiet. */
async function dormant(adminid: any, afterDays: number): Promise<Found[]> {
  const rows: any[] = await SalesInvoice.aggregate([
    { $match: { adminid: oid(adminid), status: true, cancelStatus: { $ne: "cancelled" } } },
    { $group: { _id: "$partyacc", last: { $max: "$billdate" }, total: { $sum: "$totalamount" }, bills: { $sum: 1 } } },
    { $match: { bills: { $gte: 2 } } },
  ]);
  const cut = ymd(daysAgo(afterDays));
  const quiet = rows.filter((r) => r._id && String(r.last).slice(0, 10) < cut);
  if (!quiet.length) return [];
  const parties = await Account.find({ _id: { $in: quiet.map((r) => r._id) }, admin: adminid, status: true })
    .select("name mobile city").lean();
  const byId = new Map(parties.map((p: any) => [String(p._id), p]));
  return quiet.flatMap((r) => {
    const p: any = byId.get(String(r._id));
    if (!p) return [];
    const last = new Date(`${String(r.last).slice(0, 10)}T00:00:00`);
    const gap = daysBetween(last, new Date());
    const avg = Number(r.total) / Math.max(Number(r.bills), 1);
    return [{
      kind: "dormant",
      dedupekey: `dormant:${r._id}`,
      partyacc: r._id,
      name: p.name,
      mobile: p.mobile,
      city: p.city,
      title: `No order for ${gap} days`,
      reason: `Bought ${r.bills} times, ${money(r.total)} in all. Last order ${gap} days ago; the average bill is ${money(avg)}.`,
      score: scoreOf(r.total, gap - afterDays, 40),
      value: Math.round(avg),
      lastorderAt: last,
      draftmessage: `Hello ${p.name}, it has been a while since your last order. Can we send you the latest rates?`,
    }];
  });
}

/** Quotations sent and never answered. */
async function coldQuotes(adminid: any, afterDays: number): Promise<Found[]> {
  const cut = ymd(daysAgo(afterDays));
  const rows: any[] = await Quotation.find({
    adminid, status: true, quotationStatus: { $in: ["sent", "draft"] }, billdate: { $lt: cut },
  }).select("billnumber offlineNumber billdate totalamount partyacc leadid customername customermobile customercity subject")
    .populate({ path: "partyacc", select: "name mobile city" })
    .sort({ totalamount: -1 }).limit(100).lean();
  return rows.map((q: any) => {
    const p = q.partyacc;
    const sent = new Date(`${String(q.billdate).slice(0, 10)}T00:00:00`);
    const gap = daysBetween(sent, new Date());
    const name = p?.name || q.customername || "Customer";
    return {
      kind: "coldquote",
      dedupekey: `coldquote:${q._id}`,
      partyacc: p?._id,
      leadid: q.leadid,
      name,
      mobile: p?.mobile || q.customermobile,
      city: p?.city || q.customercity,
      title: `Quotation waiting ${gap} days`,
      reason: `${money(q.totalamount)} quotation${q.subject ? ` for ${q.subject}` : ""} sent ${gap} days ago with no answer yet.`,
      score: scoreOf(q.totalamount, gap - afterDays, 55),
      value: Number(q.totalamount) || 0,
      dueAt: sent,
      draftmessage: `Hello ${name}, following up on our quotation of ${money(q.totalamount)}. Shall I hold these rates for you?`,
    };
  });
}

/** Open leads nobody has booked a follow-up for, or whose follow-up is past due. */
async function stalledLeads(adminid: any, closedStages: string[]): Promise<Found[]> {
  const rows: any[] = await Lead.find({
    adminid, status: true, partyid: null,
    ...(closedStages.length ? { stage: { $nin: closedStages } } : {}),
    $or: [{ nextfollowupAt: null }, { nextfollowupAt: { $lt: new Date() } }],
  }).select("name company mobile city expectedvalue requirement nextfollowupAt createdAt source").sort({ expectedvalue: -1 }).limit(100).lean();
  return rows.map((l: any) => {
    const since = l.nextfollowupAt ? new Date(l.nextfollowupAt) : new Date(l.createdAt);
    const gap = daysBetween(since, new Date());
    return {
      kind: "nofollowup",
      dedupekey: `nofollowup:${l._id}`,
      leadid: l._id,
      name: l.company || l.name,
      mobile: l.mobile,
      city: l.city,
      title: l.nextfollowupAt ? `Follow up ${gap} days overdue` : `No follow up booked (${gap} days)`,
      reason: `${l.source ? `${l.source} lead. ` : ""}${l.requirement ? `Wants: ${String(l.requirement).slice(0, 80)}. ` : ""}${l.expectedvalue ? `Worth about ${money(l.expectedvalue)}. ` : ""}Nothing booked yet.`,
      score: scoreOf(l.expectedvalue || 0, gap, 50),
      value: Number(l.expectedvalue) || 0,
      dueAt: l.nextfollowupAt || null,
      draftmessage: `Hello ${l.name}, following up on your enquiry. Is this still something you need?`,
    };
  });
}

/** AMC / warranty contracts coming up for renewal. */
async function amcDue(adminid: any, withinDays: number): Promise<Found[]> {
  const limit = ymd(new Date(Date.now() + withinDays * DAY));
  const rows: any[] = await Contract.find({ adminid, status: true, contractStatus: { $ne: "cancelled" }, enddate: { $lte: limit } })
    .select("title contractType enddate amount partyacc visitsallowed visitsdone")
    .populate({ path: "partyacc", select: "name mobile city" }).limit(100).lean();
  return rows.map((c: any) => {
    const end = new Date(`${String(c.enddate).slice(0, 10)}T00:00:00`);
    const left = daysBetween(new Date(), end);
    const expired = end.getTime() < Date.now();
    return {
      kind: "amcdue",
      dedupekey: `amcdue:${c._id}`,
      partyacc: c.partyacc?._id,
      name: c.partyacc?.name || "Customer",
      mobile: c.partyacc?.mobile,
      city: c.partyacc?.city,
      title: expired ? `${c.contractType === "warranty" ? "Warranty" : "AMC"} expired` : `${c.contractType === "warranty" ? "Warranty" : "AMC"} ends in ${left} days`,
      reason: `${c.title || "Contract"} worth ${money(c.amount)} ${expired ? "has expired" : `ends on ${c.enddate}`}.${c.visitsallowed ? ` Visits used ${c.visitsdone || 0} of ${c.visitsallowed}.` : ""}`,
      score: scoreOf(c.amount, expired ? daysBetween(end, new Date()) : 0, 60),
      value: Number(c.amount) || 0,
      dueAt: end,
      draftmessage: `Hello ${c.partyacc?.name || "there"}, your ${c.contractType === "warranty" ? "warranty" : "AMC"} ${expired ? "has expired" : `ends on ${c.enddate}`}. Shall we renew it?`,
    };
  });
}

/** Services whose "next due in N days" has come round again. */
async function serviceDue(adminid: any): Promise<Found[]> {
  const services: any[] = await ProductService.find({ adminid, isservice: true, status: true, "servicevariants.nextduedays": { $gt: 0 } })
    .select("name servicevariants._id servicevariants.name servicevariants.nextduedays").lean();
  if (!services.length) return [];
  const dueDays = new Map<string, { days: number; label: string }>();
  for (const p of services) {
    for (const v of p.servicevariants || []) {
      if (Number(v.nextduedays) > 0) dueDays.set(`${p._id}|${v._id}`, { days: Number(v.nextduedays), label: p.name });
    }
  }
  const ids = services.map((p: any) => p._id);
  const [appts, jobs]: any[] = await Promise.all([
    Appointment.find({ adminid, status: true, apptStatus: "done", "services.productserviceid": { $in: ids } })
      .select("billdate services partyacc customername customermobile")
      .populate({ path: "partyacc", select: "name mobile city" }).sort({ billdate: -1 }).limit(500).lean(),
    JobCard.find({ adminid, status: true, jobStatus: "delivered", "estimate.productserviceid": { $in: ids } })
      .select("billdate deliveredAt estimate partyacc customername customermobile")
      .populate({ path: "partyacc", select: "name mobile city" }).sort({ billdate: -1 }).limit(500).lean(),
  ]);

  // Latest time each customer had each service.
  const last = new Map<string, any>();
  const note = (doc: any, lines: any[], when: any) => {
    const who = doc.partyacc?._id ? String(doc.partyacc._id) : String(doc.customermobile || doc.customername || "");
    if (!who) return;
    for (const l of lines || []) {
      const cfg = dueDays.get(`${l.productserviceid}|${l.variantid}`) || dueDays.get(`${l.productserviceid}|`);
      if (!cfg) continue;
      const key = `${who}|${l.productserviceid}`;
      const at = new Date(when);
      const prev = last.get(key);
      if (!prev || prev.at < at) last.set(key, { at, doc, cfg });
    }
  };
  for (const a of appts) note(a, a.services, `${String(a.billdate).slice(0, 10)}T00:00:00`);
  for (const j of jobs) note(j, j.estimate, j.deliveredAt || `${String(j.billdate).slice(0, 10)}T00:00:00`);

  const out: Found[] = [];
  for (const [key, x] of last) {
    const due = new Date(x.at.getTime() + x.cfg.days * DAY);
    if (due.getTime() > Date.now() + 30 * DAY) continue;
    const p = x.doc.partyacc;
    const name = p?.name || x.doc.customername || "Customer";
    const over = due.getTime() < Date.now();
    out.push({
      kind: "servicedue",
      dedupekey: `servicedue:${key}`,
      partyacc: p?._id,
      name,
      mobile: p?.mobile || x.doc.customermobile,
      city: p?.city,
      title: over ? `${x.cfg.label} overdue` : `${x.cfg.label} due in ${daysBetween(new Date(), due)} days`,
      reason: `Last done on ${ymd(x.at)}; this service is due every ${x.cfg.days} days.`,
      score: scoreOf(0, over ? daysBetween(due, new Date()) : 0, 58),
      dueAt: due,
      lastorderAt: x.at,
      draftmessage: `Hello ${name}, your ${x.cfg.label} is ${over ? "overdue" : "due soon"}. Shall we book a slot?`,
    });
  }
  return out;
}

/**
 * Runs every finder and saves what it found, keeping one row per customer and kind.
 * A row already acted on is left alone.
 */
export async function findOpportunities(
  adminid: any,
  opts: { dormantDays?: number; quoteDays?: number; amcDays?: number; closedStages?: string[] } = {}
): Promise<{ found: number; kinds: Record<string, number> }> {
  const lists = await Promise.all([
    dormant(adminid, opts.dormantDays ?? 90).catch(() => []),
    coldQuotes(adminid, opts.quoteDays ?? 7).catch(() => []),
    stalledLeads(adminid, opts.closedStages ?? []).catch(() => []),
    amcDue(adminid, opts.amcDays ?? 45).catch(() => []),
    serviceDue(adminid).catch(() => []),
  ]);
  const all = lists.flat();
  const kinds: Record<string, number> = {};
  const now = new Date();
  for (const f of all) {
    kinds[f.kind] = (kinds[f.kind] || 0) + 1;
    await Opportunity.updateOne(
      { adminid, dedupekey: f.dedupekey },
      {
        $set: { ...f, adminid, foundAt: now, status: true },
        // A row the staff already handled keeps its state.
        $setOnInsert: { state: "open" },
      },
      { upsert: true }
    );
  }
  // Rows whose reason has gone (order placed, quotation answered) drop off the list.
  await Opportunity.updateMany(
    { adminid, state: "open", status: true, foundAt: { $lt: now } },
    { $set: { status: false } }
  );
  return { found: all.length, kinds };
}
