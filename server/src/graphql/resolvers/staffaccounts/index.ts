import { StaffAccount } from "../../../models/staffaccounts";

export const staffAccountResolvers = {
  Query: {
    // ==========================================
    // ✅ Get Active Staff Accounts (any role)
    // ==========================================
    getStaffAccounts: async (_: any, { filter }: { filter?: any }) => {
      const query: any = {};

      if (filter?.admin) query.admin = filter.admin;
      if (filter?.branchid) query.branchid = filter.branchid;

      // Role filter (staff / salesman / deliveryboy)
      if (filter?.role) query.role = filter.role;

      // Default only ACTIVE accounts
      query.status =
        typeof filter?.status === "boolean" ? filter.status : true;

      if (filter?.accountgroupid) query.accountgroupid = filter.accountgroupid;
      if (filter?.ledgerid) query.ledgerid = filter.ledgerid;

      if (filter?.mobile)
        query.mobile = { $regex: filter.mobile, $options: "i" };
      if (filter?.email)
        query.email = { $regex: filter.email, $options: "i" };

      if (typeof filter?.salary === "number") query.salary = filter.salary;
      if (typeof filter?.commission === "number") query.commission = filter.commission;

      // Date filter
      if (filter?.createdFrom || filter?.createdTo) {
        query.createdAt = {};
        if (filter.createdFrom) query.createdAt.$gte = new Date(filter.createdFrom);
        if (filter.createdTo) query.createdAt.$lte = new Date(filter.createdTo);
      }

      return await StaffAccount.find(query)
        .populate("admin")
        .populate("branchid")
        .populate("accountgroupid")
        .populate("ledgerid");
    },

    // ==========================================
    // ✅ Get DELETED staff accounts
    // ==========================================
    getDeletedStaffAccounts: async (_: any, { filter }: { filter?: any }) => {
      const query: any = { status: false };

      if (filter?.admin) query.admin = filter.admin;
      if (filter?.branchid) query.branchid = filter.branchid;

      if (filter?.role) query.role = filter.role; // staff / salesman / deliveryboy

      if (filter?.accountgroupid) query.accountgroupid = filter.accountgroupid;
      if (filter?.ledgerid) query.ledgerid = filter.ledgerid;

      if (filter?.mobile)
        query.mobile = { $regex: filter.mobile, $options: "i" };
      if (filter?.email)
        query.email = { $regex: filter.email, $options: "i" };

      // date filter
      if (filter?.createdFrom || filter?.createdTo) {
        query.createdAt = {};
        if (filter.createdFrom) query.createdAt.$gte = new Date(filter.createdFrom);
        if (filter.createdTo) query.createdAt.$lte = new Date(filter.createdTo);
      }

      return await StaffAccount.find(query)
        .populate("admin")
        .populate("branchid")
        .populate("accountgroupid")
        .populate("ledgerid");
    },

    // ==========================================
    // ✅ Get a single staff account
    // ==========================================
    getStaffAccountById: async (_: any, { id, admin }: { id: string; admin?: string }) => {
      const filter: any = { _id: id };
      if (admin) filter.admin = admin;

      return await StaffAccount.findOne(filter)
        .populate("admin")
        .populate("branchid")
        .populate("accountgroupid")
        .populate("ledgerid");
    },
  },

  Mutation: {
    // ==========================================
    // ✅ Add Staff (ANY ROLE: staff/salesman/deliveryboy)
    // Main ledger auto-created in schema hook
    // ==========================================
    addStaffAccount: async (_: any, { input }: any) => {
      try {
        const created = new StaffAccount(input);
        await created.save(); // triggers pre-save hooks

        return await StaffAccount.findById(created._id)
          .populate("admin")
          .populate("branchid")
          .populate("accountgroupid")
          .populate("ledgerid");
      } catch (err: any) {
        console.error("❌ addStaffAccount Error:", err);
        throw new Error(err.message);
      }
    },

    // ==========================================
    // ✅ Edit Staff Account (password optional)
    // ==========================================
    editStaffAccount: async (_: any, { id, input }: any) => {
      // If password is empty string or null → remove it so it doesn’t overwrite
      if (input.password === "" || input.password === null) {
        delete input.password;
      }

      return await StaffAccount.findByIdAndUpdate(id, input, {
        new: true,
        runValidators: true,
      })
        .populate("admin")
        .populate("branchid")
        .populate("accountgroupid")
        .populate("ledgerid");
    },

    // ==========================================
    // ❌ Soft Delete
    // ==========================================
    deleteStaffAccount: async (_: any, { id }: any) => {
      const result = await StaffAccount.findByIdAndUpdate(
        id,
        { status: false },
        { new: true }
      );
      return !!result;
    },

    // ==========================================
    // ♻ Restore
    // ==========================================
    resetStaffAccount: async (_: any, { id }: any) => {
      const result = await StaffAccount.findByIdAndUpdate(
        id,
        { status: true },
        { new: true }
      );
      return !!result;
    },
  },
};
