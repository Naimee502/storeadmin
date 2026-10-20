import mongoose from "mongoose";
import { LocationPing } from "../../../models/locationping";
import { travelledMeters } from "../../../utils/travel";

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
    // Only the newest point per staff member. This used to load every ping in
    // the range and pick the latest in memory; with points now recorded every
    // ~25 m that is a lot of rows for a table that shows one per salesman. Now
    // it is one indexed lookup per staff member instead.
    getLatestLocations: async (_: any, { filter = {} }: { filter?: any }) => {
      const query = buildQuery(filter);
      const staffIds: any[] = await LocationPing.distinct("staffid", query);
      const latest = await Promise.all(
        staffIds.map((sid) =>
          LocationPing.findOne({ ...query, staffid: sid })
            .sort({ pingedAt: -1 })
            .populate("staffid")
        )
      );
      return latest.filter(Boolean);
    },

    // Kilometres covered per staff per day (see utils/travel for how GPS
    // jitter and jumps are kept out of the total).
    getTravelSummary: async (_: any, { filter = {} }: { filter?: any }) => {
      const pings: any[] = await LocationPing.find(buildQuery(filter))
        .select("staffid role pingdate latitude longitude accuracy pingedAt")
        .populate("staffid", "name")
        .sort({ pingedAt: 1 })
        .lean();
      const groups = new Map<string, any[]>();
      for (const p of pings) {
        const key = `${String(p.staffid?._id || p.staffid)}|${p.pingdate}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(p);
      }
      return Array.from(groups.values()).map((list) => {
        const first = list[0];
        const last = list[list.length - 1];
        return {
          staffid: String(first.staffid?._id || first.staffid),
          staffname: first.staffid?.name || "",
          role: first.role || "",
          pingdate: first.pingdate,
          km: Math.round((travelledMeters(list) / 1000) * 100) / 100,
          points: list.length,
          firstAt: first.pingedAt ? new Date(first.pingedAt).toISOString() : null,
          lastAt: last.pingedAt ? new Date(last.pingedAt).toISOString() : null,
        };
      });
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
