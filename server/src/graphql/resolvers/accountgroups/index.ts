import { AccountGroup } from "../../../models/accountgroups";

export const accountGroupResolvers = {
  Query: {
    // Get all active account groups for optional admin
    getAccountGroups: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: true };
      if (adminId) filter.admin = adminId;
      return await AccountGroup.find(filter).populate("admin");
    },

    // Get deleted account groups for optional admin
    getDeletedAccountGroups: async (_: any, { adminId }: { adminId?: string }) => {
      const filter: any = { status: false };
      if (adminId) filter.admin = adminId;
      return await AccountGroup.find(filter).populate("admin");
    },

    // Get one account group by ID for optional admin
    getAccountGroupById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await AccountGroup.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    addAccountGroup: async (_: any, { input }: any) => {
      const accountGroup = await AccountGroup.create(input);
      return await AccountGroup.findById(accountGroup._id).populate("admin");
    },

    editAccountGroup: async (_: any, { id, input }: any) => {
      return await AccountGroup.findByIdAndUpdate(id, input, { new: true }).populate("admin");
    },

    deleteAccountGroup: async (_: any, { id }: any) => {
      const result = await AccountGroup.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetAccountGroup: async (_: any, { id }: any) => {
      const result = await AccountGroup.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    }
  },
};
