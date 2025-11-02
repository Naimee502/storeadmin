import { SalesmenAccount } from "../../../models/salesmenaccount";

export const salesmenAccountResolvers = {
  Query: {
    // Get Active Salesmen (with filters)
    getSalesmenAccounts: async (
      _: any,
      { filter }: { filter?: any }
    ) => {
      const query: any = { status: true };

      if (filter?.adminId) query.admin = filter.adminId;
      if (filter?.branchid) query.branchid = filter.branchid;
      if (filter?.type) query.type = filter.type; // default 'salesman'
      if (filter?.accountgroupid) query.accountgroupid = filter.accountgroupid;

      if (filter?.mobile)
        query.mobile = { $regex: filter.mobile, $options: "i" };
      if (filter?.email)
        query.email = { $regex: filter.email, $options: "i" };

      if (typeof filter?.salary === "number")
        query.salary = filter.salary;
      if (typeof filter?.commission === "number")
        query.commission = filter.commission;

      if (filter?.createdFrom || filter?.createdTo) {
        query.createdAt = {};
        if (filter.createdFrom) query.createdAt.$gte = new Date(filter.createdFrom);
        if (filter.createdTo) query.createdAt.$lte = new Date(filter.createdTo);
      }

      return await SalesmenAccount.find(query)
        .populate("admin")
        .populate("ledgerid")
        .populate("branchid");
    },

    // Get Deleted Salesmen (with filters)
    getDeletedSalesmenAccounts: async (
      _: any,
      { filter }: { filter?: any }
    ) => {
      const query: any = { status: false };

      if (filter?.adminId) query.admin = filter.adminId;
      if (filter?.branchid) query.branchid = filter.branchid;
      if (filter?.type) query.type = filter.type;
      if (filter?.accountgroupid) query.accountgroupid = filter.accountgroupid;

      if (filter?.mobile)
        query.mobile = { $regex: filter.mobile, $options: "i" };
      if (filter?.email)
        query.email = { $regex: filter.email, $options: "i" };

      if (filter?.createdFrom || filter?.createdTo) {
        query.createdAt = {};
        if (filter.createdFrom) query.createdAt.$gte = new Date(filter.createdFrom);
        if (filter.createdTo) query.createdAt.$lte = new Date(filter.createdTo);
      }

      return await SalesmenAccount.find(query)
        .populate("admin")
        .populate("ledgerid")
        .populate("branchid");
    },

    // Get Single Salesman by ID
    getSalesmanAccountById: async (
      _: any,
      { id, adminId }: { id: string; adminId?: string }
    ) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;
      return await SalesmenAccount.findOne(filter)
        .populate("admin")
        .populate("ledgerid")
        .populate("branchid");
    },
  },

  Mutation: {
    addSalesmanAccount: async (_: any, { input }: any) => {
      const created = await SalesmenAccount.create(input);
      return await SalesmenAccount.findById(created._id)
        .populate("admin")
        .populate("ledgerid")
        .populate("branchid");
    },

    editSalesmanAccount: async (_: any, { id, input }: any) => {
      return await SalesmenAccount.findByIdAndUpdate(id, input, { new: true })
        .populate("admin")
        .populate("ledgerid")
        .populate("branchid");
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
