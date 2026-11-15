import jwt from "jsonwebtoken";
import cron from "node-cron";
import { Types } from "mongoose";
import { Account } from "../../models/accounts";
import { Admin } from "../../models/admin";
import { AdminSettings } from "../../models/adminsettings";
import { Appointment, Contract, JobCard, Membership } from "../../models/service";
import { pushNotification } from "../../models/notifications";
import { TenantError } from "../tenant";
import { istDate } from "../ist";
import { dmy } from "../supplierdocs";
import { amountInWords, billBody, billHtml, companyOf, esc, f2, printOptions } from "../billprint";

export const JOB_LABEL: Record<string, string> = {
  received: "Received", diagnosing: "Diagnosing", waitingapproval: "Waiting Approval", inprogress: "In Progress", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
};
const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
const iso = (d: any) => (d ? new Date(d).toISOString() : null);
const jobNo = (j: any) => { const n = String(j?.billnumber || ""); return n.startsWith("JC-") ? n : `JC-${n}`; };
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

export const JOB_POPULATE: any[] = [{ path: "technicianid", select: "name" }, { path: "productserviceid", select: "name" }, { path: "estimate.productserviceid", select: "name" }];

export const jobShape = (j: any) => {
  const estimate = (j.estimate || []).map((l: any) => ({
    name: [l.productserviceid?.name, l.description].filter(Boolean).join(" - ") || "Item",
    qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, amount: r2(l.amount ?? Number(l.qty) * Number(l.rate)),
  }));
  const total = r2(j.estimatetotal ?? estimate.reduce((t: number, l: any) => t + l.amount, 0));
  const delivered = j.deliveredAt ? new Date(j.deliveredAt) : null;
  return {
    id: String(j._id), billnumber: jobNo(j), billdate: j.billdate,
    device: j.productserviceid?.name || j.devicename || null, serial: j.serial || null, problem: j.problem || null, accessories: j.accessories || null,
    jobStatus: j.jobStatus || "received", promisedate: j.promisedate || null,
    estimate, estimatetotal: total, approved: typeof j.approved === "boolean" ? j.approved : null, approvedAt: j.approvedAt || null,
    canApprove: total > 0 && j.approved !== true && !["delivered", "cancelled", "ready"].includes(j.jobStatus) && !j.invoiceid,
    technician: j.technicianid?.name || null, warrantydays: j.warrantydays || null,
    warrantyTill: delivered && j.warrantydays ? addDays(new Date(delivered.getTime() + 330 * 60000).toISOString().slice(0, 10), Number(j.warrantydays)) : null,
    deliveredAt: iso(j.deliveredAt), notes: j.notes || null, billed: !!j.invoiceid,
  };
};

export const contractShape = (c: any, today = istDate()) => {
  const daysleft = daysBetween(today, c.enddate);
  const state = c.contractStatus === "cancelled" ? "cancelled" : daysleft < 0 ? "expired" : daysleft <= 30 ? "expiring" : "active";
  return {
    id: String(c._id), title: c.title || null, contractType: c.contractType || "amc", startdate: c.startdate, enddate: c.enddate,
    daysleft, state, visitsallowed: c.visitsallowed ?? null, visitsdone: c.visitsdone ?? null, amount: c.amount ?? null,
    items: (c.items || []).map((i: any) => ({ name: i.productserviceid?.name || null, serial: i.serial || null, note: i.note || null })), notes: c.notes || null,
  };
};

export const membershipShape = async (m: any, today = istDate()) => {
  const visits: any[] = await Appointment.find({ membershipid: m._id, status: true }).sort({ billdate: -1, starttime: -1 }).limit(100)
    .populate("services.productserviceid", "name").lean();
  const used = visits.filter((v) => v.apptStatus === "done").length;
  const daysleft = m.enddate ? daysBetween(today, m.enddate) : null;
  const left = m.sessions ? Math.max(0, m.sessions - used) : null;
  const state = m.memberStatus === "cancelled" ? "cancelled" : daysleft != null && daysleft < 0 ? "expired" : left === 0 ? "used" : daysleft != null && daysleft <= 15 ? "expiring" : "active";
  return {
    id: String(m._id), plan: m.planid?.name || "Membership", startdate: m.startdate, enddate: m.enddate || null, daysleft, state,
    sessions: m.sessions ?? null, sessionsused: used, sessionsleft: left, amount: m.amount ?? null,
    services: (m.planid?.services || []).map((s: any) => s?.name).filter(Boolean), notes: m.notes || null,
    visits: visits.map((v) => ({ id: String(v._id), billdate: v.billdate, starttime: v.starttime || null, apptStatus: v.apptStatus || "booked",
      service: (v.services || []).map((l: any) => l.productserviceid?.name).filter(Boolean).join(", ") || null })),
  };
};

/** The customer's own job card, or not found. */
export const myJob = async (id: any, partyid: any, adminid: any) => {
  if (!Types.ObjectId.isValid(String(id))) throw new TenantError("Repair job not found.", "NOT_FOUND");
  const j: any = await JobCard.findOne({ _id: id, adminid, partyacc: partyid, status: true }).populate(JOB_POPULATE).lean();
  if (!j) throw new TenantError("Repair job not found.", "NOT_FOUND");
  return j;
};

const PRINT_SECRET = () => `${process.env.JWT_ACCESS_SECRET}:job-print`;
export const jobPrintToken = (id: any, partyid: any, adminid: any) =>
  jwt.sign({ id: String(id), p: String(partyid), a: String(adminid) }, PRINT_SECRET(), { expiresIn: "15m" });

/** Job sheet in the common bill layout, for a print link; null when the link is bad or expired. */
export const jobSheetHtml = async (token: string): Promise<string | null> => {
  let t: any;
  try { t = jwt.verify(token, PRINT_SECRET()); } catch { return null; }
  const j: any = await myJob(t.id, t.p, t.a).catch(() => null);
  if (!j) return null;
  const [admin, st, party]: any[] = await Promise.all([
    Admin.findById(t.a).select("companyName address mobile").lean(),
    AdminSettings.findOne({ adminid: t.a }).lean(),
    Account.findById(t.p).select("name mobile city").lean(),
  ]);
  const opts = printOptions(st);
  const seller = companyOf(admin, st);
  if (st?.legalName) seller.name = st.legalName;
  const lines = j.estimate || [];
  const amountOf = (l: any) => Number(l.amount ?? Number(l.qty) * Number(l.rate)) || 0;
  const total = Number(j.estimatetotal ?? lines.reduce((a: number, l: any) => a + amountOf(l), 0)) || 0;
  const customer = [party?.name, party?.mobile, party?.city].map((x) => String(x || "").trim()).filter(Boolean).join(" - ");
  const body = billBody({
    title: "JOB SHEET", memo: `Status: ${JOB_LABEL[j.jobStatus] || "Received"}`,
    company: seller, showHeader: opts.showHeader,
    cells: [
      ["M/S.", esc(customer || "---")], ["Job No.", esc(jobNo(j))], ["Date", esc(dmy(j.billdate))],
      ["Device / Item", esc(j.productserviceid?.name || j.devicename || "---")], ["Serial / IMEI", esc(j.serial || "---")], ["Promised Date", esc(j.promisedate ? dmy(j.promisedate) : "---")],
      ["Technician", esc(j.technicianid?.name || "---")], ["Estimate Approved", j.approved ? `Yes${j.approvedAt ? ` (${esc(dmy(String(j.approvedAt).slice(0, 10)))})` : ""}` : "No"], ["Warranty on Repair", esc(j.warrantydays ? `${j.warrantydays} days` : "---")],
      ["Problem Reported", esc(j.problem || "---")], ["Accessories Received", esc(j.accessories || "---")], ["Delivered On", esc(j.deliveredAt ? dmy(new Date(new Date(j.deliveredAt).getTime() + 330 * 60000).toISOString().slice(0, 10)) : "---")],
    ],
    columns: [{ label: "Sr", align: "c", width: "6%" }, { label: "Estimate - Item / Work", align: "l" }, { label: "Qty", align: "c", width: "10%" }, { label: "Rate", align: "r", width: "14%" }, { label: "Amount", align: "r", width: "16%" }],
    rows: lines.map((l: any, i: number) => [String(i + 1), `${esc(l.productserviceid?.name || l.description || "")}${l.productserviceid?.name && l.description ? ` - ${esc(l.description)}` : ""}`, esc(l.qty), f2(l.rate), f2(amountOf(l))]),
    grand: lines.length ? ["Estimate Total", f2(total)] : undefined,
    words: lines.length ? amountInWords(total) : "",
    extra: j.notes ? `<strong>Notes:</strong> ${esc(j.notes)}` : "",
    signLeft: "Customer Signature",
    signCompany: opts.signCompany ? seller.name : null,
  });
  return billHtml(jobNo(j), [body]);
};

const tell = (adminid: any, partyid: any, title: string, message: string, docmodel: string, docid: any, ntype = "service") =>
  partyid ? pushNotification({ adminid, targettype: "party", targetid: partyid, ntype, title, message, docmodel, docid }).catch(() => {}) : null;
const idOf = (v: any) => (v && typeof v === "object" ? v.id || v._id : v);
const rupee = (n: any) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

const NOTIFY: Record<string, (r: any) => [string, string] | null> = {
  addJobCard: (r) => [`Repair job ${jobNo(r)} received`, [r.productserviceid?.name || r.devicename, r.problem].filter(Boolean).join(" · ")],
  setJobCardStatus: (r) => r.jobStatus === "waitingapproval"
    ? [`Estimate ${rupee(r.estimatetotal)} for ${jobNo(r)}`, "Please approve or reject it in My Repairs"]
    : [`Your repair ${jobNo(r)} is ${JOB_LABEL[r.jobStatus] || r.jobStatus}`, r.jobStatus === "ready" ? "You can collect it now" : r.productserviceid?.name || r.devicename || ""],
  addContract: (r) => [`${r.contractType === "warranty" ? "Warranty" : "AMC"} added${r.title ? `: ${r.title}` : ""}`, `Valid till ${dmy(r.enddate)}`],
  addMembership: (r) => [`Membership started: ${r.planid?.name || "plan"}`, r.enddate ? `Valid till ${dmy(r.enddate)}` : ""],
  addTailorOrder: (r) => [`Stitching order TO-${r.billnumber} received`, [(r.items || []).map((i: any) => `${i.qty} ${i.garment}`).join(", "), r.deliverydate && `Delivery ${dmy(r.deliverydate)}`].filter(Boolean).join(" · ")],
  setTailorOrderStatus: (r) => (["trial", "ready", "delivered", "cancelled"].includes(r.orderStatus)
    ? [`Your order TO-${r.billnumber} is ${({ trial: "ready for trial", ready: "ready to collect", delivered: "delivered", cancelled: "cancelled" } as any)[r.orderStatus]}`,
      r.orderStatus === "trial" && r.trialdate ? `Trial on ${dmy(r.trialdate)}` : (r.items || []).map((i: any) => `${i.qty} ${i.garment}`).join(", ")]
    : null),
};

/** After these service mutations, tell the customer the record belongs to. */
export const withCustomerNotify = (map: any) => {
  if (!map?.Mutation) return map;
  const Mutation = { ...map.Mutation };
  for (const field of Object.keys(NOTIFY)) {
    const fn = Mutation[field];
    if (typeof fn !== "function") continue;
    Mutation[field] = async (...args: any[]) => {
      const r = await fn(...args);
      try {
        const party = idOf(r?.partyacc);
        const msg = party && NOTIFY[field](r);
        const model = field.includes("JobCard") ? "JobCard" : field.includes("Contract") ? "Contract" : field.includes("TailorOrder") ? "TailorOrder" : "Membership";
        if (msg) tell(idOf(r.adminid), party, msg[0], msg[1], model, idOf(r.id));
      } catch { /* best-effort */ }
      return r;
    };
  }
  return { ...map, Mutation };
};

/** Daily: remind customers 15, 7 and 1 day before an AMC / warranty or membership ends. */
export const startServiceReminderScheduler = () => {
  cron.schedule("23 10 * * *", async () => {
    try {
      const today = istDate();
      const days = [15, 7, 1];
      const ends = days.map((d) => addDays(today, d));
      const contracts: any[] = await Contract.find({ status: true, contractStatus: { $ne: "cancelled" }, enddate: { $in: ends }, partyacc: { $ne: null } }).lean();
      for (const c of contracts) {
        const left = daysBetween(today, c.enddate);
        tell(c.adminid, c.partyacc, `${c.contractType === "warranty" ? "Warranty" : "AMC"} ends in ${left} day${left === 1 ? "" : "s"}`, `${c.title || ""} · till ${dmy(c.enddate)}. Contact us to renew.`.replace(/^ · /, ""), "Contract", c._id);
      }
      const members: any[] = await Membership.find({ status: true, memberStatus: { $ne: "cancelled" }, enddate: { $in: ends }, partyacc: { $ne: null } }).populate("planid", "name").lean();
      for (const m of members) {
        const left = daysBetween(today, m.enddate);
        tell(m.adminid, m.partyacc, `Membership ends in ${left} day${left === 1 ? "" : "s"}`, `${m.planid?.name || "Membership"} · till ${dmy(m.enddate)}. Contact us to renew.`, "Membership", m._id);
      }
    } catch (e) {
      console.error("service reminders failed:", e);
    }
  }, { timezone: "Asia/Kolkata" });
};
