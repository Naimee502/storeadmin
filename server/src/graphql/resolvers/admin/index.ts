import { Admin } from "../../../models/admin";
import { Channel } from "../../../models/channel";
import { AdminSettings } from "../../../models/adminsettings";
import { generateTokens, sendRefreshToken } from "../../../utils/auth";
import { ApolloError } from "apollo-server-express";
import { enforceLoginOtp } from "../../../utils/loginotp";
import { verifyPassword, upgradePassword } from "../../../utils/password";
import { isPlatform } from "../../../utils/authguard";
import { ensureMainBranch } from "../../../models/branches";
import { Unit } from "../../../models/units";
import { Category } from "../../../models/categories";
import { requireBackofficeTenant } from "../../../utils/tenant";

const KIND_RX = /^[a-z0-9_]{1,30}$/;
const cleanKind = (v: any) => (KIND_RX.test(String(v || "")) ? String(v) : undefined);

/** Creates the starter units and categories whose name the business has not used yet (deleted ones count). */
const addStarter = async (adminid: any, starter: any): Promise<number> => {
  const name = (v: any) => String(v || "").trim().slice(0, 40);
  const units = (Array.isArray(starter?.units) ? starter.units : []).slice(0, 30)
    .map((u: any) => ({ unitname: name(u?.name), uqc: /^[A-Z]{3}$/.test(String(u?.uqc || "")) ? String(u.uqc) : undefined }))
    .filter((u: any) => u.unitname);
  const cats = (Array.isArray(starter?.categories) ? starter.categories : []).slice(0, 30).map(name).filter(Boolean);
  const taken = async (model: any, field: string) =>
    new Set((await model.find({ admin: adminid }).select(field).lean()).map((d: any) => String(d[field] || "").toLowerCase()));
  let added = 0;
  const haveUnits = await taken(Unit, "unitname");
  for (const u of units) {
    if (haveUnits.has(u.unitname.toLowerCase())) continue;
    haveUnits.add(u.unitname.toLowerCase());
    await new Unit({ ...u, status: true, admin: adminid }).save();
    added++;
  }
  const haveCats = await taken(Category, "categoryname");
  for (const c of cats) {
    if (haveCats.has(c.toLowerCase())) continue;
    haveCats.add(c.toLowerCase());
    await new Category({ categoryname: c, status: true, admin: adminid }).save();
    added++;
  }
  return added;
};

export const adminResolvers = {
  Query: {
    getAdmins: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: true };
      if (adminId) query._id = adminId;

      return await Admin.find(query).sort({ createdAt: 1, _id: 1 });
    },
    getAdminById: async (_: any, { id }: { id: string }) => {
      return await Admin.findById(id);
    },
    getAdminByEmail: async (_: any, { email }: { email: string }) => {
      return await Admin.findOne({ email });
    },
    // Lookup by the auto-generated admin code (#ADM0001). Accepts the code
    // with or without the "#" prefix, case-insensitive — used by the mobile
    // app's Activate Business screen.
    getAdminByCode: async (_: any, { admincode }: { admincode: string }) => {
      const raw = String(admincode || "").trim().toUpperCase();
      const normalized = raw.startsWith("#") ? raw : `#${raw}`;
      return await Admin.findOne({ admincode: normalized, status: true });
    },
    getPendingSubscriptions: async () => {
      return await Admin.find({ needsReview: true, subscribed: false, rejected: false });
    },
    getDeletedAdmins: async (_: any, { adminId }: { adminId?: string }) => {
      const query: any = { status: false };
      if (adminId) query._id = adminId;
      return await Admin.find(query).sort({ createdAt: 1, _id: 1 });
    },
  },

  Mutation: {
    createAdmin: async (_: any, { input }: any) => {
      const existing = await Admin.findOne({ email: input.email });
      if (existing) throw new Error("Admin already exists");

      const { gstin, formfields, starter, businesskind, ...adminInput } = input;
      // Starting product / service form fields of the business type (true / false only).
      const forms: any = {};
      for (const m of ["products", "services", "jobcards"]) {
        const f = formfields?.[m];
        if (!f || typeof f !== "object") continue;
        const clean = Object.fromEntries(Object.entries(f).filter(([k, v]) => /^\w{1,40}$/.test(k) && typeof v === "boolean"));
        if (Object.keys(clean).length) forms[m] = clean;
      }
      const admin = new Admin({
        ...adminInput,
        ...(Object.keys(forms).length ? { defaultPermissions: { formPermissions: forms } } : {}),
        subscribed: false,
        subscribedAt: null,
        subscriptionEnd: null,
        transactionId: null,
        needsReview: false,
        rejected: false,
        // Optional defaults (if not provided in input)
        businesstype: input.businesstype || 'retail',
        ...(cleanKind(businesskind) ? { businesskind: cleanKind(businesskind) } : {}),
        allowedmodules: input.allowedmodules || [],
        status: input.status ?? true,
      });

      await admin.save();

      // Create default "EndUser" channel for this admin
      const endUserChannel = new Channel({
        channelName: "EndUser",
        admin: admin._id,
        isDefault: true,
        status: true
      });
      await endUserChannel.save();

      // New businesses start with offline billing on; existing ones stay off.
      const settings = await AdminSettings.getOrCreateForAdmin(admin._id);
      settings.offlineBilling = true;
      // GST profile starts from the registration details; the rest is filled in Business Settings.
      if (gstin) {
        settings.gstin = String(gstin).toUpperCase().replace(/\s/g, "");
        settings.legalName = settings.legalName || admin.companyName;
        settings.gstAddress = settings.gstAddress || admin.address;
      }
      await settings.save();
      if (starter) await addStarter(admin._id, starter);

      return admin;
    },

    addStarterMasters: async (_: any, { adminid, starter }: any, context: any) => {
      const target = isPlatform(context) && adminid ? adminid : (await requireBackofficeTenant(context)).adminid;
      if (!(await Admin.exists({ _id: target }))) throw new ApolloError("Business not found.", "BAD_USER_INPUT");
      return addStarter(target, starter);
    },

    updateAdminById: async (_: any, { id, input }: any, context: any) => {
      const admin = await Admin.findById(id);
      if (!admin) throw new Error("Admin not found");
      if (!isPlatform(context)) {
        // A business editing itself cannot change its plan or widen its modules.
        input = { ...input };
        delete input.subscriptionType; delete input.status; delete input.noOfBranches;
        const mine = (admin as any).allowedmodules;
        if (Array.isArray(input.allowedmodules) && Array.isArray(mine)) {
          const extra = input.allowedmodules.filter((m: string) => !mine.includes(m));
          if (extra.length) {
            throw new ApolloError("Only the platform owner can turn on new modules. Open Business Settings with the platform key.", "FORBIDDEN");
          }
        }
      }

      // Safely update allowed fields
      if (input.name) admin.name = input.name;
      if (input.email) admin.email = input.email;
      if (input.password) admin.password = input.password;
      if (input.companyName) admin.companyName = input.companyName;
      if (input.mobile) admin.mobile = input.mobile;
      if (input.address !== undefined) admin.address = input.address;
      if (input.noOfBranches !== undefined) admin.noOfBranches = input.noOfBranches;
      if (input.subscriptionType) admin.subscriptionType = input.subscriptionType;
      if (input.businesstype) admin.businesstype = input.businesstype;
      if (input.businesskind !== undefined) (admin as any).businesskind = cleanKind(input.businesskind);
      if (Array.isArray(input.allowedmodules)) admin.allowedmodules = input.allowedmodules;
      if (typeof input.status === "boolean") admin.status = input.status;

      await admin.save();
      if (input.gstin !== undefined) {
        await AdminSettings.updateOne({ adminid: admin._id }, { $set: { gstin: String(input.gstin || "").toUpperCase().replace(/\s/g, "") } }, { upsert: true });
      }
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
        subscriptionType: "monthly" | "yearly" | "lifetime";
      }
    ) => {
      const admin = await Admin.findOne({ email });
      if (!admin) throw new Error("Admin not found");

      admin.subscriptionType = subscriptionType;
      admin.transactionId = transactionId;
      admin.needsReview = true;
      admin.rejected = false;
      // A renewal on an active plan waits for approval; it never switches the plan off.
      const active = admin.subscribed && (!admin.subscriptionEnd || new Date(admin.subscriptionEnd) > new Date());
      if (!active) {
        admin.subscribed = false;
        admin.subscribedAt = null;
        admin.subscriptionEnd = null;
      }

      await admin.save();
      return admin;
    },

    approveSubscription: async (_: any, { email }: { email: string }) => {
      const admin = await Admin.findOne({ email });
      if (!admin) throw new Error("Admin not found");

      const now = new Date();
      let subscriptionEnd = null;
      if (admin.subscriptionType === "monthly") {
        subscriptionEnd = new Date(now.setMonth(now.getMonth() + 1));
      } else if (admin.subscriptionType === "yearly") {
        subscriptionEnd = new Date(now.setFullYear(now.getFullYear() + 1));
      } else {
        // lifetime, null subscriptionEnd means it never expires, but setting to 100 years for safety
        subscriptionEnd = new Date(now.setFullYear(now.getFullYear() + 100));
      }

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

    loginAdmin: async (_: any, { email, password, otp }: any, { res }: any) => {
      const admin = await Admin.findOne({ email });
      if (!admin) throw new Error("Admin not found");

      if (!verifyPassword(admin.password, password)) {
        throw new Error("Invalid credentials");
      }
      await upgradePassword(Admin, admin._id, admin.password, password);

      // Carry a machine-readable code so the client can route the admin to the
      // right screen (e.g. redirect to /subscription) instead of only printing
      // the message on the login form.
      if (!admin.subscribed) {
        if (admin.needsReview) {
          throw new ApolloError(
            "Subscription request is under review.",
            "SUBSCRIPTION_UNDER_REVIEW",
            { email: admin.email }
          );
        } else if (admin.rejected) {
          throw new ApolloError(
            "Subscription request was rejected. Please resubmit.",
            "SUBSCRIPTION_REJECTED",
            { email: admin.email }
          );
        }
        throw new ApolloError(
          "Subscription required.",
          "SUBSCRIPTION_REQUIRED",
          { email: admin.email }
        );
      }

      // Business Settings -> login email OTP (no-op when the switch is off).
      await enforceLoginOtp({
        kind: "admin", userId: admin._id, email: admin.email,
        adminId: admin._id, businessName: admin.companyName, otp,
      });

      await ensureMainBranch(admin);

      const { accessToken, refreshToken } = generateTokens({
        id: admin.id,
        email: admin.email,
        type: "admin",
      });

      sendRefreshToken(res, refreshToken);

      return {
        accessToken,
        admin,
      };
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

  Admin: {
    gstin: async (a: any) => {
      const s: any = await AdminSettings.findOne({ adminid: a._id ?? a.id }).select("gstin").lean();
      return s?.gstin ?? null;
    },
  },
};
