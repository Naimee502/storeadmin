import { LeadSource, LeadInbox } from "../../../models/leadsource";
import { StaffAccount } from "../../../models/staffaccounts";
import { Admin } from "../../../models/admin";
import { requireBackofficeTenant, TenantError, assertOwnedIds } from "../../../utils/tenant";
import { isActionAllowed } from "../../../utils/permissiongate";
import { encryptSecret } from "../../../utils/secret";
import { isoOf } from "../../../utils/offlinesync";
import { PUBLIC_BASE_URL } from "../../../config/serverconfig";
import {
  LEAD_SOURCES, fromForm, fromIndiaMart, fromJustDial, fromMetaLead, fromTradeIndia, ingestLead, newToken, pullSource,
} from "../../../utils/leadintake";

const where = (scope: any) => ({
  adminid: scope.adminid,
  branchid: scope.userType === "admin" ? undefined : scope.branchid,
  staffid: scope.userType === "staff" ? scope.userId : undefined,
});

// Keys and links are business-wide: admin, or a login with Lead Sources edit.
// An admin login may name another business, so Business Settings can set a
// client's sources up for them; branch and staff logins are always their own.
async function gate(context: any, adminid?: string) {
  const scope = await requireBackofficeTenant(context);
  if (scope.userType !== "admin") {
    if (!(await isActionAllowed("leadsources", "edit", where(scope)))) {
      throw new TenantError("You do not have permission to change lead sources.");
    }
    return scope.adminid;
  }
  if (!adminid || String(adminid) === String(scope.adminid)) return scope.adminid;
  if (!(await Admin.exists({ _id: adminid, status: true }))) throw new TenantError("Business not found.", "BAD_USER_INPUT");
  return adminid as any;
}

async function configOf(adminid: any, source: string) {
  if (!(LEAD_SOURCES as readonly string[]).includes(source)) throw new Error("Unknown lead source.");
  let cfg: any = await LeadSource.findOne({ adminid, source }).lean();
  if (!cfg) {
    try {
      cfg = (await LeadSource.create({ adminid, source, token: newToken() })).toObject();
    } catch {
      cfg = await LeadSource.findOne({ adminid, source }).lean();
    }
  }
  return cfg;
}

async function shape(cfg: any) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const leadsToday = await LeadInbox.countDocuments({ adminid: cfg.adminid, source: cfg.source, result: "created", createdAt: { $gte: start } });
  return {
    source: cfg.source,
    enabled: !!cfg.enabled,
    webhookUrl: `${PUBLIC_BASE_URL}/webhooks/leads/${cfg.token}`,
    verifyToken: cfg.token,
    ownerids: (cfg.ownerids || []).map(String),
    autoFollowup: cfg.autoFollowup !== false,
    hasKey1: !!cfg.key1,
    hasKey2: !!cfg.key2,
    hasKey3: !!cfg.key3,
    lastPulledAt: isoOf(cfg.lastPulledAt),
    lastError: cfg.lastError || null,
    leadsToday,
  };
}

const SAMPLE: Record<string, any> = {
  indiamart: { UNIQUE_QUERY_ID: "", SENDER_NAME: "Test Buyer", SENDER_MOBILE: "+91-9999999999", SENDER_CITY: "Ahmedabad", SENDER_STATE: "Gujarat", QUERY_PRODUCT_NAME: "Sample product", QUERY_MESSAGE: "This is a test enquiry." },
  tradeindia: { rfi_id: "", sender_name: "Test Buyer", sender_mobile: "9999999999", sender_city: "Surat", product_name: "Sample product", message: "This is a test enquiry." },
  justdial: { leadid: "", name: "Test Buyer", mobile: "9999999999", city: "Rajkot", category: "Sample category" },
  meta: { id: "", field_data: [{ name: "full_name", values: ["Test Buyer"] }, { name: "phone_number", values: ["+919999999999"] }, { name: "city", values: ["Vadodara"] }] },
  whatsapp: { name: "Test Buyer", mobile: "919999999999", message: "Hi, I want a price for your product." },
  website: { name: "Test Buyer", mobile: "9999999999", email: "test@example.com", message: "Please send a quotation." },
  webhook: { name: "Test Buyer", mobile: "9999999999", message: "Test enquiry." },
};
const MAP: Record<string, (r: any) => any> = {
  indiamart: fromIndiaMart, tradeindia: fromTradeIndia, justdial: fromJustDial, meta: fromMetaLead, whatsapp: fromForm, website: fromForm, webhook: fromForm,
};

export const leadSourceResolvers = {
  Query: {
    getLeadSources: async (_: any, { adminid }: any, context: any) => {
      const target = await gate(context, adminid);
      const list = [];
      for (const s of LEAD_SOURCES) list.push(await shape(await configOf(target, s)));
      return list;
    },

    getLeadInbox: async (_: any, { adminid, source, result, limit = 100 }: any, context: any) => {
      const target = await gate(context, adminid);
      const q: any = { adminid: target };
      if (source) q.source = source;
      if (result) q.result = result;
      const rows: any[] = await LeadInbox.find(q).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 100, 500)).lean();
      return rows.map((r) => ({ ...r, id: String(r._id), leadid: r.leadid ? String(r.leadid) : null, createdAt: isoOf(r.createdAt) }));
    },
  },

  Mutation: {
    saveLeadSource: async (_: any, { input }: any, context: any) => {
      const target = await gate(context, input.adminid);
      const cfg = await configOf(target, input.source);
      const set: any = {};
      if (typeof input.enabled === "boolean") set.enabled = input.enabled;
      if (typeof input.autoFollowup === "boolean") set.autoFollowup = input.autoFollowup;
      if (Array.isArray(input.ownerids)) {
        await assertOwnedIds(StaffAccount, input.ownerids, target, "Staff");
        set.ownerids = input.ownerids;
      }
      for (const k of ["key1", "key2", "key3"]) {
        const v = String(input[k] ?? "").trim();
        if (v) set[k] = encryptSecret(v);
      }
      await LeadSource.updateOne({ _id: cfg._id }, { $set: set });
      return shape(await LeadSource.findById(cfg._id).lean());
    },

    regenerateLeadSourceLink: async (_: any, { source, adminid }: any, context: any) => {
      const target = await gate(context, adminid);
      const cfg = await configOf(target, source);
      await LeadSource.updateOne({ _id: cfg._id }, { $set: { token: newToken() } });
      return shape(await LeadSource.findById(cfg._id).lean());
    },

    pullLeadSourceNow: async (_: any, { source, adminid }: any, context: any) => {
      const target = await gate(context, adminid);
      const cfg = await configOf(target, source);
      try {
        return await pullSource(cfg);
      } catch (e: any) {
        await LeadSource.updateOne({ _id: cfg._id }, { $set: { lastError: String(e?.message || e).slice(0, 300) } });
        throw e;
      }
    },

    testLeadSource: async (_: any, { source, adminid }: any, context: any) => {
      const target = await gate(context, adminid);
      const cfg = await configOf(target, source);
      const sample = { ...SAMPLE[source] };
      const n = MAP[source](sample);
      // A fresh mobile each time, so the test is not merged into the last test lead.
      const mobile = `9${String(Date.now()).slice(-9)}`;
      return !!(await ingestLead(cfg, { ...n, externalid: undefined, mobile, name: `${n.name} (test)` }, { test: true, ...sample }));
    },

    retryLeadInbox: async (_: any, { id, adminid }: any, context: any) => {
      const target = await gate(context, adminid);
      const row: any = await LeadInbox.findById(id).lean();
      if (!row || String(row.adminid) !== String(target)) throw new TenantError("Entry not found.", "BAD_USER_INPUT");
      const cfg = await configOf(target, row.source);
      const p = row.payload?.lead || row.payload?.RESPONSE || row.payload || {};
      const ok = await ingestLead(cfg, MAP[row.source](p), row.payload);
      if (ok) await LeadInbox.updateOne({ _id: row._id }, { $set: { result: "ignored", error: "Retried; see the newer entry." } });
      return !!ok;
    },
  },
};
