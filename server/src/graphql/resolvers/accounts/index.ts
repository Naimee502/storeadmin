import { Account } from "../../../models/accounts";

export const accountResolvers = {
  Query: {
    // Get active accounts (status: true), filtered by optional admin and/or branch
    getAccounts: async (
      _: any,
      args: { adminId?: string; branchid?: string }
    ) => {
      const query: any = { status: true };
      if (args.adminId) query.admin = args.adminId;
      if (args.branchid) query.branchid = args.branchid;
      return await Account.find(query).populate("admin");
    },

    // Get soft-deleted accounts (status: false)
    getDeletedAccounts: async (
      _: any,
      args: { adminId?: string; branchid?: string }
    ) => {
      const query: any = { status: false };
      if (args.adminId) query.admin = args.adminId;
      if (args.branchid) query.branchid = args.branchid;
      return await Account.find(query).populate("admin");
    },

    // Get account by ID with optional admin verification
    getAccountById: async (
      _: any,
      { id, adminId }: { id: string; adminId?: string }
    ) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await Account.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    addAccount: async (_: any, { input }: any) => {
      const created = await Account.create(input);
      return await Account.findById(created._id).populate("admin");
    },

    editAccount: async (_: any, { id, input }: any) => {
      return await Account.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    deleteAccount: async (_: any, { id }: any) => {
      const result = await Account.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetAccount: async (_: any, { id }: any) => {
      const result = await Account.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
