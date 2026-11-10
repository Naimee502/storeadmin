import { Lead, Followup } from "../../../models/lead";
import { Account } from "../../../models/accounts";
import { StaffAccount } from "../../../models/staffaccounts";
import { ProductService } from "../../../models/products";
import { AdminSettings } from "../../../models/adminsettings";
import { requireBackofficeTenant, TenantError, assertOwnedIds } from "../../../utils/tenant";
import { assertModuleOn } from "../../../utils/modulegate";
import { isActionAllowed } from "../../../utils/permissiongate";
import { activeFilters, containsRx, escapeRegex, notCleared, pageWindow } from "../../../utils/listquery";
import { NUMERIC_COLLATION } from "../../../utils/billnumber";
import { createOnce, isoOf } from "../../../utils/offlinesync";

// Same keys and kinds the client falls back to when Business Settings has no CRM stages.
export const DEFAULT_LEAD_STAGES = [
  { key: "new", label: "New", kind: "open" },
  { key: "contacted", label: "Contacted", kind: "open" },
  { key: "qualified", label: "Qualified", kind: "open" },
  { key: "quotation", label: "Quotation Sent", kind: "open" },
  { key: "negotiation", label: "Negotiation", kind: "open" },
  { key: "won", label: "Won", kind: "won" },
  { key: "lost", label: "Lost", kind: "lost" },
];

const whereOf = (scope: any) => ({
  adminid: scope.adminid,
  branchid: scope.userType === "admin" ? undefined : scope.branchid,
  staffid: scope.userType === "staff" ? scope.userId : undefined,
});

const LABEL: Record<string, string> = { leads: "Leads", followups: "Follow Ups" };

// Module switch and role permission, checked here too (hidden buttons are not a lock).
async function gate(scope: any, moduleId: "leads" | "followups", action: string) {
  const where = whereOf(scope);
  await assertModuleOn(moduleId, LABEL[moduleId], where);
  if (!(await isActionAllowed(moduleId, action, where))) {
    throw new TenantError(`You do not have permission for this ${LABEL[moduleId]} action.`);
  }
}

// Staff see their own leads unless Leads "View" (all leads) is allowed; admin and branch see all.
async function ownOnly(scope: any) {
  return scope.userType === "staff" && !(await isActionAllowed("leads", "view", whereOf(scope)));
}

/** Tenant, branch and visibility for lead lists and the device sync. */
export async function leadQuery(scope: any, branchid?: any) {
  const q: any = { adminid: scope.adminid };
  const b = scope.branchid || branchid;
  if (b) q.branchid = b;
  if (await ownOnly(scope)) q.$or = [{ ownerid: scope.userId }, { createdby_id: String(scope.userId) }];
  return q;
}

export async function followupQuery(scope: any, branchid?: any) {
  const q: any = { adminid: scope.adminid };
  const b = scope.branchid || branchid;
  if (b) q.branchid = b;
  if (await ownOnly(scope)) q.$or = [{ assignedto: scope.userId }, { createdby_id: String(scope.userId) }];
  return q;
}

const createdBy = (user: any) => ({
  createdby_id: user?.id ? String(user.id) : undefined,
  createdby_name: user?.name || user?.email,
  createdby_type: user?.type || "admin",
});

const ref = (v: any, fields: string[]) => {
  if (!v) return null;
  if (typeof v !== "object" || !v._id) return { id: String(v) };
  const out: any = { id: String(v._id) };
  for (const f of fields) out[f] = v[f] ?? null;
  return out;
};

export const LEAD_POPULATE = [
  { path: "ownerid", select: "name mobile" },
  { path: "partyid", select: "name mobile city" },
  { path: "products.productid", select: "name" },
  { path: "products.unitid", select: "unitname" },
];
const FOLLOWUP_POPULATE = [
  { path: "leadid", select: "name mobile city company" },
  { path: "partyid", select: "name mobile city" },
  { path: "assignedto", select: "name mobile" },
];

export const formatLead = (l: any) => ({
  ...l,
  id: String(l._id),
  adminid: l.adminid ? String(l.adminid) : null,
  branchid: l.branchid ? String(l.branchid) : null,
  ownerid: ref(l.ownerid, ["name", "mobile"]),
  partyid: ref(l.partyid, ["name", "mobile", "city"]),
  products: (l.products || []).map((p: any) => ({ ...p, productid: ref(p.productid, ["name"]), unitid: ref(p.unitid, ["unitname"]), variantid: p.variantid ? String(p.variantid) : null })),
  nextfollowupAt: isoOf(l.nextfollowupAt),
  lastcontactAt: isoOf(l.lastcontactAt),
  closedAt: isoOf(l.closedAt),
  createdAt: isoOf(l.createdAt),
  updatedAt: isoOf(l.updatedAt),
});

export const formatFollowup = (f: any) => ({
  ...f,
  id: String(f._id),
  adminid: f.adminid ? String(f.adminid) : null,
  branchid: f.branchid ? String(f.branchid) : null,
  leadid: ref(f.leadid, ["name", "mobile", "city"]),
  partyid: ref(f.partyid, ["name", "mobile", "city"]),
  assignedto: ref(f.assignedto, ["name", "mobile"]),
  dueAt: isoOf(f.dueAt),
  doneAt: isoOf(f.doneAt),
  createdAt: isoOf(f.createdAt),
  updatedAt: isoOf(f.updatedAt),
});

const loadLead = async (id: any) => {
  const l = await Lead.findById(id).populate(LEAD_POPULATE).lean();
  return l ? formatLead(l) : null;
};
const loadFollowup = async (id: any) => {
  const f = await Followup.findById(id).populate(FOLLOWUP_POPULATE).lean();
  return f ? formatFollowup(f) : null;
};

async function ownLead(id: string, context: any, action = "edit") {
  const scope = await requireBackofficeTenant(context);
  await gate(scope, "leads", action);
  const l: any = await Lead.findById(id).lean();
  if (!l || String(l.adminid) !== String(scope.adminid)) throw new TenantError("Lead not found.", "BAD_USER_INPUT");
  return { scope, l };
}
async function ownFollowup(id: string, context: any, action = "edit") {
  const scope = await requireBackofficeTenant(context);
  await gate(scope, "followups", action);
  const f: any = await Followup.findById(id).lean();
  if (!f || String(f.adminid) !== String(scope.adminid)) throw new TenantError("Follow Up not found.", "BAD_USER_INPUT");
  return { scope, f };
}

async function stagesOf(adminid: any) {
  const s: any = await AdminSettings.getOrCreateForAdmin(adminid);
  return Array.isArray(s?.crmStages) && s.crmStages.length ? s.crmStages : DEFAULT_LEAD_STAGES;
}

async function nextLeadNumber(adminid: any) {
  const top: any = await Lead.findOne({ adminid, leadnumber: { $regex: /^\d+$/ } })
    .collation(NUMERIC_COLLATION).sort({ leadnumber: -1 }).select("leadnumber").lean();
  return String((parseInt(top?.leadnumber || "0", 10) || 0) + 1).padStart(6, "0");
}

// Lead's next and last contact from its follow-ups. No timestamp bump, so queued offline edits keep their expectedUpdatedAt.
async function syncLeadDates(leadid: any) {
  if (!leadid) return;
  const [next, last]: any[] = await Promise.all([
    Followup.findOne({ leadid, status: true, doneAt: null }).sort({ dueAt: 1 }).select("dueAt").lean(),
    Followup.findOne({ leadid, status: true, doneAt: { $ne: null } }).sort({ doneAt: -1 }).select("doneAt").lean(),
  ]);
  await Lead.updateOne(
    { _id: leadid },
    { $set: { nextfollowupAt: next?.dueAt ?? null, lastcontactAt: last?.doneAt ?? null } },
    { timestamps: false }
  );
}

const toDate = (v: any) => (v ? new Date(isoOf(v) || v) : null);

async function cleanLeadInput(input: any, scope: any) {
  const data: any = { ...input };
  delete data.clientRequestId;
  data.name = String(data.name || "").trim();
  if (!data.name) throw new Error("Lead name is required.");
  for (const k of ["mobile", "altmobile"]) if (data[k]) data[k] = String(data[k]).replace(/[^\d+]/g, "");
  if (data.gstin) data.gstin = String(data.gstin).toUpperCase().trim();
  if (data.email) data.email = String(data.email).trim().toLowerCase();
  if (data.ownerid) await assertOwnedIds(StaffAccount, [data.ownerid], scope.adminid, "Owner");
  const productIds = (data.products || []).map((p: any) => p.productid).filter(Boolean);
  if (productIds.length) await assertOwnedIds(ProductService, productIds, scope.adminid, "Product", "adminid");
  // Branch and staff logins always save into their own branch.
  if (scope.branchid) data.branchid = scope.branchid;
  return data;
}

const LEAD_SEARCH = ["leadnumber", "name", "company", "mobile", "email", "city", "source", "requirement"];

async function leadColumnClause(key: string, value: string, adminid: any) {
  const rx = containsRx(value);
  if (key === "owner") {
    const ids = (await StaffAccount.find({ admin: adminid, name: rx }).select("_id").lean()).map((s: any) => s._id);
    return { ownerid: { $in: ids } };
  }
  if (key === "leadnumber") return { leadnumber: new RegExp(escapeRegex(value.replace(/^LD-?/i, "")), "i") };
  if (LEAD_SEARCH.includes(key) || ["stage", "temperature", "subsource"].includes(key)) return { [key]: rx };
  return null;
}

async function leadListQuery(scope: any, filter: any = {}) {
  const q: any = { ...(await leadQuery(scope, filter?.branchid)), status: true };
  if (filter?.stage) q.stage = filter.stage;
  if (filter?.source) q.source = filter.source;
  if (filter?.ownerid) q.ownerid = filter.ownerid;
  if (filter?.createdAtFrom || filter?.createdAtTo) {
    q.createdAt = {};
    if (filter.createdAtFrom) q.createdAt.$gte = new Date(`${String(filter.createdAtFrom).slice(0, 10)}T00:00:00+05:30`);
    if (filter.createdAtTo) q.createdAt.$lte = new Date(`${String(filter.createdAtTo).slice(0, 10)}T23:59:59.999+05:30`);
  }
  return q;
}

async function followupListQuery(scope: any, filter: any = {}) {
  const q: any = { ...(await followupQuery(scope, filter?.branchid)), status: true };
  if (filter?.leadid) q.leadid = filter.leadid;
  if (filter?.assignedto) q.assignedto = filter.assignedto;
  const now = new Date();
  if (filter?.state === "pending") q.doneAt = null;
  if (filter?.state === "done") q.doneAt = { $ne: null };
  if (filter?.state === "overdue") Object.assign(q, { doneAt: null, dueAt: { $lt: now } });
  if (filter?.dueAtFrom || filter?.dueAtTo) {
    q.dueAt = { ...(q.dueAt || {}) };
    if (filter.dueAtFrom) q.dueAt.$gte = new Date(`${String(filter.dueAtFrom).slice(0, 10)}T00:00:00+05:30`);
    if (filter.dueAtTo) q.dueAt.$lte = new Date(`${String(filter.dueAtTo).slice(0, 10)}T23:59:59.999+05:30`);
  }
  return q;
}

export const leadResolvers = {
  Query: {
    getLeads: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await Lead.find(await leadListQuery(scope, filter)).sort({ createdAt: -1 }).populate(LEAD_POPULATE).lean();
      return rows.map(formatLead);
    },

    getLeadsPage: async (_: any, { filter = {}, page = 1, pageSize = 10, search = "", columnFilters = [] }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const clauses: any[] = [await leadListQuery(scope, filter)];
      const term = String(search || "").trim();
      if (term) clauses.push({ $or: LEAD_SEARCH.map((k) => ({ [k]: containsRx(term) })) });
      for (const f of activeFilters(columnFilters)) {
        const c = await leadColumnClause(f.key, f.value, scope.adminid);
        if (c) clauses.push(c);
      }
      const query = { $and: clauses };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, rows] = await Promise.all([
        Lead.countDocuments(query),
        Lead.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(LEAD_POPULATE).lean(),
      ]);
      return { items: rows.map(formatLead), total };
    },

    getDeletedLeads: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await Lead.find({ ...(await leadQuery(scope, filter?.branchid)), status: false, ...notCleared })
        .sort({ updatedAt: -1 }).populate(LEAD_POPULATE).lean();
      return rows.map(formatLead);
    },

    getLeadById: async (_: any, { id }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const l: any = await Lead.findOne({ ...(await leadQuery(scope)), _id: id }).populate(LEAD_POPULATE).lean();
      return l ? formatLead(l) : null;
    },

    findLeadDuplicates: async (_: any, { mobile, email, gstin, excludeId }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const or: any[] = [];
      const digits = String(mobile || "").replace(/\D/g, "").slice(-10);
      if (digits.length === 10) or.push({ mobile: new RegExp(`${digits}$`) }, { altmobile: new RegExp(`${digits}$`) });
      if (email) or.push({ email: String(email).trim().toLowerCase() });
      if (gstin) or.push({ gstin: String(gstin).trim().toUpperCase() });
      if (!or.length) return [];
      const q: any = { adminid: scope.adminid, status: true, $or: or };
      if (excludeId) q._id = { $ne: excludeId };
      const rows = await Lead.find(q).sort({ createdAt: -1 }).limit(10).populate(LEAD_POPULATE).lean();
      return rows.map(formatLead);
    },

    getFollowups: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await Followup.find(await followupListQuery(scope, filter)).sort({ dueAt: 1 }).populate(FOLLOWUP_POPULATE).lean();
      return rows.map(formatFollowup);
    },

    getFollowupsPage: async (_: any, { filter = {}, page = 1, pageSize = 10, search = "", columnFilters = [] }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const clauses: any[] = [await followupListQuery(scope, filter)];
      const term = String(search || "").trim();
      const textKeys = ["type", "outcome", "note"];
      if (term) {
        const leadIds = (await Lead.find({ adminid: scope.adminid, $or: [{ name: containsRx(term) }, { mobile: containsRx(term) }] }).select("_id").lean()).map((l: any) => l._id);
        clauses.push({ $or: [...textKeys.map((k) => ({ [k]: containsRx(term) })), { leadid: { $in: leadIds } }] });
      }
      for (const f of activeFilters(columnFilters)) {
        if (textKeys.includes(f.key)) clauses.push({ [f.key]: containsRx(f.value) });
        if (f.key === "lead") {
          const ids = (await Lead.find({ adminid: scope.adminid, name: containsRx(f.value) }).select("_id").lean()).map((l: any) => l._id);
          clauses.push({ leadid: { $in: ids } });
        }
      }
      const query = { $and: clauses };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, rows] = await Promise.all([
        Followup.countDocuments(query),
        Followup.find(query).sort({ doneAt: 1, dueAt: 1, _id: -1 }).skip(skip).limit(limit).populate(FOLLOWUP_POPULATE).lean(),
      ]);
      return { items: rows.map(formatFollowup), total };
    },

    getDeletedFollowups: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await Followup.find({ ...(await followupQuery(scope, filter?.branchid)), status: false, ...notCleared })
        .sort({ updatedAt: -1 }).populate(FOLLOWUP_POPULATE).lean();
      return rows.map(formatFollowup);
    },

    getFollowupById: async (_: any, { id }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const f: any = await Followup.findOne({ ...(await followupQuery(scope)), _id: id }).populate(FOLLOWUP_POPULATE).lean();
      return f ? formatFollowup(f) : null;
    },
  },

  Mutation: {
    addLead: async (_: any, { input }: any, context: any) =>
      createOnce(
        context,
        input,
        async (adminid, req) => {
          const l: any = await Lead.findOne({ adminid, clientRequestId: req }).select("_id").lean();
          return l ? loadLead(l._id) : null;
        },
        async () => {
          const scope = await requireBackofficeTenant(context);
          await gate(scope, "leads", "add");
          const data = await cleanLeadInput(input, scope);
          const stages = await stagesOf(scope.adminid);
          if (!data.stage) data.stage = stages[0]?.key || "new";
          if (!data.ownerid && scope.userType === "staff") data.ownerid = scope.userId;
          const doc: any = await Lead.create({
            ...data,
            adminid: scope.adminid,
            leadnumber: await nextLeadNumber(scope.adminid),
            clientRequestId: input?.clientRequestId || undefined,
            ...createdBy(context?.user),
          });
          return loadLead(doc._id);
        }
      ),

    editLead: async (_: any, { id, input }: any, context: any) => {
      const { scope } = await ownLead(id, context);
      const data = await cleanLeadInput(input, scope);
      delete data.branchid;
      await Lead.updateOne({ _id: id }, { $set: data });
      return loadLead(id);
    },

    deleteLead: async (_: any, { id }: any, context: any) => {
      await ownLead(id, context, "delete");
      await Lead.updateOne({ _id: id }, { $set: { status: false } });
      return true;
    },

    resetLead: async (_: any, { id }: any, context: any) => {
      await ownLead(id, context, "reset");
      await Lead.updateOne({ _id: id }, { $set: { status: true } });
      return true;
    },

    setLeadStage: async (_: any, { id, stage, lostreason }: any, context: any) => {
      const { scope } = await ownLead(id, context);
      const stages = await stagesOf(scope.adminid);
      const s = stages.find((x: any) => x.key === stage);
      if (!s) throw new Error("Unknown stage.");
      if (s.kind === "lost" && !String(lostreason || "").trim()) throw new Error("Give a reason for losing this lead.");
      const closed = s.kind === "won" || s.kind === "lost";
      await Lead.updateOne(
        { _id: id },
        { $set: { stage, lostreason: s.kind === "lost" ? String(lostreason).trim() : null, closedAt: closed ? new Date() : null } }
      );
      return loadLead(id);
    },

    convertLeadToParty: async (_: any, { id, partyid }: any, context: any) => {
      const { scope } = await ownLead(id, context, "convert");
      await assertOwnedIds(Account, [partyid], scope.adminid, "Party");
      await Lead.updateOne({ _id: id }, { $set: { partyid } });
      return loadLead(id);
    },

    addFollowup: async (_: any, { input }: any, context: any) =>
      createOnce(
        context,
        input,
        async (adminid, req) => {
          const f: any = await Followup.findOne({ adminid, clientRequestId: req }).select("_id").lean();
          return f ? loadFollowup(f._id) : null;
        },
        async () => {
          const scope = await requireBackofficeTenant(context);
          await gate(scope, "followups", "add");
          const { clientRequestId, ...data } = input || {};
          if (!data.leadid && !data.partyid) throw new Error("Pick a lead or a party.");
          if (data.leadid) {
            const l: any = await Lead.findById(data.leadid).select("adminid branchid").lean();
            if (!l || String(l.adminid) !== String(scope.adminid)) throw new TenantError("Lead not found.", "BAD_USER_INPUT");
            if (!data.branchid && l.branchid) data.branchid = l.branchid;
          }
          if (data.partyid) await assertOwnedIds(Account, [data.partyid], scope.adminid, "Party");
          if (data.assignedto) await assertOwnedIds(StaffAccount, [data.assignedto], scope.adminid, "Staff");
          else if (scope.userType === "staff") data.assignedto = scope.userId;
          if (scope.branchid) data.branchid = scope.branchid;
          const doc: any = await Followup.create({
            ...data,
            dueAt: toDate(data.dueAt),
            doneAt: toDate(data.doneAt),
            adminid: scope.adminid,
            clientRequestId: clientRequestId || undefined,
            ...createdBy(context?.user),
          });
          await syncLeadDates(doc.leadid);
          return loadFollowup(doc._id);
        }
      ),

    editFollowup: async (_: any, { id, input }: any, context: any) => {
      const { scope, f } = await ownFollowup(id, context);
      const { clientRequestId, leadid, partyid, branchid, ...data } = input || {};
      if (data.assignedto) await assertOwnedIds(StaffAccount, [data.assignedto], scope.adminid, "Staff");
      await Followup.updateOne({ _id: id }, { $set: { ...data, dueAt: toDate(data.dueAt), doneAt: toDate(data.doneAt) } });
      await syncLeadDates(f.leadid);
      return loadFollowup(id);
    },

    completeFollowup: async (_: any, { id, outcome, note }: any, context: any) => {
      const { f } = await ownFollowup(id, context);
      const set: any = { doneAt: f.doneAt || new Date(), outcome: outcome ?? f.outcome ?? null };
      if (note !== undefined && note !== null) set.note = note;
      await Followup.updateOne({ _id: id }, { $set: set });
      await syncLeadDates(f.leadid);
      return loadFollowup(id);
    },

    deleteFollowup: async (_: any, { id }: any, context: any) => {
      const { f } = await ownFollowup(id, context, "delete");
      await Followup.updateOne({ _id: id }, { $set: { status: false } });
      await syncLeadDates(f.leadid);
      return true;
    },

    resetFollowup: async (_: any, { id }: any, context: any) => {
      const { f } = await ownFollowup(id, context, "reset");
      await Followup.updateOne({ _id: id }, { $set: { status: true } });
      await syncLeadDates(f.leadid);
      return true;
    },
  },
};
