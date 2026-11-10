import { Quotation } from "../../../models/quotation";
import { Lead } from "../../../models/lead";
import { Account } from "../../../models/accounts";
import { ProductService } from "../../../models/products";
import { SalesOrder } from "../../../models/salesorder";
import { AdminSettings } from "../../../models/adminsettings";
import { TenantError, assertOwnedIds, requireBackofficeTenant } from "../../../utils/tenant";
import { activeFilters, containsRx, dmyFromText, notCleared, pageWindow, textMatch } from "../../../utils/listquery";
import { assertModuleOn } from "../../../utils/modulegate";
import { isActionAllowed } from "../../../utils/permissiongate";
import { createOnce, dropDeviceNumber, isoOf, raiseDeviceSeq, takeDeviceNumber } from "../../../utils/offlinesync";
import { DEFAULT_LEAD_STAGES } from "../lead";

export const quotationPopulate: any[] = [
  { path: "partyacc", select: "name accountname mobile address city state gstnumber" },
  { path: "leadid", select: "name mobile city company" },
  { path: "productservice.productserviceid", select: "name imageurl productvariants._id productvariants.name" },
  { path: "productservice.salesunitid", select: "unitname" },
];

const ref = (d: any, keys: string[]) => {
  if (!d) return null;
  const out: any = { id: String(d._id ?? d) };
  for (const k of keys) out[k] = d[k] ?? d.name ?? null;
  return out;
};

export const formatQuotation = (q: any) => ({
  ...q,
  id: String(q._id),
  adminid: q.adminid ? String(q.adminid) : null,
  branchid: q.branchid ? String(q.branchid) : null,
  rootid: q.rootid ? String(q.rootid) : null,
  convertedorderid: q.convertedorderid ? String(q.convertedorderid) : null,
  partyacc: q.partyacc ? ref(q.partyacc, ["name", "accountname", "mobile", "address", "city", "state", "gstnumber"]) : null,
  leadid: q.leadid ? ref(q.leadid, ["name", "mobile", "city"]) : null,
  productservice: (q.productservice || []).map((l: any) => {
    const variant = l.productserviceid?.productvariants?.find((v: any) => String(v._id) === String(l.variantid));
    return {
      ...l,
      productserviceid: l.productserviceid ? ref(l.productserviceid, ["name", "imageurl"]) : null,
      variantid: l.variantid ? { id: String(l.variantid), name: variant?.name ?? null } : null,
      salesunitid: l.salesunitid ? ref(l.salesunitid, ["unitname"]) : null,
      unitqty: l.unitqty ?? 1,
    };
  }),
  statusAt: isoOf(q.statusAt),
  createdAt: isoOf(q.createdAt),
  updatedAt: isoOf(q.updatedAt),
});

const loadQuotation = async (id: any) => {
  const q = await Quotation.findById(id).populate(quotationPopulate).lean();
  return q ? formatQuotation(q) : null;
};

const whereOf = (scope: any) => ({
  adminid: scope.adminid,
  branchid: scope.userType === "admin" ? undefined : scope.branchid,
  staffid: scope.userType === "staff" ? scope.userId : undefined,
});

// Module switch and role permission, checked here too (hidden buttons are not a lock).
async function gate(scope: any, action: string) {
  const where = whereOf(scope);
  await assertModuleOn("quotations", "Quotations", where);
  if (!(await isActionAllowed("quotations", action, where))) {
    throw new TenantError("You do not have permission for this Quotation action.");
  }
}

async function ownQuotation(id: string, context: any, action = "edit") {
  const scope = await requireBackofficeTenant(context);
  await gate(scope, action);
  const q: any = await Quotation.findById(id).lean();
  if (!q || String(q.adminid) !== String(scope.adminid)) throw new TenantError("Quotation not found.", "BAD_USER_INPUT");
  return { scope, q };
}

export const buildQuotationQuery = (scope: { adminid: any; branchid?: any }, branchid?: any) => {
  const q: any = { adminid: scope.adminid, status: true };
  const b = scope.branchid || branchid;
  if (b) q.branchid = b;
  return q;
};

const createdBy = (user: any) => ({
  createdby_id: user?.id ? String(user.id) : undefined,
  createdby_name: user?.name || user?.email,
  createdby_type: user?.type || "admin",
});

async function checkRefs(input: any, scope: any) {
  if (!input.partyacc && !input.leadid && !String(input.customername || "").trim()) {
    throw new Error("Pick a party or a lead, or type the customer name.");
  }
  if (!(input.productservice || []).length) throw new Error("Add at least one item.");
  if (input.partyacc) await assertOwnedIds(Account, [input.partyacc], scope.adminid, "Party");
  if (input.leadid) await assertOwnedIds(Lead, [input.leadid], scope.adminid, "Lead", "adminid");
  const ids = (input.productservice || []).map((l: any) => l.productserviceid).filter(Boolean);
  if (ids.length) await assertOwnedIds(ProductService, ids, scope.adminid, "Product", "adminid");
}

// Saving a quotation moves its lead to the "Quotation" stage when the lead is still before it.
async function advanceLead(adminid: any, leadid: any) {
  if (!leadid) return;
  const s: any = await AdminSettings.getOrCreateForAdmin(adminid);
  const stages: any[] = s?.crmStages?.length ? s.crmStages : DEFAULT_LEAD_STAGES;
  const target = stages.findIndex((x) => x.key === "quotation");
  if (target < 0) return;
  const lead: any = await Lead.findById(leadid).select("stage").lean();
  const at = stages.findIndex((x) => x.key === lead?.stage);
  if (!lead || (at >= 0 && (at >= target || stages[at].kind !== "open"))) return;
  // No timestamp bump: queued offline edits of the lead keep their expectedUpdatedAt.
  await Lead.updateOne({ _id: leadid }, { $set: { stage: "quotation" } }, { timestamps: false });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Sent", accepted: "Accepted", rejected: "Rejected", revised: "Revised", converted: "Converted",
};
const matchLabel = (term: string) =>
  Object.keys(STATUS_LABEL).filter((k) => containsRx(term).test(STATUS_LABEL[k]) || containsRx(term).test(k));

async function columnClause(key: string, term: string, adminid: any): Promise<any | null> {
  switch (key) {
    case "billnumber":
      return { $or: [{ billnumber: containsRx(term.replace(/^QT-?/i, "")) }, { offlineNumber: containsRx(term) }] };
    case "customer": {
      const ids = await Account.find({ admin: adminid, name: containsRx(term) }).select("_id").limit(500).lean();
      return { $or: [{ partyacc: { $in: ids.map((a: any) => a._id) } }, { customername: containsRx(term) }] };
    }
    case "billdate":
      return textMatch(dmyFromText("$billdate"), term);
    case "validtill":
      return textMatch(dmyFromText("$validtill"), term);
    case "subject":
      return { subject: containsRx(term) };
    case "quotationStatus":
      return { quotationStatus: { $in: matchLabel(term) } };
    case "totalamount":
      return textMatch({ $toString: "$totalamount" }, term);
    default:
      return null;
  }
}
const SEARCH_KEYS = ["billnumber", "customer", "billdate", "subject", "quotationStatus", "totalamount"];

async function listQuery(scope: any, filter: any = {}) {
  const q: any = buildQuotationQuery(scope, filter?.branchid);
  if (filter?.leadid) q.leadid = filter.leadid;
  if (filter?.partyacc) q.partyacc = filter.partyacc;
  if (!filter?.allRevisions) q.quotationStatus = { $ne: "revised" };
  if (filter?.billdateFrom || filter?.billdateTo) {
    q.billdate = {};
    if (filter.billdateFrom) q.billdate.$gte = String(filter.billdateFrom).slice(0, 10);
    if (filter.billdateTo) q.billdate.$lte = `${String(filter.billdateTo).slice(0, 10)}￿`;
  }
  return q;
}

async function addNow(input: any, context: any) {
  const scope = await requireBackofficeTenant(context);
  await gate(scope, "add");
  const deviceNo = takeDeviceNumber("quotation", input);
  const { clientRequestId, ...data } = input;
  await checkRefs(data, scope);
  data.branchid = scope.branchid || data.branchid || undefined;
  const created: any = await Quotation.create({
    ...data,
    adminid: scope.adminid,
    clientRequestId: clientRequestId || undefined,
    quotationStatus: "draft",
    ...createdBy(context?.user),
  });
  await raiseDeviceSeq(scope.adminid, deviceNo);
  await advanceLead(scope.adminid, created.leadid);
  return loadQuotation(created._id);
}

export const quotationResolvers = {
  Query: {
    getQuotations: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const rows = await Quotation.find(await listQuery(scope, filter)).sort({ createdAt: -1 }).populate(quotationPopulate).lean();
      return rows.map(formatQuotation);
    },

    getQuotationsPage: async (_: any, { filter = {}, page = 1, pageSize = 10, search = "", columnFilters = [] }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const clauses: any[] = [await listQuery(scope, filter)];
      const term = String(search || "").trim();
      if (term) {
        const any: any[] = [];
        for (const key of SEARCH_KEYS) {
          const c = await columnClause(key, term, scope.adminid);
          if (c) any.push(c);
        }
        clauses.push({ $or: any });
      }
      for (const f of activeFilters(columnFilters)) {
        const c = await columnClause(f.key, f.value, scope.adminid);
        if (c) clauses.push(c);
      }
      const query = { $and: clauses };
      const { skip, limit } = pageWindow(page, pageSize);
      const [total, rows] = await Promise.all([
        Quotation.countDocuments(query),
        Quotation.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(quotationPopulate).lean(),
      ]);
      return { items: rows.map(formatQuotation), total };
    },

    getDeletedQuotations: async (_: any, { filter = {} }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const q: any = { ...buildQuotationQuery(scope, filter?.branchid), status: false, ...notCleared };
      const rows = await Quotation.find(q).sort({ updatedAt: -1 }).populate(quotationPopulate).lean();
      return rows.map(formatQuotation);
    },

    getQuotationById: async (_: any, { id }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const q: any = await Quotation.findById(id).populate(quotationPopulate).lean();
      return q && String(q.adminid) === String(scope.adminid) ? formatQuotation(q) : null;
    },
  },

  Mutation: {
    // One quotation per clientRequestId (offline retries).
    addQuotation: (_: any, args: any, context: any) =>
      createOnce(
        context,
        args?.input,
        async (adminid, req) => {
          const q: any = await Quotation.findOne({ adminid, clientRequestId: req }).select("_id").lean();
          return q ? loadQuotation(q._id) : null;
        },
        () => addNow(args.input, context)
      ),

    editQuotation: async (_: any, { id, input }: any, context: any) => {
      const { scope, q } = await ownQuotation(id, context);
      if (["revised", "converted"].includes(q.quotationStatus)) {
        throw new Error("This quotation was revised or converted. Make a new revision instead.");
      }
      dropDeviceNumber("quotation", input);
      const { clientRequestId, billnumber, branchid, ...patch } = input;
      await checkRefs(patch, scope);
      await Quotation.updateOne({ _id: q._id }, { $set: patch });
      await advanceLead(scope.adminid, patch.leadid);
      return loadQuotation(q._id);
    },

    deleteQuotation: async (_: any, { id }: any, context: any) => {
      const { q } = await ownQuotation(id, context, "delete");
      await Quotation.updateOne({ _id: q._id }, { $set: { status: false } });
      return true;
    },

    resetQuotation: async (_: any, { id }: any, context: any) => {
      const { q } = await ownQuotation(id, context, "reset");
      await Quotation.updateOne({ _id: q._id }, { $set: { status: true } });
      return true;
    },

    setQuotationStatus: async (_: any, { id, quotationStatus, statusreason, convertedorderid }: any, context: any) => {
      const action = quotationStatus === "converted" ? "convert" : "edit";
      const { scope, q } = await ownQuotation(id, context, action);
      if (!["draft", "sent", "accepted", "rejected", "converted"].includes(quotationStatus)) throw new Error("Unknown status.");
      if (q.quotationStatus === "revised") throw new Error("This quotation has a newer revision.");
      if (quotationStatus === "rejected" && !String(statusreason || "").trim()) throw new Error("Give a reason for the rejection.");
      const set: any = { quotationStatus, statusreason: statusreason || null, statusAt: new Date() };
      if (convertedorderid) {
        const o: any = await SalesOrder.findById(convertedorderid).select("adminid").lean();
        if (!o || String(o.adminid) !== String(scope.adminid)) throw new TenantError("Sales Order not found.", "BAD_USER_INPUT");
        set.convertedorderid = convertedorderid;
      }
      await Quotation.updateOne({ _id: q._id }, { $set: set });
      return loadQuotation(q._id);
    },

    // Online only: the revision keeps the number and lands next to the original.
    reviseQuotation: async (_: any, { id }: any, context: any) => {
      const { scope, q } = await ownQuotation(id, context, "add");
      if (q.quotationStatus === "revised") throw new Error("This quotation already has a newer revision.");
      if (q.quotationStatus === "converted") throw new Error("A converted quotation cannot be revised.");
      const rootid = q.rootid || q._id;
      const top: any = await Quotation.findOne({ adminid: scope.adminid, $or: [{ _id: rootid }, { rootid }] }).sort({ revision: -1 }).select("revision").lean();
      const { _id, createdAt, updatedAt, clientRequestId, offlineNumber, statusAt, statusreason, convertedorderid, ...copy } = q;
      const created: any = await Quotation.create({
        ...copy,
        rootid,
        revision: (top?.revision ?? q.revision ?? 0) + 1,
        quotationStatus: "draft",
        billdate: new Date().toISOString().slice(0, 10),
        ...createdBy(context?.user),
      });
      await Quotation.updateOne({ _id: q._id }, { $set: { quotationStatus: "revised", statusAt: new Date() } });
      return loadQuotation(created._id);
    },
  },
};
