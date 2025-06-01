import { SalesmenAccount } from "../../../models/salesmenaccount";

export const salesmenAccountResolvers = {
  Query: {
    getSalesmenAccounts: async (_: any, args: { branchid?: string }) => {
      const query: any = { status: true };
      if (args.branchid) {
        query.branchid = args.branchid;
      }
      return await SalesmenAccount.find(query);
    },

    getDeletedSalesmenAccounts: async (_: any, args: { branchid?: string }) => {
      const query: any = { status: false };
      if (args.branchid) {
        query.branchid = args.branchid;
      }
      return await SalesmenAccount.find(query);
    },
    getSalesmanAccountById: async (_: any, { id }: { id: string }) => {
      return await SalesmenAccount.findById(id);
    },
  },
  Mutation: {
    addSalesmanAccount: async (_: any, { input }: any) => {
      return await SalesmenAccount.create(input);
    },
    editSalesmanAccount: async (_: any, { id, input }: any) => {
      return await SalesmenAccount.findByIdAndUpdate(id, input, { new: true });
    },
    deleteSalesmanAccount: async (_: any, { id }: any) => {
      const result = await SalesmenAccount.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
    resetSalesmanAccount: async (_: any, { id }: any) => {
      const result = await SalesmenAccount.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
