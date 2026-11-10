import mongoose from "mongoose";
import { nextMainBillNumber } from "../../utils/billnumber";
import { ProductBranchStock } from "../productbranchstock";
import { ProductService } from "../products";
import { convertToBaseUnit } from "../../utils/unitconversation";

const { ObjectId } = mongoose.Schema.Types;
const tenant = {
  adminid: { type: ObjectId, ref: "Admin", required: true },
  branchid: { type: ObjectId, ref: "Branch" },
  clientRequestId: { type: String },
  createdby_name: { type: String },
  status: { type: Boolean, default: true },
  cleared: { type: Boolean },
};
// Walk-in customers are kept on the record when there is no party.
const customer = {
  partyacc: { type: ObjectId, ref: "Account" },
  customername: { type: String },
  customermobile: { type: String },
};
const lineSchema = new mongoose.Schema(
  {
    productserviceid: { type: ObjectId, ref: "ProductService" },
    variantid: { type: ObjectId },
    salesunitid: { type: ObjectId, ref: "Unit" },
    unitqty: { type: Number },
    description: { type: String },
    qty: { type: Number, required: true },
    rate: { type: Number },
    amount: { type: Number },
  },
  { _id: false }
);
const oncePerRequest = (s: mongoose.Schema) =>
  s.index({ adminid: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });

const appointmentSchema = new mongoose.Schema(
  {
    ...tenant,
    ...customer,
    staffid: { type: ObjectId, ref: "StaffAccount" },
    services: { type: [lineSchema], default: undefined },
    billdate: { type: String, required: true },
    // "HH:MM", 24 hour
    starttime: { type: String, required: true },
    duration: { type: Number },
    // booked, confirmed, arrived, done, noshow, cancelled
    apptStatus: { type: String, default: "booked" },
    membershipid: { type: ObjectId, ref: "Membership" },
    invoiceid: { type: ObjectId, ref: "SalesInvoice" },
    notes: { type: String },
    // Set while the services' materials are out of stock for this appointment.
    materialsapplied: { type: Boolean },
  },
  { timestamps: true }
);
oncePerRequest(appointmentSchema);
appointmentSchema.index({ adminid: 1, billdate: 1, staffid: 1 });

const jobCardSchema = new mongoose.Schema(
  {
    ...tenant,
    ...customer,
    billnumber: { type: String },
    offlineNumber: { type: String },
    billdate: { type: String, required: true },
    productserviceid: { type: ObjectId, ref: "ProductService" },
    devicename: { type: String },
    serial: { type: String },
    problem: { type: String },
    accessories: { type: String },
    estimate: { type: [lineSchema], default: undefined },
    estimatetotal: { type: Number },
    approved: { type: Boolean },
    approvedAt: { type: String },
    // Spares used: taken out of branch stock.
    spares: { type: [lineSchema], default: undefined },
    technicianid: { type: ObjectId, ref: "StaffAccount" },
    // received, diagnosing, waitingapproval, inprogress, ready, delivered, cancelled
    jobStatus: { type: String, default: "received" },
    promisedate: { type: String },
    deliveredAt: { type: Date },
    warrantydays: { type: Number },
    invoiceid: { type: ObjectId, ref: "SalesInvoice" },
    // The invoice made from it took the spares out of stock, so the card no longer holds them.
    stockreleased: { type: Boolean },
    notes: { type: String },
  },
  { timestamps: true }
);
jobCardSchema.pre("save", async function (next) {
  if (!this.billnumber) this.billnumber = await nextMainBillNumber("JobCard", this.adminid);
  next();
});
oncePerRequest(jobCardSchema);

const contractSchema = new mongoose.Schema(
  {
    ...tenant,
    partyacc: { type: ObjectId, ref: "Account", required: true },
    title: { type: String },
    // amc or warranty
    contractType: { type: String, default: "amc" },
    items: { type: [{ _id: false, productserviceid: { type: ObjectId, ref: "ProductService" }, serial: String, note: String }], default: undefined },
    startdate: { type: String, required: true },
    enddate: { type: String, required: true },
    visitsallowed: { type: Number },
    visitsdone: { type: Number },
    amount: { type: Number },
    // active or cancelled; expired is worked out from enddate
    contractStatus: { type: String, default: "active" },
    notes: { type: String },
  },
  { timestamps: true }
);
oncePerRequest(contractSchema);

const membershipPlanSchema = new mongoose.Schema(
  {
    ...tenant,
    name: { type: String, required: true },
    sessions: { type: Number },
    validitydays: { type: Number },
    price: { type: Number },
    services: { type: [{ type: ObjectId, ref: "ProductService" }], default: undefined },
    notes: { type: String },
  },
  { timestamps: true }
);
oncePerRequest(membershipPlanSchema);

const membershipSchema = new mongoose.Schema(
  {
    ...tenant,
    ...customer,
    planid: { type: ObjectId, ref: "MembershipPlan", required: true },
    startdate: { type: String, required: true },
    enddate: { type: String },
    sessions: { type: Number },
    amount: { type: Number },
    // active or cancelled
    memberStatus: { type: String, default: "active" },
    notes: { type: String },
  },
  { timestamps: true }
);
oncePerRequest(membershipSchema);

/** Spares of a job card: sign -1 takes them out of branch stock, +1 puts them back. */
export async function moveJobCardStock(doc: any, sign: 1 | -1) {
  for (const item of doc?.spares || []) {
    if (!item.productserviceid) continue;
    const product: any = await ProductService.findById(item.productserviceid).select("productvariants isservice").lean();
    if (!product || product.isservice) continue;
    const variant = product.productvariants?.find((v: any) => String(v._id) === String(item.variantid));
    const qtyBase = convertToBaseUnit(Number(item.qty) * Number(item.unitqty || 1), item.salesunitid, variant);
    const key = { productid: item.productserviceid, variantid: item.variantid, branchid: doc.branchid };
    const stock: any = await ProductBranchStock.findOne(key).lean();
    const avg = Number(stock?.averagecost || 0);
    const next = Number(stock?.currentstock || 0) + sign * qtyBase;
    await ProductBranchStock.updateOne(
      key,
      { $set: { currentstock: next, currentstockamount: next * avg, closingstock: next, closingstockamount: next * avg, adminid: doc.adminid }, $setOnInsert: { openingstock: 0 } },
      { upsert: true }
    );
  }
}

/** Service variant of each line (null when not a service). */
export async function serviceVariants(lines: any[] = []) {
  const out: any[] = [];
  for (const l of lines) {
    const p: any = l?.productserviceid ? await ProductService.findById(l.productserviceid).select("isservice servicevariants").lean() : null;
    out.push(p?.isservice ? p.servicevariants?.find((v: any) => String(v._id) === String(l.variantid)) || p.servicevariants?.[0] || null : null);
  }
  return out;
}

/** Materials a done appointment uses (per service, times its qty); sign -1 takes them out, +1 puts them back. */
export async function moveAppointmentMaterials(appt: any, sign: 1 | -1) {
  if (!appt?.branchid) return;
  const variants = await serviceVariants(appt.services || []);
  const spares: any[] = [];
  (appt.services || []).forEach((l: any, i: number) => {
    for (const m of variants[i]?.materials || []) spares.push({ ...m, qty: Number(m.qty || 0) * (Number(l.qty) || 1) });
  });
  await moveJobCardStock({ spares, branchid: appt.branchid, adminid: appt.adminid }, sign);
}

export const Appointment = mongoose.model("Appointment", appointmentSchema);
export const JobCard = mongoose.model("JobCard", jobCardSchema);
export const Contract = mongoose.model("Contract", contractSchema);
export const MembershipPlan = mongoose.model("MembershipPlan", membershipPlanSchema);
export const Membership = mongoose.model("Membership", membershipSchema);
