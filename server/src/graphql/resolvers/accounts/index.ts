import { Account } from "../../../models/accounts";

export const accountResolvers = {
  Query: {
    getAccounts: async (_: any, args: { branchid?: string }) => {
      const query: any = { status: true };
      if (args.branchid) {
        query.branchid = args.branchid;
      }
      return await Account.find(query);
    },
    getDeletedAccounts: async (_: any, args: { branchid?: string }) => {
      const query: any = { status: false };
      if (args.branchid) {
        query.branchid = args.branchid;
      }
      return await Account.find(query);
    },
    getAccountById: async (_: any, { id }: { id: string }) => {
      return await Account.findById(id);
    },
  },
  Mutation: {
    addAccount: async (_: any, { input }: any) => {
      return await Account.create(input);
    },
    editAccount: async (_: any, { id, input }: any) => {
      return await Account.findByIdAndUpdate(id, input, { new: true });
    },
    deleteAccount: async (_: any, { id }: any) => {
      const result = await Account.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
    resetAccount: async (_: any, { id }: any) => {
      const result = await Account.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    }
  },
};
