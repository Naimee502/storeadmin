import { ApolloError } from "apollo-server-express";
import { OfflineDevice } from "../../../models/offlinedevice";
import { DEVICE_CODE_RX, OFFLINE_DOC_TYPES, deviceCodeFromIndex, deviceCodeIndex, isoOf, tenantOf } from "../../../utils/offlinesync";

export { tenantOf } from "../../../utils/offlinesync";

const formatDevice = (d: any) =>
  d && {
    ...d,
    id: String(d._id),
    adminid: String(d.adminid),
    branchid: d.branchid ? String(d.branchid) : null,
    createdby_id: d.createdby_id ? String(d.createdby_id) : null,
    lastSeen: isoOf(d.lastSeen),
    lastSeq: d.lastSeq || {},
    createdAt: isoOf(d.createdAt),
    updatedAt: isoOf(d.updatedAt),
  };

// Only known doc types, non-negative integers.
const cleanSeq = (raw: any): Record<string, number> => {
  let v = raw;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { v = null; }
  }
  const out: Record<string, number> = {};
  if (!v || typeof v !== "object") return out;
  for (const t of OFFLINE_DOC_TYPES) {
    const n = Number(v[t]);
    if (Number.isInteger(n) && n >= 0) out[t] = n;
  }
  return out;
};

export const offlineDeviceResolvers = {
  Query: {
    getOfflineDevices: async (_: any, __: any, context: any) => {
      const { adminid } = await tenantOf(context);
      const rows = await OfflineDevice.find({ adminid }).lean();
      // A, B, ... Z, AA: by code index, not plain text order.
      rows.sort((a: any, b: any) => deviceCodeIndex(a.code) - deviceCodeIndex(b.code));
      return rows.map(formatDevice);
    },
  },

  Mutation: {
    registerOfflineDevice: async (_: any, { name }: { name: string }, context: any) => {
      const { adminid, branchid } = await tenantOf(context);
      const user = context.user;
      const cleanName = String(name || "").trim();
      if (!cleanName) throw new ApolloError("Device name is required.", "BAD_USER_INPUT");

      // Next code after the highest one ever issued, so a code is never reused.
      for (let attempt = 0; attempt < 20; attempt++) {
        const codes: any[] = await OfflineDevice.find({ adminid }).select("code").lean();
        const highest = codes.reduce((m, d) => Math.max(m, deviceCodeIndex(d.code)), -1);
        const code = deviceCodeFromIndex(highest + 1);
        if (!DEVICE_CODE_RX.test(code)) throw new ApolloError("No more device codes are available.", "LIMIT_REACHED");
        try {
          const created = await OfflineDevice.create({
            adminid,
            branchid: branchid || undefined,
            code,
            name: cleanName,
            createdby_id: user.id,
            createdby_type: user.type,
            lastSeen: new Date(),
            lastSeq: {},
          });
          return formatDevice(created.toObject());
        } catch (e: any) {
          // Another device took this code at the same moment: try the next one.
          if (e?.code === 11000) continue;
          throw e;
        }
      }
      throw new ApolloError("Could not assign a device code. Please try again.", "RETRY");
    },

    offlineDeviceHeartbeat: async (_: any, { code, lastSeq }: { code: string; lastSeq?: any }, context: any) => {
      const { adminid } = await tenantOf(context);
      const max: Record<string, number> = {};
      for (const [t, n] of Object.entries(cleanSeq(lastSeq))) max[`lastSeq.${t}`] = n;
      const update: any = { $set: { lastSeen: new Date() } };
      if (Object.keys(max).length) update.$max = max;
      const doc = await OfflineDevice.findOneAndUpdate({ adminid, code: String(code || "") }, update, { new: true }).lean();
      return doc ? formatDevice(doc) : null;
    },
  },
};
