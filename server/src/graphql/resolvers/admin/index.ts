import { Admin } from "../../../models/admin";

export const adminResolvers = {
  Query: {
    getAdmins: async () => {
      return await Admin.find();
    },
    getAdminByEmail: async (_: any, { email }: { email: string }) => {
      return await Admin.findOne({ email });
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
      if (!admin) {
        throw new Error("Admin not found");
      }

      // Calculate subscription dates
      const now = new Date();
      const subscriptionEnd =
        subscriptionType === "monthly"
          ? new Date(now.setMonth(now.getMonth() + 1))
          : new Date(now.setFullYear(now.getFullYear() + 1));

      // Update admin fields
      admin.subscribed = true;
      admin.subscribedAt = new Date();
      admin.subscriptionEnd = subscriptionEnd;
      admin.transactionId = transactionId;
      admin.subscriptionType = subscriptionType;

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
        throw new Error("Subscription required");
      }

      return admin;
    }
  },
};
