import { SalesmenAccount } from "../../../models/salesmenaccount";

export const salesmenAccountResolvers = {
  Query: {
    getSalesmenAccounts: async () => {
      const accounts = await SalesmenAccount.find({ status: true });
      return accounts;
    },
    getDeletedSalesmenAccounts: async () => {
      const deletedAccounts = await SalesmenAccount.find({ status: false });
      return deletedAccounts;
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
