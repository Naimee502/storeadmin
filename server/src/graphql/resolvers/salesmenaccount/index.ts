import { SalesmenAccount } from "../../../models/salesmenaccount";

export const salesmenAccountResolvers = {
  Query: {
    // ✅ Get Active Salesmen (with filters)
    getSalesmenAccounts: async (_: any, { filter }: { filter?: any }) => {
      const query: any = {};

      if (filter?.admin) query.admin = filter.admin;
      if (filter?.branchid) query.branchid = filter.branchid;

      // Default salesman type
      query.type = "salesman";

      if (filter?.accountgroupid) query.accountgroupid = filter.accountgroupid;
      if (filter?.ledgerid) query.ledgerid = filter.ledgerid; // ✅ Added

      if (filter?.mobile)
        query.mobile = { $regex: filter.mobile, $options: "i" };
      if (filter?.email)
        query.email = { $regex: filter.email, $options: "i" };

      if (typeof filter?.salary === "number") query.salary = filter.salary;
      if (typeof filter?.commission === "number") query.commission = filter.commission;

      // ✅ Active by default
      query.status =
        typeof filter?.status === "boolean" ? filter.status : true;

      if (filter?.createdFrom || filter?.createdTo) {
        query.createdAt = {};
        if (filter.createdFrom) query.createdAt.$gte = new Date(filter.createdFrom);
        if (filter.createdTo) query.createdAt.$lte = new Date(filter.createdTo);
      }

      return await SalesmenAccount.find(query)
        .populate("admin")
        .populate("branchid")
        .populate("accountgroupid") 
        .populate("ledgerid");
    },

    // ✅ Get Deleted Salesmen
    getDeletedSalesmenAccounts: async (_: any, { filter }: { filter?: any }) => {
      const query: any = { status: false };

      if (filter?.admin) query.admin = filter.admin;
      if (filter?.branchid) query.branchid = filter.branchid;
      query.type = "salesman";

      if (filter?.accountgroupid) query.accountgroupid = filter.accountgroupid;
      if (filter?.ledgerid) query.ledgerid = filter.ledgerid; // ✅ Added

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
        .populate("branchid")
        .populate("accountgroupid")
        .populate("ledgerid");
    },

    // ✅ Get single salesman by ID
    getSalesmanAccountById: async (_: any, { id, admin }: { id: string; admin?: string }) => {
      const filter: any = { _id: id };
      if (admin) filter.admin = admin;

      return await SalesmenAccount.findOne(filter)
        .populate("admin")
        .populate("branchid")
        .populate("accountgroupid")
        .populate("ledgerid");
    },
  },

  Mutation: {
    // ✅ Add Salesman (auto ledger created in model hook)
    addSalesmanAccount: async (_: any, { input }: any) => {
      try {
        // ✅ Create doc first
        const created = new SalesmenAccount(input);

        // ✅ Save (triggers pre-save hook)
        await created.save();

        // ✅ Return populated data
        return await SalesmenAccount.findById(created._id)
          .populate("admin")
          .populate("branchid")
          .populate("accountgroupid")
          .populate("ledgerid");
      } catch (err: any) {
        console.error("❌ AddSalesmanAccount Error:", err);
        throw new Error(err.message);
      }
    },

    // ✅ Edit Salesman
    editSalesmanAccount: async (_: any, { id, input }: any) => {
      return await SalesmenAccount.findByIdAndUpdate(id, input, { new: true })
        .populate("admin")
        .populate("branchid")
        .populate("accountgroupid")
        .populate("ledgerid");
    },

    // ✅ Soft Delete
    deleteSalesmanAccount: async (_: any, { id }: any) => {
      const result = await SalesmenAccount.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    // ✅ Restore
    resetSalesmanAccount: async (_: any, { id }: any) => {
      const result = await SalesmenAccount.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
