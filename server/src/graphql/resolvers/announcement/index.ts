import mongoose, { Types } from "mongoose";
import { Announcement, AnnouncementRead } from "../../../models/announcement";
import { StaffAccount } from "../../../models/staffaccounts";
import { Account } from "../../../models/accounts";
import { Admin } from "../../../models/admin";
import { Branch } from "../../../models/branches";
import { Channel } from "../../../models/channel";
import { AdminSettings } from "../../../models/adminsettings";
import { resolveTenant, TenantError, type TenantScope } from "../../../utils/tenant";
import { assertModuleOn } from "../../../utils/modulegate";
import { isActionAllowed, isAnyActionAllowed } from "../../../utils/permissiongate";
import { sendPushToToken } from "../../../utils/fcm";

/* ------------------------------------------------------------------ */
/* Caller                                                              */
/* ------------------------------------------------------------------ */

const MODULE = "announcements";
const LABEL = "Announcements";
const STAFF_ROLES = ["salesman", "deliveryboy", "staff"];
// Ledger-only accounts (bank, expense...) are not people who read announcements.
const PARTY_TYPES = ["customer", "vendor", "both"];

type Kind = "admin" | "branch" | "staff" | "party";

interface Caller {
  tenant: TenantScope;
  kind: Kind;
  id: Types.ObjectId;
  name: string;
  role?: string; // staff role
  branchid?: Types.ObjectId | null;
  channel?: Types.ObjectId | null; // party
  salesmanid?: Types.ObjectId | null; // party
  assignaccountid?: Types.ObjectId | null; // party
  scope?: { adminid: any; branchid?: any; staffid?: any };
}

const oid = (v: any) => new Types.ObjectId(String(v));
const iso = (d: any) => (d ? new Date(d).toISOString() : null);
const idList = (arr: any) =>
  Array.isArray(arr) ? Array.from(new Set(arr.filter((x: any) => Types.ObjectId.isValid(String(x))).map(String))).map(oid) : [];

const callerOf = async (context: any): Promise<Caller> => {
  const type = context?.user?.type;
  if (!type) throw new TenantError("Please sign in.", "UNAUTHENTICATED");
  const tenant = await resolveTenant(context);
  const kind = tenant.userType as Kind;
  if (!tenant.userId || !["admin", "branch", "staff", "party"].includes(kind)) {
    throw new TenantError("Please sign in.", "UNAUTHENTICATED");
  }

  const c: Caller = { tenant, kind, id: tenant.userId, name: "", branchid: tenant.branchid || null };
  if (kind === "admin") {
    const a: any = await Admin.findById(c.id).select("name").lean();
    c.name = a?.name || "Admin";
  } else if (kind === "branch") {
    const b: any = await Branch.findById(c.id).select("branchname").lean();
    c.name = b?.branchname || "Branch";
  } else if (kind === "staff") {
    const s: any = await StaffAccount.findById(c.id).select("name role branchid status").lean();
    if (!s || s.status === false) throw new TenantError("Your account is inactive.");
    c.name = s.name;
    c.role = s.role;
    c.branchid = s.branchid || null;
  } else {
    const p: any = await Account.findById(c.id).select("name branchid channel salesmanid assignaccountid status").lean();
    if (!p || p.status === false) throw new TenantError("Your account is inactive.");
    c.name = p.name;
    c.branchid = p.branchid || null;
    c.channel = p.channel || null;
    c.salesmanid = p.salesmanid || null;
    c.assignaccountid = p.assignaccountid || null;
  }

  const scope = {
    adminid: tenant.adminid,
    branchid: kind === "branch" || kind === "staff" ? c.branchid : undefined,
    staffid: kind === "staff" ? c.id : undefined,
  };
  await assertModuleOn(MODULE, LABEL, scope);
  // Business Settings → Permissions → Announcements: every box unticked means
  // the business does not use announcements — no menu, no feed, anywhere.
  // Parties have no permissions of their own, so the business defaults (and
  // their branch's) decide for them.
  if (!(await isAnyActionAllowed(MODULE, ["add", "edit", "delete", "reset"], scope))) {
    throw new TenantError("Announcements are not enabled for this business.");
  }
  c.scope = scope;
  return c;
};

/* ------------------------------------------------------------------ */
/* Who may target whom                                                 */
/* ------------------------------------------------------------------ */

const emptyAudience = () => ({
  everyone: false,
  staffAll: false,
  staffRoles: [] as string[],
  staffIds: [] as Types.ObjectId[],
  partyAll: false,
  partyChannels: [] as Types.ObjectId[],
  partyIds: [] as Types.ObjectId[],
  myParties: false,
  mySubParties: false,
});

const hasTarget = (a: ReturnType<typeof emptyAudience>) =>
  a.everyone || a.staffAll || a.staffRoles.length > 0 || a.staffIds.length > 0 ||
  a.partyAll || a.partyChannels.length > 0 || a.partyIds.length > 0 || a.myParties || a.mySubParties;

/** Does this sender's account allow them to send at all? */
const assertCanSend = async (c: Caller) => {
  // Sending needs the "Add" permission (business defaults → branch → staff).
  if (!(await isActionAllowed(MODULE, "add", c.scope || { adminid: c.tenant.adminid }))) {
    throw new TenantError("You do not have permission to send announcements.");
  }
  if (c.kind === "staff" && c.role !== "salesman") {
    throw new TenantError("Only salesmen can send announcements from a staff login.");
  }
  if (c.kind === "party") {
    const s: any = await AdminSettings.findOne({ adminid: c.tenant.adminid }).select("partyManagesDownline").lean();
    if (!s?.partyManagesDownline) throw new TenantError("Sending announcements to sub-parties is not enabled for this business.");
    const subs = await Account.countDocuments({ admin: c.tenant.adminid, assignaccountid: c.id, status: true });
    if (subs === 0) throw new TenantError("You have no sub-parties to send to.");
  }
};

/**
 * Keep only the parts of the requested audience this sender may use, and
 * check every picked id really is within their reach.
 */
const sanitizeAudience = async (c: Caller, input: any, branchid: Types.ObjectId | null) => {
  const req = input || {};
  const a = emptyAudience();
  const adminid = c.tenant.adminid;

  if (c.kind === "admin" || c.kind === "branch") {
    a.everyone = !!req.everyone;
    a.staffAll = !!req.staffAll;
    a.staffRoles = (req.staffRoles || []).filter((r: string) => STAFF_ROLES.includes(r));
    a.partyAll = !!req.partyAll;

    const staffIds = idList(req.staffIds);
    if (staffIds.length) {
      const q: any = { _id: { $in: staffIds }, admin: adminid };
      if (branchid) q.branchid = branchid;
      a.staffIds = (await StaffAccount.find(q).select("_id").lean()).map((s: any) => s._id);
    }
    const partyIds = idList(req.partyIds);
    if (partyIds.length) {
      const q: any = { _id: { $in: partyIds }, admin: adminid };
      if (branchid) q.branchid = branchid;
      a.partyIds = (await Account.find(q).select("_id").lean()).map((p: any) => p._id);
    }
    const channels = idList(req.partyChannels);
    if (channels.length) {
      a.partyChannels = (await Channel.find({ _id: { $in: channels }, admin: adminid }).select("_id").lean()).map((x: any) => x._id);
    }
  } else if (c.kind === "staff") {
    // Salesman → only his own parties.
    a.myParties = !!req.myParties;
    const partyIds = idList(req.partyIds);
    if (partyIds.length) {
      a.partyIds = (
        await Account.find({ _id: { $in: partyIds }, admin: adminid, salesmanid: c.id }).select("_id").lean()
      ).map((p: any) => p._id);
    }
  } else {
    // Party → only its own sub-parties.
    a.mySubParties = !!req.mySubParties;
    const partyIds = idList(req.partyIds);
    if (partyIds.length) {
      a.partyIds = (
        await Account.find({ _id: { $in: partyIds }, admin: adminid, assignaccountid: c.id }).select("_id").lean()
      ).map((p: any) => p._id);
    }
  }

  if (!hasTarget(a)) throw new TenantError("Choose who should receive this announcement.", "BAD_USER_INPUT");
  return a;
};

/** The branch an announcement is limited to, by who is sending it. */
const branchFor = async (c: Caller, requested: any): Promise<Types.ObjectId | null> => {
  if (c.kind === "branch") return c.id;
  if (c.kind === "admin" && requested && Types.ObjectId.isValid(String(requested))) {
    const owned = await Branch.exists({ _id: oid(requested), admin: c.tenant.adminid });
    if (!owned) throw new TenantError("You do not have access to that branch.");
    return oid(requested);
  }
  return null; // salesman / party rules are relative to the sender, not a branch
};

/* ------------------------------------------------------------------ */
/* Recipients (push + "seen by X of Y")                                */
/* ------------------------------------------------------------------ */

const staffRecipientQuery = (ann: any): any | null => {
  const a = ann.audience || {};
  const or: any[] = [];
  if (a.everyone || a.staffAll) or.push({});
  if (a.staffRoles?.length) or.push({ role: { $in: a.staffRoles } });
  if (a.staffIds?.length) or.push({ _id: { $in: a.staffIds } });
  if (!or.length) return null;
  const q: any = { admin: ann.adminid, status: true, _id: { $ne: ann.senderid }, $or: or };
  if (ann.branchid) q.branchid = ann.branchid;
  return q;
};

const partyRecipientQuery = (ann: any): any | null => {
  const a = ann.audience || {};
  const or: any[] = [];
  if (a.everyone || a.partyAll) or.push({});
  if (a.partyChannels?.length) or.push({ channel: { $in: a.partyChannels } });
  if (a.partyIds?.length) or.push({ _id: { $in: a.partyIds } });
  if (a.myParties) or.push({ salesmanid: ann.senderid });
  if (a.mySubParties) or.push({ assignaccountid: ann.senderid });
  if (!or.length) return null;
  const q: any = { admin: ann.adminid, status: true, type: { $in: PARTY_TYPES }, _id: { $ne: ann.senderid }, $or: or };
  if (ann.branchid) q.branchid = ann.branchid;
  return q;
};

const countRecipients = async (ann: any) => {
  const sq = staffRecipientQuery(ann);
  const pq = partyRecipientQuery(ann);
  const [s, p] = await Promise.all([
    sq ? StaffAccount.countDocuments(sq) : 0,
    pq ? Account.countDocuments(pq) : 0,
  ]);
  return s + p;
};

/** Fire-and-forget phone notifications, a few at a time. */
const pushToRecipients = async (ann: any) => {
  try {
    const sq = staffRecipientQuery(ann);
    const pq = partyRecipientQuery(ann);
    const [staff, parties] = await Promise.all([
      sq ? StaffAccount.find({ ...sq, fcmtoken: { $nin: [null, ""] } }).select("fcmtoken").lean() : [],
      pq ? Account.find({ ...pq, fcmtoken: { $nin: [null, ""] } }).select("fcmtoken").lean() : [],
    ]);
    const targets = [
      ...(staff as any[]).map((s) => ({ Model: StaffAccount as any, id: s._id, token: s.fcmtoken })),
      ...(parties as any[]).map((p) => ({ Model: Account as any, id: p._id, token: p.fcmtoken })),
    ];
    const body = (ann.message || "").slice(0, 180);
    for (let i = 0; i < targets.length; i += 20) {
      await Promise.all(
        targets.slice(i, i + 20).map(async (t) => {
          const r = await sendPushToToken(t.token, {
            title: `📢 ${ann.title}`,
            body,
            // imageurl → the app shows it as a big-picture notification (offer banner).
            data: { ntype: "announcement", appscreen: "Announcements", docmodel: "Announcement", docid: String(ann._id), imageurl: ann.imageurl || "" },
          });
          if (r === "invalid-token") {
            await t.Model.updateOne({ _id: t.id, fcmtoken: t.token }, { $set: { fcmtoken: null } });
          }
        })
      );
    }
    await Announcement.updateOne({ _id: ann._id }, { $set: { pushsent: true } });
  } catch (e) {
    console.error("announcement push failed:", e);
  }
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const ROLE_LABEL: Record<string, string> = { salesman: "salesmen", deliveryboy: "delivery boys", staff: "office staff" };

const audienceLabel = (a: any = {}) => {
  if (a.everyone) return "Everyone";
  const parts: string[] = [];
  if (a.staffAll) parts.push("All staff");
  else if (a.staffRoles?.length) parts.push(`All ${a.staffRoles.map((r: string) => ROLE_LABEL[r] || r).join(", ")}`);
  if (a.staffIds?.length) parts.push(`${a.staffIds.length} staff`);
  if (a.partyAll) parts.push("All parties");
  if (a.partyChannels?.length) parts.push(`${a.partyChannels.length} channel${a.partyChannels.length > 1 ? "s" : ""}`);
  if (a.myParties) parts.push("All my parties");
  if (a.mySubParties) parts.push("All my sub-parties");
  if (a.partyIds?.length) parts.push(`${a.partyIds.length} part${a.partyIds.length > 1 ? "ies" : "y"}`);
  return parts.join(", ") || "-";
};

const format = (ann: any, extra: { readcount?: number; read?: boolean } = {}) => {
  const a = ann.audience || {};
  return {
    id: String(ann._id),
    adminid: String(ann.adminid),
    branchid: ann.branchid ? String(ann.branchid) : null,
    title: ann.title,
    message: ann.message || "",
    imageurl: ann.imageurl || "",
    link: ann.link || "",
    priority: ann.priority || "normal",
    startAt: iso(ann.startAt),
    expireAt: iso(ann.expireAt),
    audience: {
      everyone: !!a.everyone,
      staffAll: !!a.staffAll,
      staffRoles: a.staffRoles || [],
      staffIds: (a.staffIds || []).map(String),
      partyAll: !!a.partyAll,
      partyChannels: (a.partyChannels || []).map(String),
      partyIds: (a.partyIds || []).map(String),
      myParties: !!a.myParties,
      mySubParties: !!a.mySubParties,
    },
    audienceLabel: audienceLabel(a),
    sendertype: ann.sendertype,
    senderid: String(ann.senderid),
    sendername: ann.sendername || "",
    recipientcount: ann.recipientcount || 0,
    readcount: extra.readcount ?? 0,
    read: extra.read ?? false,
    isactive: ann.isactive !== false,
    createdAt: iso(ann.createdAt),
    updatedAt: iso(ann.updatedAt),
  };
};

const withReadCounts = async (rows: any[]) => {
  if (!rows.length) return [];
  const counts = await AnnouncementRead.aggregate([
    { $match: { announcementid: { $in: rows.map((r) => r._id) } } },
    { $group: { _id: "$announcementid", n: { $sum: 1 } } },
  ]);
  const map = new Map(counts.map((x: any) => [String(x._id), x.n]));
  return rows.map((r) => format(r, { readcount: map.get(String(r._id)) || 0 }));
};

/** Announcements the caller manages in the admin panel. */
const manageQuery = (c: Caller): any => {
  const q: any = { adminid: c.tenant.adminid };
  if (c.kind === "admin") {
    if (c.tenant.branchid) q.$or = [{ branchid: null }, { branchid: c.tenant.branchid }];
  } else if (c.kind === "branch") {
    q.$or = [{ branchid: c.id }, { senderid: c.id }];
  } else {
    q.senderid = c.id;
  }
  return q;
};

const loadManaged = async (c: Caller, id: string, extra: any = {}) => {
  if (!Types.ObjectId.isValid(id)) throw new TenantError("Announcement not found.", "NOT_FOUND");
  const ann: any = await Announcement.findOne({ _id: oid(id), ...manageQuery(c), ...extra });
  if (!ann) throw new TenantError("Announcement not found.", "NOT_FOUND");
  // A branch can see admin-wide notices on its branch but only edit its own.
  if (c.kind === "branch" && String(ann.senderid) !== String(c.id)) {
    throw new TenantError("You can only change announcements your branch sent.");
  }
  return ann;
};

const parseDate = (v: any, fallback: Date | null) => {
  if (!v) return fallback;
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new TenantError("Enter a valid date.", "BAD_USER_INPUT");
  return d;
};

const cleanFields = (input: any) => {
  const title = String(input.title || "").trim();
  if (!title) throw new TenantError("Title is required.", "BAD_USER_INPUT");
  const startAt = parseDate(input.startAt, new Date()) as Date;
  const expireAt = parseDate(input.expireAt, null);
  if (expireAt && expireAt <= startAt) throw new TenantError("Expiry must be after the start date.", "BAD_USER_INPUT");
  return {
    title: title.slice(0, 150),
    message: String(input.message || "").slice(0, 4000),
    imageurl: String(input.imageurl || ""),
    link: String(input.link || "").slice(0, 500),
    priority: input.priority === "important" ? "important" : "normal",
    startAt,
    expireAt,
  };
};

/* ------------------------------------------------------------------ */
/* Resolvers                                                           */
/* ------------------------------------------------------------------ */

export const announcementResolvers = {
  Query: {
    // Lets the app / website decide whether to show the Announcements menu.
    isAnnouncementsEnabled: async (_: any, __: any, context: any) => {
      try {
        await callerOf(context);
        return true;
      } catch {
        return false;
      }
    },

    getAnnouncements: async (_: any, __: any, context: any) => {
      const c = await callerOf(context);
      if (c.kind === "party") return [];
      const rows = await Announcement.find({ ...manageQuery(c), isactive: true }).sort({ startAt: -1 }).lean();
      return withReadCounts(rows);
    },

    getDeletedAnnouncements: async (_: any, __: any, context: any) => {
      const c = await callerOf(context);
      if (c.kind === "party") return [];
      const rows = await Announcement.find({ ...manageQuery(c), isactive: false }).sort({ updatedAt: -1 }).lean();
      return withReadCounts(rows);
    },

    getSentAnnouncements: async (_: any, __: any, context: any) => {
      const c = await callerOf(context);
      const rows = await Announcement.find({ adminid: c.tenant.adminid, senderid: c.id, isactive: true })
        .sort({ startAt: -1 })
        .limit(100)
        .lean();
      return withReadCounts(rows);
    },

    getMyAnnouncements: async (_: any, __: any, context: any) => {
      const c = await callerOf(context);
      if (c.kind !== "staff" && c.kind !== "party") return [];
      const now = new Date();

      const or: any[] = [{ "audience.everyone": true }];
      if (c.kind === "staff") {
        or.push({ "audience.staffAll": true }, { "audience.staffIds": c.id });
        if (c.role) or.push({ "audience.staffRoles": c.role });
      } else {
        or.push({ "audience.partyAll": true }, { "audience.partyIds": c.id });
        if (c.channel) or.push({ "audience.partyChannels": c.channel });
        if (c.salesmanid) or.push({ "audience.myParties": true, senderid: c.salesmanid });
        if (c.assignaccountid) or.push({ "audience.mySubParties": true, senderid: c.assignaccountid });
      }

      const rows: any[] = await Announcement.find({
        adminid: c.tenant.adminid,
        isactive: true,
        senderid: { $ne: c.id },
        startAt: { $lte: now },
        $and: [
          { $or: [{ expireAt: null }, { expireAt: { $gt: now } }] },
          { $or: [{ branchid: null }, ...(c.branchid ? [{ branchid: c.branchid }] : [])] },
          { $or: or },
        ],
      })
        .sort({ startAt: -1 })
        .limit(100)
        .lean();

      const reads = await AnnouncementRead.find({
        readerid: c.id,
        readertype: c.kind,
        announcementid: { $in: rows.map((r) => r._id) },
      })
        .select("announcementid")
        .lean();
      const readSet = new Set(reads.map((r: any) => String(r.announcementid)));
      return rows.map((r) => format(r, { read: readSet.has(String(r._id)) }));
    },

    getAnnouncementTargets: async (_: any, __: any, context: any) => {
      const c = await callerOf(context);
      const adminid = c.tenant.adminid;
      const out: any = { staff: [], parties: [], channels: [] };
      // No "Add" permission → nobody to pick, so the app / website hide "Send".
      if (!(await isActionAllowed(MODULE, "add", c.scope || { adminid }))) return out;

      if (c.kind === "admin" || c.kind === "branch") {
        const branch = c.kind === "branch" ? c.id : c.tenant.branchid;
        const sq: any = { admin: adminid, status: true };
        const pq: any = { admin: adminid, status: true, type: { $in: PARTY_TYPES } };
        if (branch) { sq.branchid = branch; pq.branchid = branch; }
        const [staff, parties, channels] = await Promise.all([
          StaffAccount.find(sq).select("name role staffcode").sort({ name: 1 }).lean(),
          Account.find(pq).select("name mobile city").sort({ name: 1 }).lean(),
          Channel.find({ admin: adminid }).select("channelName").sort({ channelName: 1 }).lean(),
        ]);
        out.staff = (staff as any[]).map((s) => ({ id: String(s._id), name: s.name, sub: s.role }));
        out.parties = (parties as any[]).map((p) => ({ id: String(p._id), name: p.name, sub: [p.mobile, p.city].filter(Boolean).join(" · ") }));
        out.channels = (channels as any[]).map((x) => ({ id: String(x._id), name: x.channelName }));
      } else if (c.kind === "staff" && c.role === "salesman") {
        const parties = await Account.find({ admin: adminid, status: true, salesmanid: c.id }).select("name mobile city").sort({ name: 1 }).lean();
        out.parties = (parties as any[]).map((p) => ({ id: String(p._id), name: p.name, sub: [p.mobile, p.city].filter(Boolean).join(" · ") }));
      } else if (c.kind === "party") {
        // Nothing to pick unless the business lets parties manage sub-parties.
        const st: any = await AdminSettings.findOne({ adminid }).select("partyManagesDownline").lean();
        if (!st?.partyManagesDownline) return out;
        const parties = await Account.find({ admin: adminid, status: true, assignaccountid: c.id }).select("name mobile city").sort({ name: 1 }).lean();
        out.parties = (parties as any[]).map((p) => ({ id: String(p._id), name: p.name, sub: [p.mobile, p.city].filter(Boolean).join(" · ") }));
      }
      return out;
    },
  },

  Mutation: {
    addAnnouncement: async (_: any, { input }: any, context: any) => {
      const c = await callerOf(context);
      await assertCanSend(c);
      const fields = cleanFields(input);
      const branchid = await branchFor(c, input.branchid);
      const audience = await sanitizeAudience(c, input.audience, branchid);

      const ann: any = await Announcement.create({
        ...fields,
        adminid: c.tenant.adminid,
        branchid,
        audience,
        sendertype: c.kind,
        senderid: c.id,
        sendername: c.name,
      });
      ann.recipientcount = await countRecipients(ann);
      await ann.save();

      // Scheduled for later → no push now; it simply appears in feeds then.
      if (ann.startAt.getTime() <= Date.now() + 60_000) {
        pushToRecipients(ann.toObject()).catch(() => {});
      }
      return format(ann.toObject());
    },

    editAnnouncement: async (_: any, { id, input }: any, context: any) => {
      const c = await callerOf(context);
      await assertCanSend(c);
      const ann = await loadManaged(c, id, { isactive: true });
      // A message is edited only by whoever sent it (an admin can still delete
      // a salesman's or party's announcement, but not put words in it).
      if (String(ann.senderid) !== String(c.id)) {
        throw new TenantError("Only the sender can edit this announcement.");
      }
      const fields = cleanFields(input);
      const branchid = c.kind === "admin" ? await branchFor(c, input.branchid) : ann.branchid;
      const audience = await sanitizeAudience(c, input.audience, branchid);
      Object.assign(ann, fields, { branchid, audience });
      ann.recipientcount = await countRecipients(ann);
      await ann.save();
      const [one] = await withReadCounts([ann.toObject()]);
      return one;
    },

    deleteAnnouncement: async (_: any, { id }: any, context: any) => {
      const c = await callerOf(context);
      const ann = await loadManaged(c, id, { isactive: true });
      ann.isactive = false;
      await ann.save();
      return true;
    },

    resetAnnouncement: async (_: any, { id }: any, context: any) => {
      const c = await callerOf(context);
      const ann = await loadManaged(c, id, { isactive: false });
      ann.isactive = true;
      await ann.save();
      return true;
    },

    markAnnouncementRead: async (_: any, { id }: any, context: any) => {
      const c = await callerOf(context);
      if (c.kind !== "staff" && c.kind !== "party") return false;
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      const exists = await Announcement.exists({ _id: oid(id), adminid: c.tenant.adminid });
      if (!exists) return false;
      await AnnouncementRead.updateOne(
        { announcementid: oid(id), readertype: c.kind, readerid: c.id },
        { $setOnInsert: { announcementid: oid(id), readertype: c.kind, readerid: c.id } },
        { upsert: true }
      );
      return true;
    },
  },
};
