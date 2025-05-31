import { Account } from "../../../models/accounts";

export const accountResolvers = {
  Query: {
    getAccounts: async () => {
      return await Account.find({ status: true });
    },
    getDeletedAccounts: async () => {
      return await Account.find({ status: false });
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
