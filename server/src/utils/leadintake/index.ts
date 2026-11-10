import crypto from "crypto";
import express from "express";
import cron from "node-cron";
import { LeadSource, LeadInbox } from "../../models/leadsource";
import { Lead, Followup } from "../../models/lead";
import { pushNotification } from "../../models/notifications";
import { decryptSecret } from "../secret";
import { nextLeadNumber, stagesOf } from "../../graphql/resolvers/lead";

// Lead integrations: portals and channels post (or we pull) enquiries; each one becomes a lead,
// de-duplicated and assigned, with a first call booked. Every payload is kept in LeadInbox.

export const LEAD_SOURCES = ["indiamart", "tradeindia", "justdial", "meta", "whatsapp", "website", "webhook"] as const;
export type LeadSourceKey = (typeof LEAD_SOURCES)[number];
// The Source shown on the lead (same names as the client's default source list).
export const SOURCE_LABEL: Record<LeadSourceKey, string> = {
  indiamart: "IndiaMART",
  tradeindia: "TradeIndia",
  justdial: "JustDial",
  meta: "Facebook",
  whatsapp: "WhatsApp",
  website: "Website",
  webhook: "Other",
};

export const newToken = () => crypto.randomBytes(18).toString("base64url");

export type Incoming = {
  name?: string;
  mobile?: string;
  email?: string;
  company?: string;
  city?: string;
  state?: string;
  address?: string;
  pincode?: string;
  requirement?: string;
  product?: string;
  subsource?: string;
  externalid?: string;
};

const str = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
// First non-empty value among the keys (portals name fields differently, and change them).
const pick = (o: any, keys: string[]) => {
  for (const k of keys) {
    const v = str(o?.[k]);
    if (v) return v;
  }
  return "";
};
const last10 = (m?: string) => str(m).replace(/\D/g, "").slice(-10);

/** IndiaMART push / pull row. */
export const fromIndiaMart = (r: any): Incoming => ({
  externalid: pick(r, ["UNIQUE_QUERY_ID", "QUERY_ID"]),
  name: pick(r, ["SENDER_NAME"]),
  mobile: pick(r, ["SENDER_MOBILE", "SENDER_PHONE"]),
  email: pick(r, ["SENDER_EMAIL"]),
  company: pick(r, ["SENDER_COMPANY"]),
  city: pick(r, ["SENDER_CITY"]),
  state: pick(r, ["SENDER_STATE"]),
  address: pick(r, ["SENDER_ADDRESS"]),
  pincode: pick(r, ["SENDER_PINCODE"]),
  product: pick(r, ["QUERY_PRODUCT_NAME", "QUERY_MCAT_NAME"]),
  requirement: [pick(r, ["SUBJECT"]), pick(r, ["QUERY_MESSAGE"])].filter(Boolean).join("\n"),
  subsource: pick(r, ["QUERY_TYPE"]) ? `IndiaMART ${pick(r, ["QUERY_TYPE"])}` : "",
});

/** TradeIndia inquiry row. */
export const fromTradeIndia = (r: any): Incoming => ({
  externalid: pick(r, ["rfi_id", "inquiry_id", "id"]),
  name: pick(r, ["sender_name", "name"]),
  mobile: pick(r, ["sender_mobile", "mobile", "sender_phone"]),
  email: pick(r, ["sender_email", "email"]),
  company: pick(r, ["sender_co", "sender_company", "company"]),
  city: pick(r, ["sender_city", "city"]),
  state: pick(r, ["sender_state", "state"]),
  address: pick(r, ["sender_address", "address"]),
  product: pick(r, ["product_name", "subject"]),
  requirement: [pick(r, ["subject"]), pick(r, ["message", "inquiry_message"])].filter(Boolean).join("\n"),
});

/** JustDial webhook (query string or body). */
export const fromJustDial = (r: any): Incoming => ({
  externalid: pick(r, ["leadid", "leadId", "lead_id"]),
  name: [pick(r, ["prefix"]), pick(r, ["name"])].filter(Boolean).join(" "),
  mobile: pick(r, ["mobile", "phone"]),
  email: pick(r, ["email"]),
  company: pick(r, ["company"]),
  city: pick(r, ["city"]),
  address: [pick(r, ["area"]), pick(r, ["brancharea"])].filter(Boolean).join(", "),
  pincode: pick(r, ["pincode"]),
  product: pick(r, ["category"]),
  requirement: pick(r, ["category", "leadtype"]),
});

/** Website or any form: common field names. */
export const fromForm = (r: any): Incoming => ({
  externalid: pick(r, ["id", "leadid", "externalid"]),
  name: pick(r, ["name", "full_name", "fullname", "customer_name"]),
  mobile: pick(r, ["mobile", "phone", "phone_number", "contact"]),
  email: pick(r, ["email"]),
  company: pick(r, ["company", "company_name"]),
  city: pick(r, ["city"]),
  state: pick(r, ["state"]),
  address: pick(r, ["address"]),
  pincode: pick(r, ["pincode", "zip"]),
  product: pick(r, ["product", "service"]),
  requirement: pick(r, ["message", "requirement", "comments", "enquiry"]),
  subsource: pick(r, ["campaign", "utm_campaign", "page"]),
});

/** Meta lead ads: field_data [{ name, values }] fetched by leadgen id. */
export const fromMetaLead = (lead: any): Incoming => {
  const f: Record<string, string> = {};
  for (const d of lead?.field_data || []) f[String(d.name || "").toLowerCase()] = str(d.values?.[0]);
  return {
    externalid: str(lead?.id),
    name: f.full_name || [f.first_name, f.last_name].filter(Boolean).join(" ") || f.name,
    mobile: f.phone_number || f.phone || f.mobile,
    email: f.email,
    company: f.company_name || f.company,
    city: f.city,
    state: f.state,
    requirement: Object.entries(f).filter(([k]) => !["full_name", "first_name", "last_name", "phone_number", "email", "city", "state"].includes(k)).map(([k, v]) => `${k}: ${v}`).join("\n"),
    subsource: str(lead?.ad_name || lead?.campaign_name || lead?.form_id),
  };
};

// Owner for a new lead: round robin over the source's staff, none = the admin.
async function nextOwner(cfg: any) {
  const ids = (cfg.ownerids || []).map(String);
  if (!ids.length) return undefined;
  const upd: any = await LeadSource.findOneAndUpdate({ _id: cfg._id }, { $inc: { rrIndex: 1 } }, { new: true }).select("rrIndex").lean();
  return ids[((upd?.rrIndex || 1) - 1) % ids.length];
}

/** One incoming enquiry: a new lead, or a note on the open lead with the same mobile. */
export async function ingestLead(cfg: any, data: Incoming, payload: any) {
  const adminid = cfg.adminid;
  const source = cfg.source as LeadSourceKey;
  const label = SOURCE_LABEL[source] || "Other";
  const inbox: any = await LeadInbox.create({ adminid, source, externalid: data.externalid || undefined, payload });
  try {
    const name = str(data.name) || str(data.company) || str(data.mobile) || str(data.email);
    if (!name) {
      await LeadInbox.updateOne({ _id: inbox._id }, { $set: { result: "ignored", error: "No name, mobile or email in the enquiry." } });
      return null;
    }
    if (data.externalid && (await Lead.exists({ adminid, source: label, externalid: data.externalid }))) {
      await LeadInbox.updateOne({ _id: inbox._id }, { $set: { result: "duplicate", error: "Already received." } });
      return null;
    }
    const m = last10(data.mobile);
    const requirement = [data.product, data.requirement].filter(Boolean).join("\n").slice(0, 4000);
    // Same buyer again within 45 days: one lead, the enquiry added to its notes.
    if (m.length === 10) {
      const since = new Date(Date.now() - 45 * 86400000);
      const open: any = await Lead.findOne({ adminid, status: true, createdAt: { $gte: since }, $or: [{ mobile: new RegExp(`${m}$`) }, { altmobile: new RegExp(`${m}$`) }], closedAt: null })
        .sort({ createdAt: -1 }).select("_id name ownerid notes").lean();
      if (open) {
        const note = `Repeat enquiry ${new Date().toLocaleDateString("en-IN")} via ${label}: ${requirement || "-"}`;
        await Lead.updateOne({ _id: open._id }, { $set: { notes: [open.notes, note].filter(Boolean).join("\n") } }, { timestamps: false });
        await LeadInbox.updateOne({ _id: inbox._id }, { $set: { result: "duplicate", leadid: open._id } });
        await notify(adminid, open.ownerid, `Repeat enquiry from ${open.name}`, `${label}: ${requirement.slice(0, 80)}`, open._id);
        return open._id;
      }
    }
    const stages = await stagesOf(adminid);
    const ownerid = await nextOwner(cfg);
    const lead: any = await Lead.create({
      adminid,
      leadnumber: await nextLeadNumber(adminid),
      name,
      company: str(data.company) || undefined,
      mobile: m || str(data.mobile) || undefined,
      email: str(data.email).toLowerCase() || undefined,
      city: str(data.city) || undefined,
      // Same slug the state pickers store ("tamil_nadu").
      state: str(data.state).toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "") || undefined,
      address: str(data.address) || undefined,
      pincode: str(data.pincode) || undefined,
      source: label,
      subsource: str(data.subsource) || undefined,
      externalid: data.externalid || undefined,
      requirement: requirement || undefined,
      stage: stages[0]?.key || "new",
      temperature: "warm",
      ownerid,
      createdby_name: label,
      createdby_type: "integration",
    });
    // First call within 15 minutes, so a portal lead is never left waiting.
    if (cfg.autoFollowup !== false) {
      await Followup.create({
        adminid, leadid: lead._id, type: "call", dueAt: new Date(Date.now() + 15 * 60000), assignedto: ownerid,
        note: `New ${label} enquiry`, createdby_name: label, createdby_type: "integration",
      });
      await Lead.updateOne({ _id: lead._id }, { $set: { nextfollowupAt: new Date(Date.now() + 15 * 60000) } }, { timestamps: false });
    }
    await LeadInbox.updateOne({ _id: inbox._id }, { $set: { result: "created", leadid: lead._id } });
    await notify(adminid, ownerid, `New lead from ${label}`, `${name}${m ? ` · ${m}` : ""}${data.city ? ` · ${data.city}` : ""}`, lead._id);
    return lead._id;
  } catch (e: any) {
    await LeadInbox.updateOne({ _id: inbox._id }, { $set: { result: "failed", error: String(e?.message || e).slice(0, 500) } });
    return null;
  }
}

async function notify(adminid: any, ownerid: any, title: string, message: string, leadid: any) {
  try {
    await pushNotification({ adminid, targettype: "admin", ntype: "lead", title, message, webpath: `/leads/addedit/${leadid}`, docmodel: "Lead", docid: leadid });
    if (ownerid) await pushNotification({ adminid, targettype: "staff", targetid: ownerid, ntype: "lead", title, message, appscreen: "Leads", docmodel: "Lead", docid: leadid });
  } catch { /* notifications are best-effort */ }
}

// ── Pulls (IndiaMART backfill, TradeIndia) ───────────────────────────────────

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// IndiaMART wants "DD-Mon-YYYYHH:MM:SS" in India time.
const imTime = (d: Date) => {
  const t = new Date(d.getTime() + 330 * 60000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getUTCDate())}-${MON[t.getUTCMonth()]}-${t.getUTCFullYear()}${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;
};
const ymd = (d: Date) => new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);

/** Fetch new enquiries for a pull source; returns how many came. */
export async function pullSource(cfg: any): Promise<number> {
  const now = new Date();
  // Never more than 7 days back (IndiaMART's window).
  const from = new Date(Math.max(cfg.lastPulledAt ? new Date(cfg.lastPulledAt).getTime() : 0, now.getTime() - 7 * 86400000));
  let rows: any[] = [];
  let map: (r: any) => Incoming;
  if (cfg.source === "indiamart") {
    const key = decryptSecret(cfg.key1);
    if (!key) throw new Error("IndiaMART CRM key is not set.");
    const res = await fetch(`https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${encodeURIComponent(key)}&start_time=${imTime(from)}&end_time=${imTime(now)}`);
    const json: any = await res.json().catch(() => ({}));
    if (String(json?.CODE) !== "200" && !Array.isArray(json?.RESPONSE)) throw new Error(str(json?.MESSAGE) || `IndiaMART answered ${res.status}`);
    rows = Array.isArray(json?.RESPONSE) ? json.RESPONSE : [];
    map = fromIndiaMart;
  } else if (cfg.source === "tradeindia") {
    const [userid, profileid, key] = [decryptSecret(cfg.key1), decryptSecret(cfg.key2), decryptSecret(cfg.key3)];
    if (!userid || !profileid || !key) throw new Error("TradeIndia User ID, Profile ID and Key are needed.");
    const res = await fetch(`https://www.tradeindia.com/utils/my_inquiry.html?userid=${encodeURIComponent(userid)}&profile_id=${encodeURIComponent(profileid)}&key=${encodeURIComponent(key)}&from_date=${ymd(from)}&to_date=${ymd(now)}`);
    const json: any = await res.json().catch(() => null);
    if (!res.ok || json === null) throw new Error(`TradeIndia answered ${res.status}`);
    rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    map = fromTradeIndia;
  } else {
    return 0;
  }
  let n = 0;
  for (const r of rows) if (await ingestLead(cfg, map(r), r)) n++;
  await LeadSource.updateOne({ _id: cfg._id }, { $set: { lastPulledAt: now, lastError: null } });
  return n;
}

/** Every 15 minutes: pull the enabled sources that have keys (also keeps the IndiaMART key in use). */
export const startLeadPullScheduler = () => {
  cron.schedule("*/15 * * * *", async () => {
    const list: any[] = await LeadSource.find({ enabled: true, source: { $in: ["indiamart", "tradeindia"] }, key1: { $exists: true, $ne: "" } }).lean();
    for (const cfg of list) {
      try {
        await pullSource(cfg);
      } catch (e: any) {
        await LeadSource.updateOne({ _id: cfg._id }, { $set: { lastError: String(e?.message || e).slice(0, 300) } });
      }
    }
  });
};

// ── Webhook route: /webhooks/leads/:token ────────────────────────────────────

async function fetchMetaLead(cfg: any, leadgenId: string) {
  const token = decryptSecret(cfg.key1);
  if (!token) throw new Error("Facebook Page access token is not set.");
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(token)}`);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(str(json?.error?.message) || `Facebook answered ${res.status}`);
  return json;
}

export const leadWebhookRouter = express.Router();
leadWebhookRouter.use(express.json({ limit: "1mb" }), express.urlencoded({ extended: true }));

leadWebhookRouter.all("/:token", async (req, res) => {
  const cfg: any = await LeadSource.findOne({ token: req.params.token }).lean();
  if (!cfg) return res.status(404).send("Unknown link");
  // Meta and WhatsApp check the URL once with a challenge.
  if (req.method === "GET" && req.query["hub.mode"] === "subscribe") {
    return req.query["hub.verify_token"] === cfg.token ? res.send(String(req.query["hub.challenge"] || "")) : res.status(403).send("Wrong verify token");
  }
  // Browsers sending a website form ask first.
  if (req.method === "OPTIONS") {
    res.set({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" });
    return res.status(204).end();
  }
  if (!cfg.enabled) return res.status(200).json({ ok: false, message: "This lead source is switched off." });
  const body: any = { ...(req.query || {}), ...(typeof req.body === "object" ? req.body : {}) };
  try {
    switch (cfg.source as LeadSourceKey) {
      case "indiamart": {
        const row = body.RESPONSE || body;
        await ingestLead(cfg, fromIndiaMart(row), body);
        return res.json({ code: 200, status: "Success" });
      }
      case "justdial":
        await ingestLead(cfg, fromJustDial(body), body);
        return res.send("RECEIVED");
      case "meta": {
        for (const entry of body.entry || []) {
          for (const ch of entry.changes || []) {
            const id = str(ch?.value?.leadgen_id);
            if (!id) continue;
            try {
              const lead = await fetchMetaLead(cfg, id);
              const n = fromMetaLead(lead);
              await ingestLead(cfg, { ...n, subsource: n.subsource || (ch.value.page_id ? `Page ${ch.value.page_id}` : "") }, { webhook: ch.value, lead });
            } catch (e: any) {
              await LeadInbox.create({ adminid: cfg.adminid, source: "meta", externalid: id, payload: ch.value, result: "failed", error: String(e?.message || e) });
            }
          }
        }
        return res.sendStatus(200);
      }
      case "whatsapp": {
        for (const entry of body.entry || []) {
          for (const ch of entry.changes || []) {
            const v = ch?.value || {};
            const names: Record<string, string> = {};
            for (const c of v.contacts || []) names[str(c.wa_id)] = str(c.profile?.name);
            for (const msg of v.messages || []) {
              const from = str(msg.from);
              await ingestLead(cfg, {
                externalid: str(msg.id),
                name: names[from] || from,
                mobile: from,
                requirement: str(msg.text?.body) || str(msg.button?.text) || `[${str(msg.type)} message]`,
                // Click-to-WhatsApp ad: where the chat came from.
                subsource: str(msg.referral?.headline) || str(msg.referral?.source_url),
              }, msg);
            }
          }
        }
        return res.sendStatus(200);
      }
      default: {
        res.set("Access-Control-Allow-Origin", "*");
        const id = await ingestLead(cfg, fromForm(body), body);
        return res.json({ ok: !!id });
      }
    }
  } catch (e: any) {
    return res.status(200).json({ ok: false, message: String(e?.message || e) });
  }
});
