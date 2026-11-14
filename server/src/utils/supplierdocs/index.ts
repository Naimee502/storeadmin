import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { Account } from "../../models/accounts";
import { Admin } from "../../models/admin";
import { AdminSettings } from "../../models/adminsettings";
import { PurchaseOrder } from "../../models/purchaseorder";
import { PurchaseInvoice } from "../../models/purchaseinvoice";
import { getInvoiceOutstanding } from "../allocation";
import { pushNotification } from "../../models/notifications";
import { TenantError } from "../tenant";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const PRINT_SECRET = () => `${process.env.JWT_ACCESS_SECRET}:supplier-print`;

/** Same line maths as the purchase order form: (rate - discount) x qty, plus GST. */
export const lineTotals = (l: any) => {
  const qty = Number(l.qty) || 0, rate = Number(l.rate) || 0, disc = Number(l.discount) || 0, gst = Number(l.gst) || 0;
  const taxable = (rate - disc) * qty;
  const gstAmt = (taxable * gst) / 100;
  return { gross: qty * rate, disc, gstAmt, total: taxable + gstAmt };
};

/** A supplier's own order or bill, or a not-found error. */
export const loadSupplierDoc = async (kind: string, id: string, partyid: any, adminid: any) => {
  if (!Types.ObjectId.isValid(String(id))) throw new TenantError("Not found.", "NOT_FOUND");
  const Model: any = kind === "order" ? PurchaseOrder : kind === "bill" ? PurchaseInvoice : null;
  if (!Model) throw new TenantError("Not found.", "BAD_USER_INPUT");
  const doc: any = await Model.findOne({ _id: id, adminid, partyacc: partyid, status: true })
    .populate("productservice.productserviceid", "name").populate("productservice.purchaseunitid", "unitname").lean();
  if (!doc) throw new TenantError("Not found.", "NOT_FOUND");
  return doc;
};

export const docShape = async (kind: string, d: any) => {
  const orderStatus = kind === "order" ? (d.cancelStatus === "cancelled" ? "cancelled" : d.orderStatus || "pending") : null;
  const outstanding = kind === "bill"
    ? await getInvoiceOutstanding({ invoiceid: d._id, invoicemodel: "PurchaseInvoice" } as any).catch(() => null)
    : null;
  return {
    id: String(d._id), kind,
    billnumber: d.billnumber || null, billdate: d.billdate || null, duedate: d.duedate || null,
    orderStatus, notes: d.notes || null, suppliernote: d.suppliernote || null,
    subtotal: r2(d.subtotal), totaldiscount: r2(d.totaldiscount), totalgst: r2(d.totalgst),
    roundoff: d.roundoff != null ? r2(d.roundoff) : null, totalamount: r2(d.totalamount),
    outstanding: outstanding == null ? null : r2(typeof outstanding === "number" ? outstanding : (outstanding as any)?.outstanding),
    editable: kind === "order" && orderStatus === "pending" && !d.isConverted,
    lines: (d.productservice || []).map((l: any) => ({
      lineid: String(l._id), name: l.productserviceid?.name || "Item", unit: l.purchaseunitid?.unitname || null,
      qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, discount: Number(l.discount) || 0, gst: Number(l.gst) || 0,
      amount: r2(Number(l.amount) || lineTotals(l).total),
    })),
    charges: (d.othercharges || []).map((c: any) => ({ name: c.ledgername || "Charges", amount: r2(c.totalamount ?? c.amount) })),
  };
};

/** Supplier edits qty / rate of a pending order; totals move by the change only. */
export const editSupplierOrder = async (id: string, partyid: any, adminid: any, lines: any[], note?: string) => {
  const d = await loadSupplierDoc("order", id, partyid, adminid);
  if (d.cancelStatus === "cancelled" || d.isConverted || (d.orderStatus || "pending") !== "pending") {
    throw new TenantError("This order is already confirmed, so it can no longer be changed.", "BAD_USER_INPUT");
  }
  const byId = new Map(lines.map((l: any) => [String(l.lineid), l]));
  let dGross = 0, dDisc = 0, dGst = 0, dTotal = 0;
  const next: any[] = [];
  for (const l of d.productservice || []) {
    const before = lineTotals(l);
    const ask: any = byId.get(String(l._id));
    const qty = ask ? Number(ask.qty) : Number(l.qty);
    const rate = ask ? Number(ask.rate) : Number(l.rate);
    if (!(qty >= 0) || !(rate >= 0)) throw new TenantError("Quantity and rate cannot be negative.", "BAD_USER_INPUT");
    if (qty === 0) { dGross -= before.gross; dDisc -= before.disc; dGst -= before.gstAmt; dTotal -= before.total; continue; }
    const after = lineTotals({ ...l, qty, rate });
    dGross += after.gross - before.gross; dGst += after.gstAmt - before.gstAmt; dTotal += after.total - before.total;
    next.push({ ...l, productserviceid: l.productserviceid?._id || l.productserviceid, purchaseunitid: l.purchaseunitid?._id || l.purchaseunitid, qty, rate, amount: r2(after.total) });
  }
  if (!next.length) throw new TenantError("Keep at least one item in the order.", "BAD_USER_INPUT");
  const set: any = {
    productservice: next,
    subtotal: r2(d.subtotal + dGross), totaldiscount: r2(d.totaldiscount + dDisc),
    totalgst: r2(d.totalgst + dGst), totalamount: r2(d.totalamount + dTotal), supplierEditedAt: new Date(),
  };
  if (note != null) set.suppliernote = String(note).slice(0, 500);
  // Only while still pending and unchanged since it was read.
  const res = await PurchaseOrder.updateOne({ _id: d._id, updatedAt: d.updatedAt, orderStatus: d.orderStatus ?? { $in: [null, "pending"] }, isConverted: { $ne: true } }, { $set: set });
  if (!res.modifiedCount) throw new TenantError("The business changed this order just now. Please reload and try again.", "CONFLICT");
  const supplier: any = await Account.findById(partyid).select("name").lean();
  pushNotification({
    adminid, branchid: d.branchid, targettype: "admin", ntype: "order",
    title: `Purchase order ${d.billnumber || ""} changed by supplier`.replace("  ", " "),
    message: `${supplier?.name || "Supplier"}${note ? ` · ${String(note).slice(0, 80)}` : ""}`,
    webpath: "/purchaseorder", docmodel: "PurchaseOrder", docid: d._id,
  }).catch(() => {});
  return docShape("order", await loadSupplierDoc("order", id, partyid, adminid));
};

export const printToken = (kind: string, id: string, partyid: any, adminid: any) =>
  jwt.sign({ kind, id: String(id), p: String(partyid), a: String(adminid) }, PRINT_SECRET(), { expiresIn: "15m" });

const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const money = (n: any) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Printable HTML page for a supplier print link; null when the link is bad or expired. */
export const supplierPrintHtml = async (token: string): Promise<string | null> => {
  let t: any;
  try { t = jwt.verify(token, PRINT_SECRET()); } catch { return null; }
  const d = await loadSupplierDoc(t.kind, t.id, t.p, t.a).catch(() => null);
  if (!d) return null;
  const doc = await docShape(t.kind, d);
  const [admin, settings, party]: any[] = await Promise.all([
    Admin.findById(t.a).select("companyName address mobile email").lean(),
    AdminSettings.findOne({ adminid: t.a }).select("gstin").lean(),
    Account.findById(t.p).select("name mobile address city gstnumber").lean(),
  ]);
  const title = t.kind === "order" ? "Purchase Order" : "Purchase Bill";
  const rows = doc.lines.map((l: any, i: number) => `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td class="r">${l.qty} ${esc(l.unit || "")}</td><td class="r">${money(l.rate)}</td><td class="r">${l.discount ? money(l.discount) : "-"}</td><td class="r">${l.gst || 0}%</td><td class="r">${money(l.amount)}</td></tr>`).join("");
  const charges = doc.charges.map((c: any) => `<tr><td>${esc(c.name)}</td><td class="r">${money(c.amount)}</td></tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} ${esc(doc.billnumber || "")}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;margin:0;padding:24px;font-size:13px}.w{max-width:800px;margin:auto}h1{font-size:20px;margin:0}.muted{color:#64748b}.top{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:12px}.two{display:flex;justify-content:space-between;gap:16px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left}th{background:#f8fafc;font-size:12px}.r{text-align:right}.tot{width:300px;margin-left:auto;margin-top:12px}.tot td{border:0;padding:3px 8px}.big td{font-size:15px;font-weight:700;border-top:1px solid #0f172a}.bar{margin:16px auto;max-width:800px;text-align:right}.bar button{background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer}@media print{.bar{display:none}body{padding:0}}</style></head>
<body><div class="bar"><button onclick="window.print()">Print / Save PDF</button></div><div class="w">
<div class="top"><div><h1>${esc(admin?.companyName || "")}</h1><div class="muted">${esc(admin?.address || "")}</div><div class="muted">${esc(admin?.mobile || "")}${admin?.email ? ` · ${esc(admin.email)}` : ""}</div>${settings?.gstin ? `<div>GSTIN: ${esc(settings.gstin)}</div>` : ""}</div>
<div style="text-align:right"><h1>${title}</h1><div>No. <b>${esc(doc.billnumber || "-")}</b></div><div>Date: ${esc(doc.billdate || "-")}</div>${doc.duedate ? `<div>Due: ${esc(doc.duedate)}</div>` : ""}${doc.orderStatus ? `<div>Status: ${esc(doc.orderStatus)}</div>` : ""}</div></div>
<div class="two"><div><div class="muted">Supplier</div><b>${esc(party?.name || "")}</b><div>${esc([party?.address, party?.city].filter(Boolean).join(", "))}</div><div>${esc(party?.mobile || "")}</div>${party?.gstnumber ? `<div>GSTIN: ${esc(party.gstnumber)}</div>` : ""}</div></div>
<table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Disc.</th><th class="r">GST</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table class="tot"><tr><td>Subtotal</td><td class="r">${money(doc.subtotal)}</td></tr>${doc.totaldiscount ? `<tr><td>Discount</td><td class="r">-${money(doc.totaldiscount)}</td></tr>` : ""}<tr><td>GST</td><td class="r">${money(doc.totalgst)}</td></tr>${charges}${doc.roundoff ? `<tr><td>Round off</td><td class="r">${money(doc.roundoff)}</td></tr>` : ""}<tr class="big"><td>Total</td><td class="r">${money(doc.totalamount)}</td></tr>${doc.outstanding != null ? `<tr><td>Unpaid</td><td class="r">${money(doc.outstanding)}</td></tr>` : ""}</table>
${doc.notes ? `<p><b>Notes:</b> ${esc(doc.notes)}</p>` : ""}${doc.suppliernote ? `<p><b>Supplier note:</b> ${esc(doc.suppliernote)}</p>` : ""}
</div></body></html>`;
};

/** Tell a supplier (only when their portal login is on) about a document. */
export const notifySupplier = async (adminid: any, partyid: any, title: string, message: string, docmodel: string, docid: any, branchid?: any) => {
  try {
    if (!adminid || !partyid) return;
    const acc: any = await Account.findById(partyid).select("supplierlogin type").lean();
    if (acc?.supplierlogin !== true) return;
    await pushNotification({ adminid, branchid, targettype: "party", targetid: partyid, ntype: docmodel === "Payment" ? "payment" : "order", title, message, docmodel, docid });
  } catch { /* best-effort */ }
};

const idOf = (v: any) => (v && typeof v === "object" ? v._id || v.id : v);
const rupee = (n: any) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
const NOTIFY: Record<string, (r: any) => [string, string, string] | null> = {
  addPurchaseOrder: (r) => [`New purchase order ${r.billnumber || ""}`.trim(), `${rupee(r.totalamount)} · tap to see the items`, "PurchaseOrder"],
  confirmPurchaseOrder: (r) => [`Purchase order ${r.billnumber || ""} confirmed`.replace("  ", " "), rupee(r.totalamount), "PurchaseOrder"],
  markPurchaseOrderReceived: (r) => [`Purchase order ${r.billnumber || ""} received`.replace("  ", " "), "Goods received by the business", "PurchaseOrder"],
  cancelPurchaseOrder: (r) => [`Purchase order ${r.billnumber || ""} cancelled`.replace("  ", " "), r.cancelReason || "", "PurchaseOrder"],
  addPurchaseInvoice: (r) => [`New bill ${r.billnumber || ""} recorded`.replace("  ", " "), rupee(r.totalamount), "PurchaseInvoice"],
  addPayment: (r) => (r.type === "payment" ? [`Payment of ${rupee(r.amount)} made to you`, [r.paymentcode, r.mode].filter(Boolean).join(" · "), "Payment"] : null),
};

/** After these business mutations, tell the supplier (if their portal login is on). */
export const withSupplierNotify = (map: any) => {
  if (!map?.Mutation) return map;
  const Mutation = { ...map.Mutation };
  for (const field of Object.keys(NOTIFY)) {
    const fn = Mutation[field];
    if (typeof fn !== "function") continue;
    Mutation[field] = async (...args: any[]) => {
      const r = await fn(...args);
      try {
        const msg = r && NOTIFY[field](r);
        const party = r && (field === "addPayment" ? r.partyid : r.partyacc);
        if (msg && party) notifySupplier(idOf(r.adminid), idOf(party), msg[0], msg[1], msg[2], idOf(r.id || r._id), idOf(r.branchid)).catch(() => {});
      } catch { /* best-effort */ }
      return r;
    };
  }
  return { ...map, Mutation };
};
