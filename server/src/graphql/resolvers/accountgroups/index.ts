import { AccountGroup } from "../../../models/accountgroups";

export const accountGroupResolvers = {
  Query: {
    getAccountGroups: async () => {
      const accountGroups = await AccountGroup.find({ status: true });
      return accountGroups;
    },
    getAccountGroupById: async (_: any, { id }: { id: string }) => {
      return await AccountGroup.findById(id);
    },
  },
  Mutation: {
    addAccountGroup: async (_: any, { input }: any) => {
      return await AccountGroup.create(input);
    },
    editAccountGroup: async (_: any, { id, input }: any) => {
      return await AccountGroup.findByIdAndUpdate(id, input, { new: true });
    },
    deleteAccountGroup: async (_: any, { id }: any) => {
      const result = await AccountGroup.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
  },
};
