import { ChargeRule } from "../../../models/chargerule";

const populate = [{ path: "ledgerid", select: "ledgername" }];

const formatRule = (r: any) => {
  if (!r) return null;
  return {
    ...r,
    id: r._id?.toString?.() ?? r.id,
    adminid: r.adminid?.toString?.() ?? r.adminid,
    ledgerid: r.ledgerid
      ? { id: r.ledgerid._id?.toString?.() ?? r.ledgerid, ledgername: r.ledgerid.ledgername ?? null }
      : null,
  };
};

export const chargeRuleResolvers = {
  Query: {
    getChargeRules: async (_: any, { adminid }: { adminid: string }) => {
      const rules = await ChargeRule.find({ adminid, status: true })
        .sort({ priority: 1, createdAt: 1 })
        .populate(populate)
        .lean();
      return rules.map(formatRule);
    },
    getDeletedChargeRules: async (_: any, { adminid }: { adminid: string }) => {
      const rules = await ChargeRule.find({ adminid, status: false })
        .sort({ priority: 1, createdAt: 1 })
        .populate(populate)
        .lean();
      return rules.map(formatRule);
    },
    getChargeRuleById: async (_: any, { id }: { id: string }) => {
      const rule = await ChargeRule.findById(id).populate(populate).lean();
      return rule ? formatRule(rule) : null;
    },
  },

  Mutation: {
    addChargeRule: async (_: any, { input }: any) => {
      const created = await ChargeRule.create(input);
      const rule = await ChargeRule.findById(created._id).populate(populate).lean();
      return formatRule(rule);
    },
    editChargeRule: async (_: any, { id, input }: any) => {
      const updated = await ChargeRule.findByIdAndUpdate(id, { $set: input }, { new: true })
        .populate(populate)
        .lean();
      return formatRule(updated);
    },
    deleteChargeRule: async (_: any, { id }: { id: string }) => {
      return !!(await ChargeRule.findByIdAndUpdate(id, { status: false }));
    },
    resetChargeRule: async (_: any, { id }: { id: string }) => {
      return !!(await ChargeRule.findByIdAndUpdate(id, { status: true }));
    },
  },
};
