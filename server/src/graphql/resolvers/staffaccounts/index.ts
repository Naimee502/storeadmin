import { StaffAccount } from "../../../models/staffaccounts";
import { Account } from "../../../models/accounts";
import { generateTokens, sendRefreshToken } from "../../../utils/auth";
import { enforceLoginOtp } from "../../../utils/loginotp";

const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Panel login finds staff by email alone (across every business), so two
// active "staff" accounts must never share an email.
async function assertStaffEmailFree(email: any, role: any, excludeId?: string) {
  const e = String(email || "").trim();
  if (!e || (role && role !== "staff")) return;
  const q: any = { email: { $regex: `^${escapeRe(e)}$`, $options: "i" }, status: true, role: "staff" };
  if (excludeId) q._id = { $ne: excludeId };
  if (await StaffAccount.exists(q)) {
    throw new Error("This email is already used by another staff account. Please use a different email.");
  }
}

export const staffAccountResolvers = {
  Query: {
    // ==========================================
    // ✅ Get Active Staff Accounts (any role)
    // ==========================================
    getStaffAccounts: async (_: any, { filter }: { filter?: any }) => {
      const query: any = {};

      if (filter?.adminId) query.admin = filter.adminId;
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

      // Populated refs carry only what any client asks for (id + label).
      return await StaffAccount.find(query).sort({ createdAt: 1, _id: 1 })
        .populate({ path: "admin", select: "name email" })
        .populate({ path: "branchid", select: "branchname" })
        .populate({ path: "accountgroupid", select: "accountgroupname" })
        .populate({ path: "ledgerid", select: "ledgername" })
        .populate({ path: "assignedChannels", select: "channelName" });
    },

    // ==========================================
    // ✅ Get DELETED staff accounts
    // ==========================================
    getDeletedStaffAccounts: async (_: any, { filter }: { filter?: any }) => {
      const query: any = { status: false };

      if (filter?.adminId) query.admin = filter.adminId;
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

      return await StaffAccount.find(query).sort({ createdAt: 1, _id: 1 })
        .populate("admin")
        .populate("branchid")
        .populate("accountgroupid")
        .populate("ledgerid")
        .populate("assignedChannels");
    },

    // ==========================================
    // ✅ Get a single staff account
    // ==========================================
    getStaffAccountById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;

      return await StaffAccount.findOne(filter)
        .populate("admin")
        .populate("branchid")
        .populate("accountgroupid")
        .populate("ledgerid")
        .populate("assignedChannels");
    },
  },

  Mutation: {
    // ==========================================
    // ✅ Add Staff (ANY ROLE: staff/salesman/deliveryboy)
    // Main ledger auto-created in schema hook
    // ==========================================
    addStaffAccount: async (_: any, { input }: any) => {
      try {
        await assertStaffEmailFree(input?.email, input?.role || "staff");
        const created = new StaffAccount(input);
        await created.save(); // triggers pre-save hooks

        return await StaffAccount.findById(created._id)
          .populate("admin")
          .populate("branchid")
          .populate("accountgroupid")
          .populate("ledgerid")
          .populate("assignedChannels");
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

      if (input?.email !== undefined || input?.role !== undefined) {
        const current: any = await StaffAccount.findById(id).select("email role").lean();
        await assertStaffEmailFree(input?.email ?? current?.email, input?.role ?? current?.role, id);
      }

      return await StaffAccount.findByIdAndUpdate(id, input, {
        new: true,
        runValidators: true,
      })
        .populate("admin")
        .populate("branchid")
        .populate("accountgroupid")
        .populate("ledgerid")
        .populate("assignedChannels");
    },

    loginStaff: async (_: any, { email, password, otp }: any, { res }: any) => {
      // Same email can exist in more than one business (or as an old test
      // record). Pick the account whose password matches, active first, most
      // recently updated — never just the first row Mongo returns.
      const candidates = await StaffAccount.find({
        email: { $regex: `^${escapeRe(String(email || "").trim())}$`, $options: "i" },
      })
        .sort({ status: -1, updatedAt: -1 })
        .populate("admin")
        .populate("branchid")
        .populate("assignedChannels");
      if (!candidates.length) throw new Error("Staff account not found");

      const staff = candidates.find((c: any) => c.password === password);
      if (!staff) throw new Error("Invalid credentials");
      if (!staff.status) throw new Error("Your account is currently disabled.");

      // Billing-panel login: Business Settings -> login email OTP (no-op when
      // off). The app's salesman login (loginStaffByMobile) is not affected.
      await enforceLoginOtp({
        kind: "staff", userId: staff._id, email: staff.email,
        adminId: (staff as any).admin, businessName: (staff as any).admin?.companyName, otp,
      });

      const { accessToken, refreshToken } = generateTokens({
        id: staff.id,
        email: staff.email,
        type: "staff",
        adminid: (staff as any).admin,
        branchid: (staff as any).branchid,
      });

      sendRefreshToken(res, refreshToken);
      return { accessToken, staff };
    },

    loginStaffByMobile: async (_: any, { adminId, mobile, password }: any, { res }: any) => {
      const staff = await StaffAccount.findOne({ admin: adminId, mobile })
        .populate("admin")
        .populate("branchid")
        .populate("assignedChannels");
      if (!staff) throw new Error("Mobile number not registered.");

      if (staff.password !== password) throw new Error("Invalid password.");
      if (!staff.status) throw new Error("Your account is currently disabled.");

      const { accessToken, refreshToken } = generateTokens({
        id: staff.id,
        email: staff.email,
        type: "staff",
        adminid: (staff as any).admin,
        branchid: (staff as any).branchid,
      });

      sendRefreshToken(res, refreshToken);
      return { accessToken, staff };
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

    // ==========================================
    // 🔔 Save FCM device token (from the mobile app after login)
    // ==========================================
    // The app calls this for every login role. Staff/salesman/delivery are
    // StaffAccounts; party logins are Accounts — try both so parties get
    // push too. A token belongs to one device, so it is removed from anyone
    // else who had it (e.g. a different user logged in on this phone before).
    saveDeviceToken: async (_: any, { id, token }: any) => {
      if (!id || !token) return false;
      await Promise.all([
        StaffAccount.updateMany({ fcmtoken: token, _id: { $ne: id } }, { $set: { fcmtoken: null } }),
        Account.updateMany({ fcmtoken: token, _id: { $ne: id } }, { $set: { fcmtoken: null } }),
      ]);
      const staff = await StaffAccount.findByIdAndUpdate(id, { fcmtoken: token }, { new: true });
      if (staff) return true;
      const party = await Account.findByIdAndUpdate(id, { fcmtoken: token }, { new: true });
      return !!party;
    },
  },
};
