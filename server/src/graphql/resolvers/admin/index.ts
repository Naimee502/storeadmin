import { Admin } from "../../../models/admin";

export const adminResolvers = {
  Query: {
    getAdmins: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: true };
      if (adminId) query._id = adminId;

      return await Admin.find(query);
    },
    getAdminByEmail: async (_: any, { email }: { email: string }) => {
      return await Admin.findOne({ email });
    },
    getPendingSubscriptions: async () => {
      return await Admin.find({ needsReview: true, subscribed: false, rejected: false });
    },
    getDeletedAdmins: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: false };
      if (adminId) query._id = adminId; 
      return await Admin.find(query);
    },
  },

  Mutation: {
    createAdmin: async (_: any, { input }: any) => {
      const existing = await Admin.findOne({ email: input.email });
      if (existing) throw new Error("Admin already exists");

      const admin = new Admin({
        ...input,
        subscribed: false,
        subscribedAt: null,
        subscriptionEnd: null,
        transactionId: null,
        needsReview: false,
        rejected: false,
        // Optional defaults (if not provided in input)
        businesstype: input.businesstype || 'retail',
        isMultibranch: input.isMultibranch ?? false,
        isChannelCustomers: input.isChannelCustomers ?? false,
        allowedmodules: input.allowedmodules || ['sales', 'purchase', 'accounting'],
        status: input.status ?? true,
      });

      await admin.save();
      return admin;
    },

    updateAdminById: async (_: any, { id, input }: any) => {
      const admin = await Admin.findById(id);
      if (!admin) throw new Error("Admin not found");

      // Safely update allowed fields
      if (input.name) admin.name = input.name;
      if (input.password) admin.password = input.password;
      if (input.subscriptionType) admin.subscriptionType = input.subscriptionType;
      if (input.businesstype) admin.businesstype = input.businesstype;
      if (typeof input.isMultibranch === "boolean") admin.isMultibranch = input.isMultibranch;
      if (typeof input.isChannelCustomers === "boolean") admin.isChannelCustomers = input.isChannelCustomers;
      if (Array.isArray(input.allowedmodules)) admin.allowedmodules = input.allowedmodules;
      if (typeof input.status === "boolean") admin.status = input.status;

      await admin.save();
      return admin;
    },

    confirmSubscription: async (
      _: any,
      {
        email,
        transactionId,
        subscriptionType,
      }: {
        email: string;
        transactionId: string;
        subscriptionType: "monthly" | "yearly";
      }
    ) => {
      const admin = await Admin.findOne({ email });
      if (!admin) throw new Error("Admin not found");

      admin.subscriptionType = subscriptionType;
      admin.transactionId = transactionId;
      admin.subscribed = false;
      admin.subscribedAt = null;
      admin.subscriptionEnd = null;
      admin.needsReview = true;
      admin.rejected = false;

      await admin.save();
      return admin;
    },

    approveSubscription: async (_: any, { email }: { email: string }) => {
      const admin = await Admin.findOne({ email });
      if (!admin) throw new Error("Admin not found");

      const now = new Date();
      const subscriptionEnd =
        admin.subscriptionType === "monthly"
          ? new Date(now.setMonth(now.getMonth() + 1))
          : new Date(now.setFullYear(now.getFullYear() + 1));

      admin.subscribed = true;
      admin.subscribedAt = new Date();
      admin.subscriptionEnd = subscriptionEnd;
      admin.needsReview = false;
      admin.rejected = false;

      await admin.save();
      return admin;
    },

    rejectSubscription: async (_: any, { email }: { email: string }) => {
      const admin = await Admin.findOne({ email });
      if (!admin) throw new Error("Admin not found");

      admin.subscribed = false;
      admin.subscribedAt = null;
      admin.subscriptionEnd = null;
      admin.needsReview = false;
      admin.rejected = true;

      await admin.save();
      return admin;
    },

    loginAdmin: async (_: any, { email, password }: any) => {
      const admin = await Admin.findOne({ email });
      if (!admin) throw new Error("Admin not found");

      if (admin.password !== password) {
        throw new Error("Invalid credentials");
      }

      if (!admin.subscribed) {
        if (admin.needsReview) {
          throw new Error("Subscription request is under review.");
        } else if (admin.rejected) {
          throw new Error("Subscription request was rejected.");
        }
        throw new Error("Subscription required.");
      }

      return admin;
    },

    deleteAdmin: async (_: any, { id }: { id: string }) => {
      const result = await Admin.findByIdAndUpdate(
        id,
        { status: false },
        { new: true }
      );
      return !!result;
    },

    // Restore brand
    resetAdmin: async (_: any, { id }: any) => {
      const result = await Admin.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
