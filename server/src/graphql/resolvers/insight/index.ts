import { Insight } from "../../../models/insight";
import { TenantError, requireBackofficeTenant } from "../../../utils/tenant";
import { assertModuleOn } from "../../../utils/modulegate";
import { notCleared } from "../../../utils/listquery";
import { findInsights } from "../../../utils/insightfinder";
import { salesmanScorecard } from "../../../utils/scorecard";
import { isActionAllowed } from "../../../utils/permissiongate";

const isoOf = (d: any) => (d ? new Date(d).toISOString() : null);
const STATES = ["open", "done", "dismissed"];

async function gate(context: any) {
  const scope = await requireBackofficeTenant(context);
  await assertModuleOn("reports.pulse", "Business Pulse", {
    adminid: scope.adminid,
    branchid: scope.userType === "admin" ? undefined : scope.branchid,
    staffid: scope.userType === "staff" ? scope.userId : undefined,
  });
  return scope;
}

const pulseScope = (scope: any) => {
  const q: any = { adminid: scope.adminid, status: true, ...notCleared };
  // Saved with no branch: belongs to every branch.
  const b = scope.userType === "admin" ? undefined : scope.branchid;
  if (b) q.$and = [{ $or: [{ branchid: b }, { branchid: null }] }];
  return q;
};

const shape = (r: any) => ({
  id: String(r._id),
  kind: r.kind,
  title: r.title,
  reason: r.reason,
  evidence: r.evidence || [],
  value: Number(r.value) || 0,
  score: Number(r.score) || 0,
  partyacc: r.partyacc ? String(r.partyacc) : null,
  productid: r.productid ? String(r.productid) : null,
  name: r.name,
  mobile: r.mobile,
  city: r.city,
  dueAt: isoOf(r.dueAt),
  lastorderAt: isoOf(r.lastorderAt),
  draftmessage: r.draftmessage,
  state: r.state || "open",
  foundAt: isoOf(r.foundAt),
});

async function pulse(scope: any, kind?: string, limit = 12) {
  const q = { ...pulseScope(scope), state: "open", ...(kind ? { kind } : {}) };
  const [rows, counts] = await Promise.all([
    Insight.find(q).sort({ value: -1, score: -1 }).limit(Math.min(Math.max(Number(limit) || 12, 1), 50)).lean(),
    Insight.aggregate([
      { $match: { ...pulseScope(scope), state: "open" } },
      { $group: { _id: "$kind", n: { $sum: 1 }, value: { $sum: "$value" } } },
    ]),
  ]);
  return {
    insights: rows.map(shape),
    counts: Object.fromEntries(counts.map((c: any) => [c._id, c.n])),
    value: counts.reduce((t: number, c: any) => t + (Number(c.value) || 0), 0),
    scannedAt: isoOf(rows[0]?.foundAt),
  };
}

export const insightResolvers = {
  Query: {
    getBusinessPulse: async (_: any, { kind, limit }: any, context: any) => {
      const scope = await gate(context);
      return pulse(scope, kind, limit);
    },

    getSalesmanScorecard: async (_: any, { days = 30 }: any, context: any) => {
      const scope = await gate(context);
      const allowed = await isActionAllowed("reports.salesmen", "view", {
        adminid: scope.adminid,
        branchid: scope.userType === "admin" ? undefined : scope.branchid,
        staffid: scope.userType === "staff" ? scope.userId : undefined,
      });
      if (!allowed) return [];
      return salesmanScorecard(scope, Number(days) || 30);
    },
  },

  Mutation: {
    scanBusinessPulse: async (_: any, __: any, context: any) => {
      const scope = await gate(context);
      await findInsights(scope.adminid);
      return pulse(scope);
    },

    setInsightState: async (_: any, { id, state }: any, context: any) => {
      const scope = await gate(context);
      if (!STATES.includes(state)) throw new TenantError("Unknown state.", "BAD_USER_INPUT");
      const row: any = await Insight.findOne({ _id: id, adminid: scope.adminid }).lean();
      if (!row) throw new TenantError("Not found.", "BAD_USER_INPUT");
      await Insight.updateOne({ _id: id }, { $set: { state, actedAt: new Date() } });
      return shape({ ...row, state });
    },
  },
};
