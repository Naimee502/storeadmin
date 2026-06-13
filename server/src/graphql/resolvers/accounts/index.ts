import { Account } from "../../../models/accounts";
import { Transaction } from "../../../models/transactions";
import { generateTokens, sendRefreshToken } from "../../../utils/auth";

// Collect downline party ids under a root party (assignaccountid chain).
const collectDownline = async (rootId: any): Promise<string[]> => {
  const out: string[] = [];
  let frontier = [String(rootId)];
  for (let depth = 0; depth < 6 && frontier.length; depth++) {
    const kids = await Account.find({ assignaccountid: { $in: frontier }, status: true }).select("_id").lean();
    const ids = kids.map((k: any) => k._id.toString()).filter((id) => !out.includes(id));
    if (!ids.length) break;
    out.push(...ids);
    frontier = ids;
  }
  return out;
};

// Running balance (Dr − Cr) of a single ledger across all its transactions.
const ledgerBalance = async (ledgerId: any): Promise<number> => {
  if (!ledgerId) return 0;
  const txns = await Transaction.find({ "entries.ledgerid": ledgerId, status: true }).select("entries").lean();
  let bal = 0;
  for (const t of txns as any[]) for (const e of t.entries || []) {
    if (String(e.ledgerid) === String(ledgerId)) bal += (e.debit || 0) - (e.credit || 0);
  }
  return bal;
};

export const accountResolvers = {
  Query: {
    // Downline (sub-party) outstanding summary for a parent party's Ledger tab.
    getDownlinePartyBalances: async (_: any, { partyid }: { partyid: string }) => {
      const ids = await collectDownline(partyid);
      if (!ids.length) return [];
      const parties = await Account.find({ _id: { $in: ids } }).select("name mobile ledgerid").lean();
      const result: any[] = [];
      for (const p of parties as any[]) {
        result.push({
          id: p._id.toString(),
          name: p.name,
          mobile: p.mobile || null,
          outstanding: await ledgerBalance(p.ledgerid),
        });
      }
      return result;
    },
    getAccounts: async (_: any, { filter }: { filter: any }, context: any) => {
      const query: any = {};

      if (filter?.admin) query.admin = filter.admin;
      if (filter?.branchid) query.branchid = filter.branchid;
      if (filter?.type) query.type = filter.type;
      if (filter?.channel) query.channel = filter.channel;
      if (filter?.region) query.region = { $regex: filter.region, $options: "i" };

      // NOTE: salesman parties are scoped explicitly via filter.salesmanid
      // (the My Parties screen). We no longer force a channel restriction here,
      // because it broke parent-party (upline channel) lookups and hid parties
      // whose channel differs from the salesman's assigned channels.

      // ✅ Changed accountgroupid → ledgerid
      if (filter?.ledgerid) query.ledgerid = filter.ledgerid;

      if (filter?.accountcode) query.accountcode = filter.accountcode;
      if (filter?.mobile) query.mobile = { $regex: filter.mobile, $options: "i" };
      if (filter?.email) query.email = { $regex: filter.email, $options: "i" };
      if (filter?.gstnumber) query.gstnumber = filter.gstnumber;
      if (filter?.pan) query.pan = filter.pan;
      if (filter?.city) query.city = { $regex: filter.city, $options: "i" };
      if (filter?.state) query.state = { $regex: filter.state, $options: "i" };
      if (filter?.country) query.country = filter.country;
      if (filter?.pincode) query.pincode = filter.pincode;
      if (filter?.billingcycle) query.billingcycle = filter.billingcycle;
      if (filter?.openingbalancetype) query.openingbalancetype = filter.openingbalancetype;
      if (filter?.assignaccountid) query.assignaccountid = filter.assignaccountid;
      if (filter?.salesmanid) query.salesmanid = filter.salesmanid;
      if (typeof filter?.duedays === "number") query.duedays = filter.duedays;
      if (filter?.latitude) query.latitude = filter.latitude;
      if (filter?.longitude) query.longitude = filter.longitude;
      if (filter?.otp) query.otp = filter.otp;

      query.status =
        typeof filter?.status === "boolean" ? filter.status : true; // default only active

      if (filter?.createdFrom || filter?.createdTo) {
        query.createdAt = {};
        if (filter.createdFrom) query.createdAt.$gte = new Date(filter.createdFrom);
        if (filter.createdTo) query.createdAt.$lte = new Date(filter.createdTo);
      }

      // ── TEMP DIAGNOSTIC ──────────────────────────────────────────────
      if (filter?.salesmanid) {
        const total = await Account.countDocuments({ admin: filter.admin, status: true });
        const bySalesman = await Account.find({ salesmanid: filter.salesmanid })
          .select("name salesmanid").lean();
        const anySalesmen = await Account.find({ admin: filter.admin, salesmanid: { $ne: null } })
          .select("name salesmanid").limit(10).lean();
        console.log("👤 [getAccounts] salesmanid filter:", filter.salesmanid,
          "| admin:", filter.admin,
          "| total active accounts:", total,
          "| matched by salesmanid:", bySalesman.length, JSON.stringify(bySalesman),
          "| sample accounts having ANY salesmanid:", JSON.stringify(anySalesmen.map((a: any) => ({ name: a.name, salesmanid: String(a.salesmanid) }))));
      }

      return await Account.find(query)
        .populate("admin")
        .populate("accountgroupid") 
        .populate("ledgerid")  
        .populate("branchid")
        .populate("assignaccountid")
        .populate("salesmanid")
        .populate("channel");
    },

    getAccountById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = adminId;

      return await Account.findOne(filter)
        .populate("admin")
        .populate("accountgroupid")  
        .populate("ledgerid")  
        .populate("branchid")
        .populate("assignaccountid")
        .populate("salesmanid")
        .populate("channel");
    },
  },

  Mutation: {
    addAccount: async (_: any, { input }: any) => {
      try {
        const account = new Account(input);
        await account.save();
        return await Account.findById(account._id)
          .populate("admin")
          .populate("accountgroupid")
          .populate("ledgerid")
          .populate("branchid")
          .populate("assignaccountid")
          .populate("salesmanid")
          .populate("channel");
      } catch (err:any) {
        console.error("❌ AddAccount Error:", err);
        throw new Error(err.message);
      }
    },

    editAccount: async (_: any, { id, input }: any) => {
      return await Account.findByIdAndUpdate(id, input, { new: true })
        .populate("admin")
        .populate("accountgroupid") 
        .populate("ledgerid")
        .populate("branchid")
        .populate("assignaccountid")
        .populate("salesmanid")
        .populate("channel");
    },

    deleteAccount: async (_: any, { id }: any) => {
      const result = await Account.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetAccount: async (_: any, { id }: any) => {
      const result = await Account.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },

    sendOTP: async (_: any, { adminId, mobile }: any) => {
      const account = await Account.findOne({ admin: adminId, mobile, status: true });
      if (!account) throw new Error("Mobile number not registered.");

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await Account.findByIdAndUpdate(account._id, { otp, otpExpiry });

      // TODO: replace with SMS provider (Twilio, AWS SNS, etc.) and remove otp from response
      console.log(`[OTP] Mobile: ${mobile} | OTP: ${otp}`);

      return { success: true, message: "OTP sent successfully.", otp };
    },

    verifyOTP: async (_: any, { adminId, mobile, otp }: any, { res }: any) => {
      const account = await Account.findOne({ admin: adminId, mobile, status: true });
      if (!account) throw new Error("Mobile number not registered.");

      if (account.otp !== otp) throw new Error("Invalid OTP. Please try again.");

      if (account.otpExpiry && new Date() > account.otpExpiry) {
        throw new Error("OTP has expired. Please request a new one.");
      }

      await Account.findByIdAndUpdate(account._id, { otp: null, otpExpiry: null });

      const { accessToken, refreshToken } = generateTokens({
        id: account.id,
        email: account.email || mobile,
        type: "party",
      });

      sendRefreshToken(res, refreshToken);

      const populated = await Account.findById(account._id).populate("admin");
      return { accessToken, account: populated };
    },
  },
};
