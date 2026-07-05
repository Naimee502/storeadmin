import mongoose from "mongoose";
import { LocationPing } from "../../../models/locationping";

const buildQuery = (filter: any = {}) => {
  const query: any = { status: true };
  if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
  if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
  if (filter.staffid) query.staffid = new mongoose.Types.ObjectId(filter.staffid);
  if (filter.role) query.role = filter.role;
  if (filter.dateFrom || filter.dateTo) {
    query.pingdate = {};
    if (filter.dateFrom) query.pingdate.$gte = filter.dateFrom;
    if (filter.dateTo) query.pingdate.$lte = filter.dateTo;
  }
  return query;
};

export const locationPingResolvers = {
  Query: {
    // Full trail (ordered) — used to draw the travelled route for a day.
    getLocationPings: async (_: any, { filter = {} }: { filter?: any }) => {
      return await LocationPing.find(buildQuery(filter))
        .populate("staffid")
        .sort({ pingedAt: 1 });
    },

    // Most recent ping per staff — used for a "live location" map.
    getLatestLocations: async (_: any, { filter = {} }: { filter?: any }) => {
      const pings = await LocationPing.find(buildQuery(filter))
        .populate("staffid")
        .sort({ pingedAt: -1 });
      const latestByStaff: Record<string, any> = {};
      for (const p of pings as any[]) {
        const key = String(p.staffid?._id || p.staffid);
        if (!latestByStaff[key]) latestByStaff[key] = p;
      }
      return Object.values(latestByStaff);
    },
  },

  Mutation: {
    addLocationPing: async (_: any, { input }: any) => {
      return await LocationPing.create(input);
    },

    addLocationPings: async (_: any, { inputs }: any) => {
      if (!Array.isArray(inputs) || !inputs.length) return 0;
      const res = await LocationPing.insertMany(inputs);
      return res.length;
    },
  },
};
