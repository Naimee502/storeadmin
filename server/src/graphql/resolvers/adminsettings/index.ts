import { AdminSettings } from "../../../models/adminsettings";

const formatSettings = (s: any) =>
  s
    ? {
        ...s,
        id: s._id?.toString?.() ?? s.id,
        adminid: s.adminid?.toString?.() ?? s.adminid,
      }
    : null;

export const adminSettingsResolvers = {
  Query: {
    getAdminSettings: async (_: any, { adminid }: { adminid: string }) => {
      const doc = await AdminSettings.getOrCreateForAdmin(adminid);
      return formatSettings(doc.toObject ? doc.toObject() : doc);
    },
  },

  Mutation: {
    // Partial-merge update: only the fields present in `input` get written;
    // everything else is preserved. Lazy-creates the row first if missing
    // so first-time writers always succeed.
    updateAdminSettings: async (
      _: any,
      { adminid, input }: { adminid: string; input: any }
    ) => {
      const doc = await AdminSettings.getOrCreateForAdmin(adminid);
      const $set: any = {};
      Object.keys(input || {}).forEach((k) => {
        if (input[k] !== undefined) $set[k] = input[k];
      });
      const updated = await AdminSettings.findByIdAndUpdate(
        doc._id,
        { $set },
        { new: true }
      ).lean();
      return formatSettings(updated);
    },
  },
};
