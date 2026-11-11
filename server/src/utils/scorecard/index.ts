import { Types } from "mongoose";
import { SalesInvoice } from "../../models/salesinvoice";
import { StaffAccount } from "../../models/staffaccounts";
import { Payment } from "../../models/payments";

// How each salesman did, measured against the same period before it. Sales alone
// flatter a salesman who bills well and collects badly, so collection and the
// discount given are counted too.

const DAY = 86400000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const oid = (v: any) => (v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v)));
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export type SalesmanRow = {
  id: string;
  name: string;
  billed: number;
  bills: number;
  customers: number;
  newCustomers: number;
  discount: number;
  discountPercent: number;
  collected: number;
  collectionPercent: number;
  previousBilled: number;
  changePercent: number | null;
};

export async function salesmanScorecard(scope: any, days: number): Promise<SalesmanRow[]> {
  const span = Math.min(Math.max(Number(days) || 30, 1), 365);
  const from = ymd(new Date(Date.now() - span * DAY));
  const prevFrom = ymd(new Date(Date.now() - span * 2 * DAY));

  const base: any = { adminid: oid(scope.adminid), status: true, cancelStatus: { $ne: "cancelled" }, salesmenid: { $ne: null } };
  if (scope.branchid) base.branchid = oid(scope.branchid);
  // A staff login only ever sees its own row.
  if (scope.userType === "staff" && scope.userId) base.salesmenid = oid(scope.userId);

  const [now, prev] = await Promise.all([
    SalesInvoice.aggregate([
      { $match: { ...base, billdate: { $gte: from } } },
      { $group: {
        _id: "$salesmenid",
        billed: { $sum: "$totalamount" },
        discount: { $sum: { $add: [{ $ifNull: ["$totaldiscount", 0] }, { $ifNull: ["$invoicediscount", 0] }] } },
        received: { $sum: { $ifNull: ["$received", 0] } },
        bills: { $sum: 1 },
        parties: { $addToSet: "$partyacc" },
      } },
    ]),
    SalesInvoice.aggregate([
      { $match: { ...base, billdate: { $gte: prevFrom, $lt: from } } },
      { $group: { _id: "$salesmenid", billed: { $sum: "$totalamount" }, parties: { $addToSet: "$partyacc" } } },
    ]),
  ]);
  if (!now.length) return [];

  const ids = now.map((r: any) => r._id);
  const [staff, receipts] = await Promise.all([
    StaffAccount.find({ _id: { $in: ids }, admin: scope.adminid }).select("name").lean(),
    // Money collected later against those bills, so credit sales are not punished.
    Payment.aggregate([
      { $match: { adminid: oid(scope.adminid), type: "receipt", status: true, paymentdate: { $gte: new Date(Date.now() - span * DAY) } } },
      { $unwind: "$invoices" },
      { $match: { "invoices.invoicemodel": "SalesInvoice", "invoices.settledamount": { $gt: 0 } } },
      { $lookup: { from: "salesinvoices", localField: "invoices.invoiceid", foreignField: "_id", as: "bill" } },
      { $unwind: "$bill" },
      { $match: { "bill.salesmenid": { $in: ids } } },
      { $group: { _id: "$bill.salesmenid", settled: { $sum: "$invoices.settledamount" } } },
    ]),
  ]);
  const nameBy = new Map(staff.map((s: any) => [String(s._id), s.name]));
  const settledBy = new Map(receipts.map((r: any) => [String(r._id), Number(r.settled) || 0]));
  const prevBy = new Map(prev.map((r: any) => [String(r._id), r]));

  return now
    .filter((r: any) => nameBy.has(String(r._id)))
    .map((r: any) => {
      const key = String(r._id);
      const billed = Number(r.billed) || 0;
      const before: any = prevBy.get(key);
      const previousBilled = Number(before?.billed) || 0;
      const seenBefore = new Set((before?.parties || []).map(String));
      const collected = (Number(r.received) || 0) + (settledBy.get(key) || 0);
      return {
        id: key,
        name: nameBy.get(key) as string,
        billed: Math.round(billed),
        bills: r.bills,
        customers: (r.parties || []).length,
        newCustomers: (r.parties || []).filter((p: any) => !seenBefore.has(String(p))).length,
        discount: Math.round(Number(r.discount) || 0),
        discountPercent: pct(Number(r.discount) || 0, billed + (Number(r.discount) || 0)),
        collected: Math.round(Math.min(collected, billed)),
        collectionPercent: pct(Math.min(collected, billed), billed),
        previousBilled: Math.round(previousBilled),
        changePercent: previousBilled > 0 ? Math.round(((billed - previousBilled) / previousBilled) * 100) : null,
      };
    })
    .sort((a, b) => b.billed - a.billed);
}
