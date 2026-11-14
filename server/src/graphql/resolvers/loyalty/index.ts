import { Types } from "mongoose";
import { Account } from "../../../models/accounts";
import { LoyaltyEntry } from "../../../models/loyalty";
import { requireBackofficeTenant, resolveTenant, TenantError } from "../../../utils/tenant";
import { balanceOf, loyaltyOn, loyaltyRules } from "../../../utils/loyalty";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const account = async (adminid: any, partyid: any) => {
  const [rules, enabled, balance, lines, totals]: any[] = await Promise.all([
    loyaltyRules(adminid), loyaltyOn(adminid), balanceOf(adminid, partyid),
    LoyaltyEntry.find({ adminid, partyid }).sort({ createdAt: -1 }).limit(100).lean(),
    LoyaltyEntry.aggregate([
      { $match: { adminid: new Types.ObjectId(String(adminid)), partyid: new Types.ObjectId(String(partyid)) } },
      { $group: { _id: "$kind", p: { $sum: "$points" } } },
    ]),
  ]);
  const by = (k: string) => r2(totals.find((t: any) => t._id === k)?.p || 0);
  return {
    rules: { ...rules, enabled }, balance, value: r2(balance * rules.pointValue),
    earned: by("earn"), redeemed: -by("redeem"),
    history: lines.map((l: any) => ({ id: String(l._id), kind: l.kind, points: l.points, docno: l.docno || null, note: l.note || null, createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : null })),
  };
};

const ownParty = async (adminid: any, partyid: any) => {
  if (!Types.ObjectId.isValid(String(partyid)) || !(await Account.exists({ _id: partyid, admin: adminid }))) {
    throw new TenantError("Party not found.", "NOT_FOUND");
  }
};

export const loyaltyResolvers = {
  Query: {
    getPartyLoyalty: async (_: any, { partyid }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      await ownParty(scope.adminid, partyid);
      return account(scope.adminid, partyid);
    },
    getMyLoyalty: async (_: any, __: any, context: any) => {
      if (context?.user?.type !== "party") throw new TenantError("Please sign in.", "UNAUTHENTICATED");
      const scope = await resolveTenant(context);
      return account(scope.adminid, context.user.id);
    },
    getLoyaltySummary: async (_: any, __: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      const [rules, enabled, rows]: any[] = await Promise.all([
        loyaltyRules(scope.adminid), loyaltyOn(scope.adminid),
        LoyaltyEntry.aggregate([
          { $match: { adminid: new Types.ObjectId(String(scope.adminid)) } },
          { $group: {
            _id: "$partyid",
            earned: { $sum: { $cond: [{ $eq: ["$kind", "earn"] }, "$points", 0] } },
            redeemed: { $sum: { $cond: [{ $eq: ["$kind", "redeem"] }, "$points", 0] } },
            expired: { $sum: { $cond: [{ $eq: ["$kind", "expire"] }, "$points", 0] } },
            balance: { $sum: "$points" },
          } },
          { $sort: { balance: -1 } },
          { $limit: 1000 },
        ]),
      ]);
      const parties: any[] = await Account.find({ _id: { $in: rows.map((r: any) => r._id) } }).select("name mobile city").lean();
      const byId = new Map(parties.map((p) => [String(p._id), p]));
      const sum = (k: string) => r2(rows.reduce((t: number, r: any) => t + (r[k] || 0), 0));
      const balance = sum("balance");
      return {
        rules: { ...rules, enabled }, earned: sum("earned"), redeemed: -sum("redeemed"), expired: -sum("expired"),
        balance, liability: r2(balance * rules.pointValue),
        parties: rows.map((r: any) => {
          const p: any = byId.get(String(r._id));
          return { partyid: String(r._id), name: p?.name || null, mobile: p?.mobile || null, city: p?.city || null,
            earned: r2(r.earned), redeemed: r2(-r.redeemed), expired: r2(-r.expired), balance: r2(r.balance) };
        }),
      };
    },
  },
  Mutation: {
    adjustLoyaltyPoints: async (_: any, { partyid, points, note }: any, context: any) => {
      const scope = await requireBackofficeTenant(context);
      if (scope.userType !== "admin") throw new TenantError("Only the business owner can adjust points.", "FORBIDDEN");
      await ownParty(scope.adminid, partyid);
      const p = Math.round(Number(points) || 0);
      if (!p) throw new TenantError("Enter the points to add (or minus to remove).", "BAD_USER_INPUT");
      if (!String(note || "").trim()) throw new TenantError("Write a note for this change.", "BAD_USER_INPUT");
      if (p < 0 && (await balanceOf(scope.adminid, partyid)) + p < 0) throw new TenantError("The party does not have that many points.", "BAD_USER_INPUT");
      await LoyaltyEntry.create({ adminid: scope.adminid, partyid, kind: "adjust", points: p, note: String(note).trim().slice(0, 200), createdby_name: context?.user?.name || context?.user?.email });
      return account(scope.adminid, partyid);
    },
  },
};
