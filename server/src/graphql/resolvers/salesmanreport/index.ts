import { Visit } from "../../../models/visit";
import { AdminSettings } from "../../../models/adminsettings";
import {
  buildPerformance, buildFieldData, buildProductSales, buildOrderLines, checkGeoFence, istYMD, daysBetween,
} from "../../../utils/fieldreport";

const populatePaths = ["salesmanid", "partyacc", "routeid"];

const shiftYMD = (ymd: string, days: number) =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export const salesmanReportResolvers = {
  Query: {
    getSalesmanPerformance: async (_: any, { filter }: any) => buildPerformance(filter),

    getSalesmanCallLog: async (_: any, { filter }: any) => {
      const { log } = await buildFieldData(filter);
      return log.sort((a, b) =>
        b.date.localeCompare(a.date) || a.salesmanname.localeCompare(b.salesmanname) ||
        String(a.routename || "~").localeCompare(String(b.routename || "~")));
    },

    getSalesmanProductSales: async (_: any, { filter }: any) => buildProductSales(filter),
    getSalesmanOrderLines: async (_: any, { filter }: any) => buildOrderLines(filter),

    // Salesman app home: today, this month (target) and the last 7 days.
    getSalesmanDashboard: async (_: any, { adminid, salesmanid, date }: any) => {
      const day = date || istYMD();
      const [today] = await buildPerformance({ adminid, salesmanid, dateFrom: day, dateTo: day });
      const [month] = await buildPerformance({ adminid, salesmanid, dateFrom: `${day.slice(0, 7)}-01`, dateTo: day });
      const [week] = await buildPerformance({ adminid, salesmanid, dateFrom: shiftYMD(day, -6), dateTo: day });
      if (!today) throw new Error("Salesman not found.");
      return { today, month, last7: week?.daily || daysBetween(shiftYMD(day, -6), day).map((d) => ({ date: d })) };
    },

    getSalesmanLeaderboard: async (_: any, { adminid, month, salesmanid }: any) => {
      const today = istYMD();
      const m = /^\d{4}-\d{2}$/.test(month || "") ? month : today.slice(0, 7);
      const lastDay = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);
      const dateTo = lastDay < today ? lastDay : today;
      // Business Settings switch: off = salesmen cannot see each other's figures.
      const st: any = await AdminSettings.findOne({ adminid }).select("salesmanLeaderboardEnabled").lean();
      if (st?.salesmanLeaderboardEnabled === false) return { enabled: false, month: m, rows: [] };
      if (`${m}-01` > today) return { enabled: true, month: m, rows: [] };
      const perf = await buildPerformance({ adminid, dateFrom: `${m}-01`, dateTo });
      // Salesmen with a target first, by % achieved; the rest by order value.
      const sorted = perf.sort((a: any, b: any) =>
        Number(b.monthTarget > 0) - Number(a.monthTarget > 0) ||
        b.monthAchievedPct - a.monthAchievedPct ||
        b.monthAchieved - a.monthAchieved);
      return {
        enabled: true,
        month: m,
        rows: sorted.map((p: any, i: number) => ({
          rank: i + 1,
          salesmanid: p.salesmanid,
          salesmanname: p.salesmanname,
          isMe: !!salesmanid && String(salesmanid) === p.salesmanid,
          monthTarget: p.monthTarget,
          monthAchieved: p.monthAchieved,
          monthAchievedPct: p.monthAchievedPct,
          orders: p.orders,
          productiveCalls: p.productiveCalls,
          totalCalls: p.totalCalls,
          productivityPct: p.productivityPct,
          collections: p.collections,
        })),
      };
    },

    checkGeoFence: async (_: any, { adminid, partyacc, latitude, longitude, accuracy }: any) =>
      checkGeoFence(adminid, partyacc, latitude, longitude, accuracy),
  },

  Mutation: {
    /**
     * One call per salesman + party + day. "productive" (order booked) always
     * wins over "unproductive" (visited, no order). The geo-fence is checked
     * here too, so a call cannot be recorded from outside the radius.
     */
    markVisit: async (_: any, { input }: any, context: any) => {
      const outcome = String(input.outcome || "").toLowerCase();
      if (!["productive", "unproductive"].includes(outcome)) throw new Error("outcome must be productive or unproductive");
      if (outcome === "unproductive" && !String(input.reason || "").trim()) throw new Error("Select a reason for no order.");

      const geo = await checkGeoFence(input.adminid, input.partyacc, input.latitude, input.longitude, input.accuracy);
      if (!geo.allowed && outcome === "unproductive") throw new Error(geo.message || "You are not at the party's location.");

      const visitdate = istYMD();
      const user = context?.user;
      const existing: any = await Visit.findOne({
        adminid: input.adminid, salesmanid: input.salesmanid, partyacc: input.partyacc, visitdate, status: true,
      });

      const base: any = {
        visited: true,
        latitude: input.latitude ?? undefined,
        longitude: input.longitude ?? undefined,
        visitedAt: new Date(),
      };
      if (input.routeid) base.routeid = input.routeid;
      if (input.day) base.day = input.day;

      if (existing) {
        if (existing.ordercreated && outcome === "unproductive") {
          return Visit.findById(existing._id).populate(populatePaths);
        }
        Object.assign(existing, base);
        if (outcome === "productive") {
          existing.ordercreated = true;
          if (input.orderid) existing.orderid = input.orderid;
          existing.reason = undefined;
        } else {
          existing.reason = input.reason;
          existing.notes = input.notes;
        }
        await existing.save();
        return Visit.findById(existing._id).populate(populatePaths);
      }

      const created = await Visit.create({
        adminid: input.adminid,
        branchid: input.branchid || null,
        salesmanid: input.salesmanid,
        partyacc: input.partyacc,
        visitdate,
        ...base,
        ordercreated: outcome === "productive",
        orderid: input.orderid || null,
        reason: outcome === "unproductive" ? input.reason : undefined,
        notes: input.notes,
        createdby_id: user?.id,
        createdby_name: user?.name || user?.email,
        createdby_type: user?.type || "staff",
      });
      return Visit.findById(created._id).populate(populatePaths);
    },
  },
};
