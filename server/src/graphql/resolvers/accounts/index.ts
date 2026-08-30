import { Account } from "../../../models/accounts";
import { AccountGroup } from "../../../models/accountgroups";
import { Channel } from "../../../models/channel";
import { Transaction } from "../../../models/transactions";
import { Payment } from "../../../models/payments";
import { SalesInvoice } from "../../../models/salesinvoice";
import { SalesRoute } from "../../../models/salesroutes";
import { StaffAccount } from "../../../models/staffaccounts";
import { Branch } from "../../../models/branches";
import { Admin } from "../../../models/admin";
import { pushNotification } from "../../../models/notifications";
import { generateTokens, sendRefreshToken } from "../../../utils/auth";
import { getPartyTotalDue } from "../../../utils/allocation";

// Resolve the acting user into a display label. Staff tokens are resolved to
// their real role (salesman/staff/deliveryboy) + name; branch/admin tokens
// only carry an email, so the display name is looked up from the DB. Unknown →
// "unknown" (never "admin", so the admin notification is never wrongly skipped).
const resolveActor = async (user: any) => {
  let name = user?.name || "";
  let type = user?.type || "unknown";
  try {
    if (user?.type === "staff") {
      const s: any = await StaffAccount.findById(user.id).select("role name").lean();
      if (s) { type = s.role || "staff"; name = s.name || name; }
    } else if (user?.type === "branch") {
      const b: any = await Branch.findById(user.id).select("branchname").lean();
      if (b?.branchname) name = b.branchname;
    } else if (user?.type === "admin") {
      const a: any = await Admin.findById(user.id).select("name").lean();
      if (a?.name) name = a.name;
    }
  } catch (e) { /* best-effort */ }
  if (!name) name = user?.email || "Unknown user";
  return { id: user?.id, name, type, label: `${name} (${type})` };
};

// NOTE: the local per-invoice "settled amount" helper that used to live here
// was removed — outstanding is now computed in one place
// (utils/allocation → getPartyOutstandingBills) so every surface agrees.

// Party "outstanding" for every collection view (salesman app, party web
// portal, downline list) = what a payment would actually have to cover:
// opening balance + open bills − advances already held − excess credit.
//
// It used to be bill-wise ONLY, which contradicted the allocation engine:
// `allocateWithOpening` clears the opening balance before any bill, so a party
// with a ₹1,000 opening and one ₹250 bill was shown "₹250 Due", paid ₹250, and
// still saw "₹250 Due" because the money had gone onto the opening. Paying the
// figure on screen must clear the figure on screen.
//
// Delegates to the shared allocation util so this agrees, to the rupee, with
// the payment screen, the party report and the reminder.
const partyBillOutstanding = async (accountId: any): Promise<number> => {
  if (!accountId) return 0;
  return await getPartyTotalDue({ partyid: accountId, invoicemodel: "SalesInvoice" });
};

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

/**
 * Only customer accounts may sign in through the app or the storefront.
 *
 * Vendors, banks and expense parties exist in the same collection — they are
 * book-keeping records the admin creates, not people with a login. A vendor
 * whose mobile happened to be on file could previously request an OTP and get
 * a party token, which put them inside the shopping app with a real session.
 */
const assertCustomerAccount = (account: any) => {
  const type = String(account?.type || "").toLowerCase();
  if (type !== "customer") {
    throw new Error("This login is for customer accounts only.");
  }
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
          // Bill-wise due (sum of unsettled sales bills) — same basis as the
          // salesman app & Account.outstanding, so "due" is consistent.
          outstanding: await partyBillOutstanding(p._id),
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
      // Salesman scoping: parties the salesman created (salesmanid on the
      // account) + parties assigned to them via Sales Routes. Admin-created
      // parties stay hidden until they're assigned to one of their routes.
      if (filter?.salesmanid) {
        const routes = await SalesRoute.find({ salesmanid: filter.salesmanid, status: true })
          .select("accounts dayWiseAccounts")
          .lean();
        const routePartyIds = new Set<string>();
        routes.forEach((r: any) => {
          (r.accounts || []).forEach((id: any) => routePartyIds.add(String(id)));
          (r.dayWiseAccounts || []).forEach((d: any) =>
            (d.accounts || []).forEach((id: any) => routePartyIds.add(String(id)))
          );
        });
        query.$or = [
          { salesmanid: filter.salesmanid },
          ...(routePartyIds.size ? [{ _id: { $in: [...routePartyIds] } }] : []),
        ];
      }
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

  // Field resolver: live ledger balance (Dr−Cr of posted transactions). Only
  // computed when a query actually selects `outstanding` (e.g. the salesman's
  // All Parties list), so normal account queries pay no cost.
  Account: {
    // Collection view: sum of unsettled sales bills (not the net ledger balance),
    // so advances don't mask which bills are still due.
    outstanding: async (parent: any) => {
      const id = parent?._id ?? parent?.id;
      return await partyBillOutstanding(id);
    },
  },

  Mutation: {
    addAccount: async (_: any, { input }: any, context: any) => {
      try {
        const account = new Account(input);
        await account.save();

        // ── Notifications ──────────────────────────────────────────
        // Actor ≠ admin (e.g. salesman created a party from the app) → tell
        // admin. Party created with a salesman linked → tell that salesman
        // (unless he created it himself).
        try {
          const actor = await resolveActor(context?.user);
          const adminid = input.admin;
          const branchid = input.branchid;
          if (actor.type !== "admin") {
            await pushNotification({
              adminid, branchid,
              targettype: "admin",
              ntype: "party",
              title: `New party "${input.name}" added`,
              message: `${input.mobile || ""}${input.city ? ` • ${input.city}` : ""} • by ${actor.label}`,
              webpath: "/accounts",
              docmodel: "Account",
              docid: account._id,
            });
          }
          if (input.salesmanid && String(input.salesmanid) !== String(actor.id || "")) {
            await pushNotification({
              adminid, branchid,
              targettype: "staff",
              targetid: input.salesmanid,
              ntype: "party",
              title: `New party "${input.name}" assigned to you`,
              message: `${input.mobile || ""}${input.city ? ` • ${input.city}` : ""} • by ${actor.label}`,
              appscreen: "Parties",
              docmodel: "Account",
              docid: account._id,
            });
          }
        } catch (e) { /* notifications are best-effort */ }

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

    editAccount: async (_: any, { id, input }: any, context: any) => {
      const before: any = await Account.findById(id).select("salesmanid name admin branchid").lean();
      const updated = await Account.findByIdAndUpdate(id, input, { new: true })
        .populate("admin")
        .populate("accountgroupid")
        .populate("ledgerid")
        .populate("branchid")
        .populate("assignaccountid")
        .populate("salesmanid")
        .populate("channel");

      // ── Notification: party newly assigned to a salesman → tell him ──
      try {
        const newSalesman = input.salesmanid;
        if (
          updated && newSalesman &&
          String(newSalesman) !== String(before?.salesmanid || "")
        ) {
          const actor = await resolveActor(context?.user);
          if (String(newSalesman) !== String(actor.id || "")) {
            await pushNotification({
              adminid: input.admin || before?.admin,
              branchid: input.branchid || before?.branchid,
              targettype: "staff",
              targetid: newSalesman,
              ntype: "party",
              title: `Party "${input.name || before?.name}" assigned to you`,
              message: `by ${actor.label}`,
              appscreen: "Parties",
              docmodel: "Account",
              docid: id,
            });
          }
        }
      } catch (e) { /* notifications are best-effort */ }

      return updated;
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
      assertCustomerAccount(account);

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await Account.findByIdAndUpdate(account._id, { otp, otpExpiry });

      // TODO: replace with SMS provider (Twilio, AWS SNS, etc.) and remove otp from response
      console.log(`[OTP] Mobile: ${mobile} | OTP: ${otp}`);

      return { success: true, message: "OTP sent successfully.", otp };
    },

    // Self-service signup — an unregistered mobile number entering their own
    // Name/Email (app/website "New Customer" flow, no admin-only fields).
    // Creates a real end-user Account (type "customer") under the tenant's
    // "Sundry Debtors" group, same group every admin-created customer uses,
    // so the model's own pre-save hook auto-generates its accountcode AND
    // ledger exactly like an admin adding an account would. Then sends an
    // OTP immediately so the caller can go straight into the normal
    // verifyOTP step, same shape as sendOTP.
    registerAccount: async (_: any, { adminId, name, mobile, email }: any) => {
      const existing = await Account.findOne({ admin: adminId, mobile, status: true });
      if (existing) throw new Error("This mobile number is already registered. Please login instead.");

      let group = await AccountGroup.findOne({ admin: adminId, accountgroupname: "Sundry Debtors" });
      if (!group) {
        group = await AccountGroup.create({
          admin: adminId,
          accountgroupname: "Sundry Debtors",
          category: "assets",
          status: true,
        });
      }

      // Self-registered app/website customers are always the "EndUser"
      // channel — same default channel every admin gets auto-created for
      // them at signup (see adminResolvers.addAdmin) — never a channel an
      // admin/salesman assigns manually (Retailer/Wholesaler/Distributor).
      let endUserChannel = await Channel.findOne({ admin: adminId, channelName: "EndUser" });
      if (!endUserChannel) {
        endUserChannel = await Channel.create({
          admin: adminId,
          channelName: "EndUser",
          isDefault: true,
          status: true,
        });
      }

      const account = new Account({
        admin: adminId,
        name,
        mobile,
        email: email || undefined,
        type: "customer",
        accountgroupid: group._id,
        channel: endUserChannel._id,
        status: true,
      });
      await account.save();

      try {
        await pushNotification({
          adminid: adminId,
          targettype: "admin",
          ntype: "party",
          title: `New customer "${name}" self-registered`,
          message: mobile || "",
          webpath: "/accounts",
          docmodel: "Account",
          docid: account._id,
        });
      } catch (e) { /* notifications are best-effort */ }

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
      await Account.findByIdAndUpdate(account._id, { otp, otpExpiry });

      // TODO: replace with SMS provider (Twilio, AWS SNS, etc.) and remove otp from response
      console.log(`[OTP] Mobile: ${mobile} | OTP: ${otp}`);

      return { success: true, message: "Registered successfully. OTP sent.", otp };
    },

    verifyOTP: async (_: any, { adminId, mobile, otp }: any, { res }: any) => {
      const account = await Account.findOne({ admin: adminId, mobile, status: true });
      if (!account) throw new Error("Mobile number not registered.");
      // Checked again rather than trusting sendOTP: verifyOTP is a mutation of
      // its own and can be called directly, and this is the step that hands out
      // a token.
      assertCustomerAccount(account);

      if (account.otp !== otp) throw new Error("Invalid OTP. Please try again.");

      if (account.otpExpiry && new Date() > account.otpExpiry) {
        throw new Error("OTP has expired. Please request a new one.");
      }

      await Account.findByIdAndUpdate(account._id, { otp: null, otpExpiry: null });

      const { accessToken, refreshToken } = generateTokens({
        id: account.id,
        email: account.email || mobile,
        type: "party",
        adminid: (account as any).admin,
        branchid: (account as any).branchid,
      });

      sendRefreshToken(res, refreshToken);

      // `channel` is populated because the app reads channelName off it: an
      // EndUser (or channel-less) party gets the storefront-style Home, while a
      // Retailer/Wholesaler gets the ordering view. Without the populate the
      // Channel field has only an ObjectId to resolve from.
      const populated = await Account.findById(account._id)
        .populate("admin")
        .populate("channel");
      return { accessToken, account: populated };
    },
  },
};
