import { Appointment, Contract, JobCard, Membership, MembershipPlan, moveAppointmentMaterials, moveJobCardStock, serviceVariants } from "../../../models/service";
import { Account } from "../../../models/accounts";
import { ProductService } from "../../../models/products";
import { StaffAccount } from "../../../models/staffaccounts";
import { AdminSettings } from "../../../models/adminsettings";
import { SalesInvoice } from "../../../models/salesinvoice";
import { TenantError, assertOwnedIds, requireBackofficeTenant } from "../../../utils/tenant";
import { activeFilters, containsRx, dmyFromText, notCleared, pageWindow, textMatch } from "../../../utils/listquery";
import { assertSalesStockAvailable } from "../../../utils/stockguard";
import { assertModuleOn } from "../../../utils/modulegate";
import { isActionAllowed } from "../../../utils/permissiongate";
import { createOnce, dropDeviceNumber, isoOf, raiseDeviceSeq, takeDeviceNumber } from "../../../utils/offlinesync";

const PARTY = { path: "partyacc", select: "name mobile city state address gstnumber" };
const lineRefs = (p: string) => [
  { path: `${p}.productserviceid`, select: "name productvariants._id productvariants.name" },
  { path: `${p}.salesunitid`, select: "unitname" },
];
export const appointmentPopulate: any[] = [PARTY, { path: "staffid", select: "name" }, ...lineRefs("services")];
export const jobCardPopulate: any[] = [PARTY, { path: "technicianid", select: "name" }, { path: "productserviceid", select: "name" }, ...lineRefs("estimate"), ...lineRefs("spares")];
export const contractPopulate: any[] = [PARTY, { path: "items.productserviceid", select: "name" }];
export const planPopulate: any[] = [{ path: "services", select: "name" }];
export const membershipPopulate: any[] = [PARTY, { path: "planid", select: "name" }];

const sid = (v: any) => (v ? String(v._id ?? v) : null);
const ref = (d: any, key = "name") => (d ? { id: String(d._id ?? d), name: d[key] ?? null } : null);
const party = (p: any) => (p ? { id: String(p._id ?? p), name: p.name ?? null, mobile: p.mobile ?? null, city: p.city ?? null, state: p.state ?? null, address: p.address ?? null, gstnumber: p.gstnumber ?? null } : null);
const line = (l: any) => {
  const v = l.productserviceid?.productvariants?.find((x: any) => String(x._id) === String(l.variantid));
  return { ...l, productserviceid: ref(l.productserviceid), variantid: l.variantid ? { id: String(l.variantid), name: v?.name ?? null } : null, salesunitid: ref(l.salesunitid, "unitname") };
};
const base = (d: any) => ({ ...d, id: String(d._id), adminid: sid(d.adminid), branchid: sid(d.branchid), createdAt: isoOf(d.createdAt), updatedAt: isoOf(d.updatedAt) });

export const formatAppointment = (d: any) => ({
  ...base(d), partyacc: party(d.partyacc), staffid: ref(d.staffid), services: (d.services || []).map(line), membershipid: sid(d.membershipid), invoiceid: sid(d.invoiceid),
});
export const formatJobCard = (d: any) => ({
  ...base(d), partyacc: party(d.partyacc), technicianid: ref(d.technicianid), productserviceid: ref(d.productserviceid),
  estimate: (d.estimate || []).map(line), spares: (d.spares || []).map(line), invoiceid: sid(d.invoiceid), deliveredAt: isoOf(d.deliveredAt),
});
export const formatContract = (d: any) => ({
  ...base(d), partyacc: party(d.partyacc), items: (d.items || []).map((i: any) => ({ ...i, productserviceid: ref(i.productserviceid) })),
});
export const formatPlan = (d: any) => ({ ...base(d), services: (d.services || []).map((s: any) => ref(s)) });
export const formatMembership = (d: any) => ({ ...base(d), partyacc: party(d.partyacc), planid: ref(d.planid) });

/** Tenant + branch scope (the sync pull uses it without status). */
export const buildServiceQuery = (scope: { adminid: any; branchid?: any }, filter: any = {}, dateField = "billdate") => {
  const q: any = { adminid: scope.adminid, status: true };
  const b = scope.branchid || filter?.branchid;
  // Saved with no branch (All Branches): shows in every branch.
  if (b) q.$and = [{ $or: [{ branchid: b }, { branchid: null }] }];
  if (filter?.staffid) q.staffid = filter.staffid;
  if (filter?.partyacc) q.partyacc = filter.partyacc;
  if (filter?.billdateFrom || filter?.billdateTo) {
    q[dateField] = {};
    if (filter.billdateFrom) q[dateField].$gte = String(filter.billdateFrom).slice(0, 10);
    if (filter.billdateTo) q[dateField].$lte = `${String(filter.billdateTo).slice(0, 10)}￿`;
  }
  return q;
};

const LABEL: Record<string, string> = { appointments: "Appointments", jobcards: "Job Cards", contracts: "AMC / Warranty", memberships: "Memberships" };

async function gate(context: any, module: string, action: string) {
  const scope = await requireBackofficeTenant(context);
  const where = {
    adminid: scope.adminid,
    branchid: scope.userType === "admin" ? undefined : scope.branchid,
    staffid: scope.userType === "staff" ? scope.userId : undefined,
  };
  await assertModuleOn(module, LABEL[module], where);
  if (!(await isActionAllowed(module, action, where))) throw new TenantError(`You do not have permission for this ${LABEL[module]} action.`);
  return scope;
}

async function own(model: any, id: string, context: any, module: string, action: string) {
  const scope = await gate(context, module, action);
  const d: any = await model.findById(id).lean();
  if (!d || String(d.adminid) !== String(scope.adminid)) throw new TenantError("Entry not found.", "BAD_USER_INPUT");
  return { scope, d };
}

const userName = (context: any) => context?.user?.name || context?.user?.email;
const itemIds = (...groups: any[][]) => groups.flat().filter(Boolean).map((l: any) => l.productserviceid);

async function checkCustomer(input: any, scope: any, partyRequired = false) {
  if (input.partyacc) await assertOwnedIds(Account, [input.partyacc], scope.adminid, "Party");
  else if (partyRequired) throw new Error("Pick a party.");
  else if (input.customername !== undefined && !String(input.customername || "").trim()) throw new Error("Pick a party or type the customer name.");
}

// ---------- Paged lists ----------

type Clause = (term: string, adminid: any) => Promise<any | null> | any | null;
const partyClause = (withWalkIn = true): Clause => async (term, adminid) => {
  const ids = await Account.find({ admin: adminid, $or: [{ name: containsRx(term) }, { mobile: containsRx(term) }, { city: containsRx(term) }] }).select("_id").limit(500).lean();
  const or: any[] = [{ partyacc: { $in: ids.map((a: any) => a._id) } }];
  if (withWalkIn) or.push({ customername: containsRx(term) }, { customermobile: containsRx(term) });
  return { $or: or };
};
const labelClause = (field: string, labels: Record<string, string>): Clause => (term) => ({
  [field]: { $in: Object.keys(labels).filter((k) => containsRx(term).test(labels[k]) || containsRx(term).test(k)) },
});
const dateClause = (field: string): Clause => (term) => textMatch(dmyFromText(`$${field}`), term);
const textClause = (field: string): Clause => (term) => ({ [field]: containsRx(term) });
const staffClause = (field: string): Clause => async (term, adminid) => {
  const ids = await StaffAccount.find({ admin: adminid, name: containsRx(term) }).select("_id").limit(200).lean();
  return { [field]: { $in: ids.map((s: any) => s._id) } };
};
const amountClause = (field: string): Clause => (term) => textMatch({ $toString: `$${field}` }, term);

export const APPT_STATUS: Record<string, string> = { booked: "Booked", confirmed: "Confirmed", arrived: "Arrived", done: "Done", noshow: "No Show", cancelled: "Cancelled" };
export const JOB_STATUS: Record<string, string> = {
  received: "Received", diagnosing: "Diagnosing", waitingapproval: "Waiting Approval", inprogress: "In Progress", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
};

const COLUMNS: Record<string, Record<string, Clause>> = {
  appointments: {
    services: async (t, adminid) => ({ "services.productserviceid": { $in: (await ProductService.find({ adminid, name: containsRx(t) }).select("_id").limit(500).lean()).map((p: any) => p._id) } }),
    customer: partyClause(), billdate: dateClause("billdate"), starttime: textClause("starttime"), staff: staffClause("staffid"), apptStatus: labelClause("apptStatus", APPT_STATUS), notes: textClause("notes") },
  jobcards: {
    billnumber: (t) => ({ $or: [{ billnumber: containsRx(t.replace(/^JC-?/i, "")) }, { offlineNumber: containsRx(t) }] }),
    customer: partyClause(), billdate: dateClause("billdate"), device: (t) => ({ $or: [{ devicename: containsRx(t) }, { serial: containsRx(t) }] }),
    problem: textClause("problem"), technician: staffClause("technicianid"), jobStatus: labelClause("jobStatus", JOB_STATUS), promisedate: dateClause("promisedate"), estimatetotal: amountClause("estimatetotal"),
  },
  contracts: {
    customer: partyClause(false), title: textClause("title"), contractType: labelClause("contractType", { amc: "AMC", warranty: "Warranty" }),
    startdate: dateClause("startdate"), enddate: dateClause("enddate"), amount: amountClause("amount"),
  },
  memberships: {
    plan: async (t, adminid) => ({ planid: { $in: (await MembershipPlan.find({ adminid, name: containsRx(t) }).select("_id").limit(200).lean()).map((p: any) => p._id) } }),
    customer: partyClause(), startdate: dateClause("startdate"), enddate: dateClause("enddate"), amount: amountClause("amount") },
};

async function pageOf(model: any, module: string, populate: any[], format: (d: any) => any, scope: any, args: any, dateField = "billdate") {
  const { filter = {}, page = 1, pageSize = 10, search = "", columnFilters = [] } = args || {};
  const cols = COLUMNS[module];
  const clauses: any[] = [buildServiceQuery(scope, filter, dateField)];
  const term = String(search || "").trim();
  if (term) {
    const any: any[] = [];
    for (const fn of Object.values(cols)) {
      const c = await fn(term, scope.adminid);
      if (c) any.push(c);
    }
    clauses.push({ $or: any });
  }
  for (const f of activeFilters(columnFilters)) {
    // The lists name the customer column "partyacc" (two-line party cell).
    const key = f.key === "partyacc" ? "customer" : f.key;
    const c = cols[key] ? await cols[key](f.value, scope.adminid) : null;
    if (c) clauses.push(c);
  }
  const query = { $and: clauses };
  const { skip, limit } = pageWindow(page, pageSize);
  const [total, rows] = await Promise.all([
    model.countDocuments(query),
    model.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(populate).lean(),
  ]);
  return { items: rows.map(format), total };
}

const listOf = async (model: any, populate: any[], format: (d: any) => any, scope: any, filter: any, sort: any, dateField = "billdate") =>
  (await model.find(buildServiceQuery(scope, filter, dateField)).sort(sort).populate(populate).lean()).map(format);
const deletedOf = async (model: any, populate: any[], format: (d: any) => any, scope: any, filter: any) =>
  (await model.find({ ...buildServiceQuery(scope, filter), status: false, ...notCleared }).sort({ updatedAt: -1 }).populate(populate).lean()).map(format);
const byIdOf = async (model: any, populate: any[], format: (d: any) => any, scope: any, id: string) => {
  const d: any = await model.findById(id).populate(populate).lean();
  return d && String(d.adminid) === String(scope.adminid) ? format(d) : null;
};
const load = (model: any, populate: any[], format: (d: any) => any) => async (id: any) => {
  const d: any = await model.findById(id).populate(populate).lean();
  return d ? format(d) : null;
};
const loadAppointment = load(Appointment, appointmentPopulate, formatAppointment);
const loadJobCard = load(JobCard, jobCardPopulate, formatJobCard);
const loadContract = load(Contract, contractPopulate, formatContract);
const loadPlan = load(MembershipPlan, planPopulate, formatPlan);
const loadMembership = load(Membership, membershipPopulate, formatMembership);

// ---------- Rules ----------

const minutesOf = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/** Buffer after, and how many bookings one staff member can take together (classes), from the services. */
async function slotRules(services: any[] = []) {
  const vs = (await serviceVariants(services)).filter(Boolean);
  const buffer = Math.max(0, ...vs.map((v: any) => Number(v.bufferminutes) || 0));
  const caps = vs.map((v: any) => Number(v.capacity) || 1);
  return { buffer, capacity: caps.length ? Math.min(...caps) : 1 };
}

/** One staff member cannot have more live overlapping appointments than the services allow (usually one). */
async function assertSlotFree(adminid: any, a: any, exceptId?: any) {
  if (!a.staffid) return;
  const start = minutesOf(a.starttime);
  if (Number.isNaN(start)) throw new Error("Start time must be HH:MM.");
  const mine = await slotRules(a.services);
  const end = start + (Number(a.duration) || 30) + mine.buffer;
  const others: any[] = await Appointment.find({
    adminid, staffid: a.staffid, billdate: a.billdate, status: true, apptStatus: { $nin: ["cancelled", "noshow"] }, ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  }).select("starttime duration services").lean();
  const clashes: any[] = [];
  for (const o of others) {
    const s = minutesOf(o.starttime);
    const theirs = await slotRules(o.services);
    if (s < end && start < s + (Number(o.duration) || 30) + theirs.buffer) clashes.push(o);
  }
  if (clashes.length >= mine.capacity) throw new Error(`This staff member is already booked at ${clashes[0].starttime} on that day.`);
}

async function checkAppointment(input: any, scope: any, exceptId?: any) {
  await checkCustomer(input, scope);
  if (input.staffid) await assertOwnedIds(StaffAccount, [input.staffid], scope.adminid, "Staff");
  const ids = itemIds(input.services || []);
  if (ids.length) await assertOwnedIds(ProductService, ids, scope.adminid, "Service", "adminid");
  if (input.membershipid) await assertOwnedIds(Membership, [input.membershipid], scope.adminid, "Membership", "adminid");
  await assertSlotFree(scope.adminid, input, exceptId);
}

const sessionsUsed = (membershipid: any, exceptId?: any) =>
  Appointment.countDocuments({ membershipid, status: true, apptStatus: "done", ...(exceptId ? { _id: { $ne: exceptId } } : {}) });

/** A done appointment on a membership uses one session, within its dates and count. */
async function assertSessionLeft(appt: any) {
  if (!appt.membershipid) return;
  const m: any = await Membership.findById(appt.membershipid).lean();
  if (!m || !m.status || m.memberStatus === "cancelled") throw new Error("The membership is not active.");
  if (m.enddate && appt.billdate > m.enddate) throw new Error("The membership has expired.");
  if (m.sessions && (await sessionsUsed(m._id, appt._id)) >= m.sessions) throw new Error("No sessions left on this membership.");
}

async function guardSpares(scope: any, branchid: any, spares: any[], old?: any) {
  const settings: any = await AdminSettings.getOrCreateForAdmin(scope.adminid);
  if (settings?.allowNegativeStock === true) return;
  await assertSalesStockAvailable({ adminid: scope.adminid, branchid, productservice: spares.filter((l) => l.productserviceid), oldInv: old ? { productservice: (old.spares || []).filter((l: any) => l.productserviceid) } : undefined });
}

async function checkJobCard(input: any, scope: any) {
  await checkCustomer(input, scope);
  if (input.technicianid) await assertOwnedIds(StaffAccount, [input.technicianid], scope.adminid, "Technician");
  const ids = [input.productserviceid, ...itemIds(input.estimate || [], input.spares || [])].filter(Boolean);
  if (ids.length) await assertOwnedIds(ProductService, ids, scope.adminid, "Item", "adminid");
}

const addWith = (model: any, loader: (id: any) => Promise<any>, run: (input: any, context: any) => Promise<any>) => (_: any, { input }: any, context: any) =>
  createOnce(
    context,
    input,
    async (adminid, req) => {
      const d: any = await model.findOne({ adminid, clientRequestId: req }).select("_id").lean();
      return d ? loader(d._id) : null;
    },
    () => run(input, context)
  );

const softDelete = (model: any, module: string) => async (_: any, { id }: any, context: any) => {
  const { d } = await own(model, id, context, module, "delete");
  await model.updateOne({ _id: d._id }, { $set: { status: false } });
  return true;
};
const restore = (model: any, module: string) => async (_: any, { id }: any, context: any) => {
  const { d } = await own(model, id, context, module, "reset");
  await model.updateOne({ _id: d._id }, { $set: { status: true } });
  return true;
};

const tenantOnly = (fn: (scope: any, args: any) => Promise<any>) => async (_: any, args: any, context: any) => fn(await requireBackofficeTenant(context), args || {});

export const serviceResolvers = {
  Query: {
    getAppointments: tenantOnly((s, a) => listOf(Appointment, appointmentPopulate, formatAppointment, s, a.filter, { billdate: 1, starttime: 1 })),
    getAppointmentsPage: tenantOnly((s, a) => pageOf(Appointment, "appointments", appointmentPopulate, formatAppointment, s, a)),
    getDeletedAppointments: tenantOnly((s, a) => deletedOf(Appointment, appointmentPopulate, formatAppointment, s, a.filter)),
    getAppointmentById: tenantOnly((s, a) => byIdOf(Appointment, appointmentPopulate, formatAppointment, s, a.id)),
    getJobCards: tenantOnly((s, a) => listOf(JobCard, jobCardPopulate, formatJobCard, s, a.filter, { billdate: -1, _id: -1 })),
    getJobCardsPage: tenantOnly((s, a) => pageOf(JobCard, "jobcards", jobCardPopulate, formatJobCard, s, a)),
    getDeletedJobCards: tenantOnly((s, a) => deletedOf(JobCard, jobCardPopulate, formatJobCard, s, a.filter)),
    getJobCardById: tenantOnly((s, a) => byIdOf(JobCard, jobCardPopulate, formatJobCard, s, a.id)),
    getContracts: tenantOnly((s, a) => listOf(Contract, contractPopulate, formatContract, s, a.filter, { enddate: 1 }, "startdate")),
    getContractsPage: tenantOnly((s, a) => pageOf(Contract, "contracts", contractPopulate, formatContract, s, a, "startdate")),
    getDeletedContracts: tenantOnly((s, a) => deletedOf(Contract, contractPopulate, formatContract, s, a.filter)),
    getContractById: tenantOnly((s, a) => byIdOf(Contract, contractPopulate, formatContract, s, a.id)),
    getMembershipPlans: tenantOnly(async (s) => (await MembershipPlan.find({ adminid: s.adminid, status: true }).sort({ name: 1 }).populate(planPopulate).lean()).map(formatPlan)),
    getDeletedMembershipPlans: tenantOnly(async (s) => (await MembershipPlan.find({ adminid: s.adminid, status: false, ...notCleared }).populate(planPopulate).lean()).map(formatPlan)),
    getMembershipPlanById: tenantOnly((s, a) => byIdOf(MembershipPlan, planPopulate, formatPlan, s, a.id)),
    getMemberships: tenantOnly((s, a) => listOf(Membership, membershipPopulate, formatMembership, s, a.filter, { startdate: -1 }, "startdate")),
    getMembershipsPage: tenantOnly((s, a) => pageOf(Membership, "memberships", membershipPopulate, formatMembership, s, a, "startdate")),
    getDeletedMemberships: tenantOnly((s, a) => deletedOf(Membership, membershipPopulate, formatMembership, s, a.filter)),
    getMembershipById: tenantOnly((s, a) => byIdOf(Membership, membershipPopulate, formatMembership, s, a.id)),
  },

  Mutation: {
    addAppointment: addWith(Appointment, loadAppointment, async (input, context) => {
      const scope = await gate(context, "appointments", "add");
      const data: any = { ...input, branchid: scope.branchid || input.branchid || undefined };
      await checkAppointment({ ...data, adminid: scope.adminid }, scope);
      const created: any = await Appointment.create({ ...data, adminid: scope.adminid, apptStatus: "booked", createdby_name: userName(context) });
      return loadAppointment(created._id);
    }),
    editAppointment: async (_: any, { id, input }: any, context: any) => {
      const { scope, d } = await own(Appointment, id, context, "appointments", "edit");
      const { clientRequestId, branchid, ...patch } = input;
      await checkAppointment({ ...d, ...patch }, scope, d._id);
      if (d.apptStatus === "done") await assertSessionLeft({ ...d, ...patch });
      if (d.materialsapplied) await moveAppointmentMaterials(d, 1);
      await Appointment.updateOne({ _id: d._id }, { $set: patch });
      if (d.materialsapplied) await moveAppointmentMaterials({ ...d, ...patch }, -1);
      return loadAppointment(d._id);
    },
    setAppointmentStatus: async (_: any, { id, apptStatus, invoiceid }: any, context: any) => {
      const { d } = await own(Appointment, id, context, "appointments", "edit");
      if (!APPT_STATUS[apptStatus]) throw new Error("Unknown appointment status.");
      if (apptStatus === "done") await assertSessionLeft(d);
      // Re-opening a cancelled slot must still be free.
      if (["cancelled", "noshow"].includes(d.apptStatus) && !["cancelled", "noshow"].includes(apptStatus)) await assertSlotFree(d.adminid, d, d._id);
      // Done takes the services' materials out of stock; leaving done puts them back.
      let materialsapplied = !!d.materialsapplied;
      if (apptStatus === "done" && !materialsapplied) {
        await moveAppointmentMaterials(d, -1);
        materialsapplied = true;
      } else if (apptStatus !== "done" && materialsapplied) {
        await moveAppointmentMaterials(d, 1);
        materialsapplied = false;
      }
      await Appointment.updateOne({ _id: d._id }, { $set: { apptStatus, materialsapplied, ...(invoiceid ? { invoiceid } : {}) } });
      return loadAppointment(d._id);
    },
    deleteAppointment: async (_: any, { id }: any, context: any) => {
      const { d } = await own(Appointment, id, context, "appointments", "delete");
      if (d.status && d.materialsapplied) await moveAppointmentMaterials(d, 1);
      await Appointment.updateOne({ _id: d._id }, { $set: { status: false } });
      return true;
    },
    resetAppointment: async (_: any, { id }: any, context: any) => {
      const { d } = await own(Appointment, id, context, "appointments", "reset");
      if (d.status) return true;
      if (d.materialsapplied) await moveAppointmentMaterials(d, -1);
      await Appointment.updateOne({ _id: d._id }, { $set: { status: true } });
      return true;
    },

    addJobCard: addWith(JobCard, loadJobCard, async (input, context) => {
      const scope = await gate(context, "jobcards", "add");
      const deviceNo = takeDeviceNumber("jobcard", input);
      const data: any = { ...input, branchid: scope.branchid || input.branchid };
      if (!data.branchid) throw new Error("Select a branch for the job card.");
      await checkJobCard(data, scope);
      await guardSpares(scope, data.branchid, data.spares || []);
      const created: any = await JobCard.create({ ...data, adminid: scope.adminid, jobStatus: "received", createdby_name: userName(context) });
      await moveJobCardStock(created.toObject(), -1);
      await raiseDeviceSeq(scope.adminid, deviceNo);
      return loadJobCard(created._id);
    }),
    editJobCard: async (_: any, { id, input }: any, context: any) => {
      const { scope, d: old } = await own(JobCard, id, context, "jobcards", "edit");
      dropDeviceNumber("jobcard", input);
      if (old.invoiceid) throw new Error("This job card is billed. Edit the invoice instead.");
      const { clientRequestId, branchid, ...patch } = input;
      await checkJobCard(patch, scope);
      const next = { ...old, ...patch };
      await guardSpares(scope, old.branchid, next.spares || [], old);
      const holds = old.jobStatus !== "cancelled";
      if (holds) await moveJobCardStock(old, 1);
      await JobCard.updateOne({ _id: old._id }, { $set: patch });
      if (holds) await moveJobCardStock(next, -1);
      return loadJobCard(old._id);
    },
    setJobCardStatus: async (_: any, { id, jobStatus, invoiceid }: any, context: any) => {
      const { d } = await own(JobCard, id, context, "jobcards", "edit");
      if (!JOB_STATUS[jobStatus]) throw new Error("Unknown job card status.");
      // Cancelling puts unused spares back; leaving cancelled takes them out again.
      const holds = !d.stockreleased;
      if (holds && jobStatus === "cancelled" && d.jobStatus !== "cancelled") await moveJobCardStock(d, 1);
      if (holds && d.jobStatus === "cancelled" && jobStatus !== "cancelled") await moveJobCardStock(d, -1);
      const set: any = { jobStatus };
      if (jobStatus === "delivered") set.deliveredAt = new Date();
      if (invoiceid && !d.invoiceid) {
        await assertOwnedIds(SalesInvoice, [invoiceid], d.adminid, "Invoice", "adminid");
        set.invoiceid = invoiceid;
        // The invoice carries the spares and moves their stock itself.
        if (holds && d.jobStatus !== "cancelled") await moveJobCardStock(d, 1);
        set.stockreleased = true;
      }
      await JobCard.updateOne({ _id: d._id }, { $set: set });
      return loadJobCard(d._id);
    },
    deleteJobCard: async (_: any, { id }: any, context: any) => {
      const { d } = await own(JobCard, id, context, "jobcards", "delete");
      if (d.invoiceid) throw new Error("This job card is billed. Delete the invoice first.");
      if (d.status && d.jobStatus !== "cancelled" && !d.stockreleased) await moveJobCardStock(d, 1);
      await JobCard.updateOne({ _id: d._id }, { $set: { status: false } });
      return true;
    },
    resetJobCard: async (_: any, { id }: any, context: any) => {
      const { d } = await own(JobCard, id, context, "jobcards", "reset");
      if (d.status) return true;
      if (d.jobStatus !== "cancelled" && !d.stockreleased) await moveJobCardStock(d, -1);
      await JobCard.updateOne({ _id: d._id }, { $set: { status: true } });
      return true;
    },

    addContract: addWith(Contract, loadContract, async (input, context) => {
      const scope = await gate(context, "contracts", "add");
      await checkCustomer(input, scope, true);
      const ids = itemIds(input.items || []);
      if (ids.length) await assertOwnedIds(ProductService, ids, scope.adminid, "Item", "adminid");
      if (input.enddate < input.startdate) throw new Error("End date is before the start date.");
      const created: any = await Contract.create({ ...input, adminid: scope.adminid, branchid: scope.branchid || input.branchid || undefined, createdby_name: userName(context) });
      return loadContract(created._id);
    }),
    editContract: async (_: any, { id, input }: any, context: any) => {
      const { scope, d } = await own(Contract, id, context, "contracts", "edit");
      const { clientRequestId, branchid, ...patch } = input;
      await checkCustomer(patch, scope, true);
      if (patch.enddate < patch.startdate) throw new Error("End date is before the start date.");
      await Contract.updateOne({ _id: d._id }, { $set: patch });
      return loadContract(d._id);
    },
    deleteContract: softDelete(Contract, "contracts"),
    resetContract: restore(Contract, "contracts"),

    addMembershipPlan: addWith(MembershipPlan, loadPlan, async (input, context) => {
      const scope = await gate(context, "memberships", "add");
      if ((input.services || []).length) await assertOwnedIds(ProductService, input.services, scope.adminid, "Service", "adminid");
      const created: any = await MembershipPlan.create({ ...input, adminid: scope.adminid, createdby_name: userName(context) });
      return loadPlan(created._id);
    }),
    editMembershipPlan: async (_: any, { id, input }: any, context: any) => {
      const { scope, d } = await own(MembershipPlan, id, context, "memberships", "edit");
      const { clientRequestId, ...patch } = input;
      if ((patch.services || []).length) await assertOwnedIds(ProductService, patch.services, scope.adminid, "Service", "adminid");
      await MembershipPlan.updateOne({ _id: d._id }, { $set: patch });
      return loadPlan(d._id);
    },
    deleteMembershipPlan: softDelete(MembershipPlan, "memberships"),
    resetMembershipPlan: restore(MembershipPlan, "memberships"),

    addMembership: addWith(Membership, loadMembership, async (input, context) => {
      const scope = await gate(context, "memberships", "add");
      await checkCustomer(input, scope);
      await assertOwnedIds(MembershipPlan, [input.planid], scope.adminid, "Plan", "adminid");
      const created: any = await Membership.create({ ...input, adminid: scope.adminid, branchid: scope.branchid || input.branchid || undefined, createdby_name: userName(context) });
      return loadMembership(created._id);
    }),
    editMembership: async (_: any, { id, input }: any, context: any) => {
      const { scope, d } = await own(Membership, id, context, "memberships", "edit");
      const { clientRequestId, branchid, ...patch } = input;
      await checkCustomer(patch, scope);
      await assertOwnedIds(MembershipPlan, [patch.planid], scope.adminid, "Plan", "adminid");
      await Membership.updateOne({ _id: d._id }, { $set: patch });
      return loadMembership(d._id);
    },
    deleteMembership: softDelete(Membership, "memberships"),
    resetMembership: restore(Membership, "memberships"),
  },

  Membership: {
    sessionsused: (m: any) => (m.id && !String(m.id).startsWith("offline-") ? sessionsUsed(m.id) : 0),
  },
};
