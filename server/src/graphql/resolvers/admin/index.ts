import { Admin } from "../../../models/admin";

export const adminResolvers = {
  Query: {
    getAdmins: async () => {
      return await Admin.find();
    },
    getAdminByEmail: async (_: any, { email }: { email: string }) => {
      return await Admin.findOne({ email });
    },
    getPendingSubscriptions: async () => {
      return await Admin.find({ needsReview: true, subscribed: false, rejected: false });
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
      });

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
  },
};
