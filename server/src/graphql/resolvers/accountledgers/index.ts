import { AccountLedger } from "../../../models/accountledgers";

export const accountLedgerResolvers = {
  Query: {
    getAccountLedgers: async (_: any, { adminId }: { adminId?: string }) => {
          const filter: any = { status: true };
          if (adminId) filter.admin = adminId;
           return await AccountLedger.find(filter)
          .populate("admin")
          .populate("accountgroupid")
          .populate("branchid");
        },

    getDeletedAccountLedgers: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false };
      if (adminId) filter.admin = adminId;

      return await AccountLedger.find(filter)
        .populate("admin")
        .populate("accountgroupid")
        .populate("branchid");
    },

    getAccountLedgerById: async (_: any, { id }: { id: string }) => {
      return await AccountLedger.findById(id)
        .populate("admin")
        .populate("accountgroupid")
        .populate("branchid");
    },
  },

  Mutation: {
    addAccountLedger: async (_: any, { input }: any) => {
      const ledger = await AccountLedger.create(input);
      return await AccountLedger.findById(ledger._id)
        .populate("admin")
        .populate("accountgroupid");
    },

    editAccountLedger: async (_: any, { id, input }: any) => {
      return await AccountLedger.findByIdAndUpdate(id, input, { new: true })
        .populate("admin")
        .populate("accountgroupid");
    },

    deleteAccountLedger: async (_: any, { id }: any) => {
      const result = await AccountLedger.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetAccountLedger: async (_: any, { id }: any) => {
      const result = await AccountLedger.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    }
  }
};
