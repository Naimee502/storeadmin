import { SalesmenAccount } from "../../../models/salesmenaccount";

export const salesmenAccountResolvers = {
  Query: {
    // Get active salesmen, optionally filtered by admin and/or branch
    getSalesmenAccounts: async (
      _: any,
      args: { adminId?: string; branchid?: string }
    ) => {
      const query: any = { status: true };
      if (args.adminId) query.admin = args.adminId;
      if (args.branchid) query.branchid = args.branchid;
      return await SalesmenAccount.find(query).populate("admin");
    },

    // Get deleted salesmen (soft-deleted)
    getDeletedSalesmenAccounts: async (
      _: any,
      args: { adminId?: string; branchid?: string }
    ) => {
      const query: any = { status: false };
      if (args.adminId) query.admin = args.adminId;
      if (args.branchid) query.branchid = args.branchid;
      return await SalesmenAccount.find(query).populate("admin");
    },

    // Get salesman by ID and optionally check admin ownership
    getSalesmanAccountById: async (
      _: any,
      { id, adminId }: { id: string; adminId?: string }
    ) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await SalesmenAccount.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    // Add a new salesman and return with populated admin
    addSalesmanAccount: async (_: any, { input }: any) => {
      const created = await SalesmenAccount.create(input);
      return await SalesmenAccount.findById(created._id).populate("admin");
    },

    // Edit salesman details
    editSalesmanAccount: async (_: any, { id, input }: any) => {
      return await SalesmenAccount.findByIdAndUpdate(id, input, {
        new: true,
      }).populate("admin");
    },

    // Soft delete
    deleteSalesmanAccount: async (_: any, { id }: any) => {
      const result = await SalesmenAccount.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    // Reset soft-deleted salesman
    resetSalesmanAccount: async (_: any, { id }: any) => {
      const result = await SalesmenAccount.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
