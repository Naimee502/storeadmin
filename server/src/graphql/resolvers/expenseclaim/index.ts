import mongoose from "mongoose";
import { ExpenseClaim, CLAIM_CATEGORIES } from "../../../models/expenseclaim";
import { ExpenseNote } from "../../../models/expensenote";
import { StaffAccount } from "../../../models/staffaccounts";
import { AccountLedger } from "../../../models/accountledgers";
import { Admin } from "../../../models/admin";
import { Branch } from "../../../models/branches";
import { Payment } from "../../../models/payments";
import { pushNotification } from "../../../models/notifications";
import { requireBackofficeTenant, TenantError, type TenantScope } from "../../../utils/tenant";
import { assertModuleOn } from "../../../utils/modulegate";
import { isActionAllowed } from "../../../utils/permissiongate";
import { ensureCategoryLedger } from "../expensenote";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const MODULE = "expensenote";
const LABEL = "Expense Claims";

const CATEGORY_LABEL: Record<string, string> = {
  travel: "Travel",
  fuel: "Fuel",
  food: "Food",
  lodging: "Lodging",
  phone: "Phone / Internet",
  other: "Other",
};

const oid = (v: any) => new mongoose.Types.ObjectId(String(v));
const iso = (d: any) => (d ? new Date(d).toISOString() : null);
const money = (n: any) => Math.round(Number(n || 0) * 100) / 100;

const claimsScope = (tenant: TenantScope) => ({
  adminid: tenant.adminid,
  branchid: tenant.branchid,
  staffid: tenant.userType === "staff" ? tenant.userId : undefined,
});

/**
 * Resolve the caller and refuse when Expense Claims is off for them: the
 * Expense Notes module itself, and its "Expense Claims" permission checkbox
 * (Business Settings → Permissions), which most businesses leave off.
 */
const scopeFor = async (context: any): Promise<TenantScope> => {
  const tenant = await requireBackofficeTenant(context);
  await assertModuleOn(MODULE, LABEL, claimsScope(tenant));
  if (!(await isActionAllowed(MODULE, "claims", claimsScope(tenant)))) {
    throw new TenantError("Expense Claims is not enabled for this business.");
  }
  return tenant;
};

const actorOf = async (tenant: TenantScope) => {
  let name = "";
  if (tenant.userType === "admin") {
    const a: any = await Admin.findById(tenant.userId).select("name").lean();
    name = a?.name || "Admin";
  } else if (tenant.userType === "branch") {
    const b: any = await Branch.findById(tenant.userId).select("branchname").lean();
    name = b?.branchname || "Branch";
  } else {
    const s: any = await StaffAccount.findById(tenant.userId).select("name").lean();
    name = s?.name || "Staff";
  }
  return { id: tenant.userId, name, type: tenant.userType };
};

/** Which claims this caller may see. */
const visibilityQuery = (tenant: TenantScope): any => {
  const q: any = { adminid: tenant.adminid };
  if (tenant.userType === "staff") {
    // A staff login only ever sees its own claims.
    q.staffid = tenant.userId;
  } else if (tenant.branchid) {
    q.branchid = tenant.branchid;
  }
  return q;
};

const loadOwned = async (tenant: TenantScope, id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new TenantError("Claim not found.", "NOT_FOUND");
  const claim: any = await ExpenseClaim.findOne({ _id: oid(id), ...visibilityQuery(tenant) });
  if (!claim) throw new TenantError("Claim not found.", "NOT_FOUND");
  return claim;
};

const requireApprover = (tenant: TenantScope) => {
  if (tenant.userType !== "admin" && tenant.userType !== "branch") {
    throw new TenantError("Only an admin or branch login can approve or reject claims.");
  }
};

/** Sum of Payment lines that settled each expense note. */
const paidByNote = async (noteIds: any[]): Promise<Map<string, number>> => {
  const map = new Map<string, number>();
  const ids = noteIds.filter(Boolean).map((x) => oid(x));
  if (ids.length === 0) return map;
  const rows = await Payment.aggregate([
    { $match: { status: true, "invoices.invoiceid": { $in: ids } } },
    { $unwind: "$invoices" },
    { $match: { "invoices.invoicemodel": "ExpenseNote", "invoices.invoiceid": { $in: ids } } },
    {
      $group: {
        _id: "$invoices.invoiceid",
        paid: {
          $sum: {
            $add: [
              "$invoices.settledamount",
              { $ifNull: ["$invoices.discount", 0] },
              { $ifNull: ["$invoices.commission", 0] },
            ],
          },
        },
      },
    },
  ]);
  rows.forEach((r: any) => map.set(String(r._id), money(r.paid)));
  return map;
};

const populate = [
  { path: "staffid", select: "name staffcode role mobile" },
  { path: "expenseledgerid", select: "ledgername" },
  { path: "expensenoteid", select: "expensenumber status" },
];

const format = (c: any, paid: Map<string, number>) => {
  const noteId = c.expensenoteid?._id ? String(c.expensenoteid._id) : c.expensenoteid ? String(c.expensenoteid) : null;
  return {
    id: String(c._id),
    adminid: String(c.adminid),
    branchid: c.branchid ? String(c.branchid) : null,
    claimnumber: c.claimnumber,
    staffid: c.staffid?._id
      ? {
          id: String(c.staffid._id),
          name: c.staffid.name,
          staffcode: c.staffid.staffcode,
          role: c.staffid.role,
          mobile: c.staffid.mobile,
        }
      : null,
    claimdate: iso(c.claimdate),
    category: c.category,
    amount: money(c.amount),
    distancekm: c.distancekm ?? null,
    description: c.description || "",
    receipts: c.receipts || [],
    status: c.status,
    approvedamount: c.approvedamount ?? null,
    expenseledgerid: c.expenseledgerid?._id ? String(c.expenseledgerid._id) : null,
    expenseledgername: c.expenseledgerid?.ledgername || null,
    expensenoteid: noteId,
    expensenumber: c.expensenoteid?.expensenumber || null,
    paidamount: noteId ? paid.get(noteId) || 0 : 0,
    approverremarks: c.approverremarks || "",
    rejectionreason: c.rejectionreason || "",
    actionedby_name: c.actionedby_name || "",
    actionedby_type: c.actionedby_type || "",
    actionedAt: iso(c.actionedAt),
    createdby_name: c.createdby_name || "",
    createdby_type: c.createdby_type || "",
    isactive: c.isactive !== false,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
};

const listAndFormat = async (query: any) => {
  const rows: any[] = await ExpenseClaim.find(query)
    .populate(populate)
    .sort({ claimdate: -1, createdAt: -1 })
    .lean();
  const paid = await paidByNote(rows.map((r) => r.expensenoteid?._id || r.expensenoteid));
  return rows.map((r) => format(r, paid));
};

const formatOne = async (id: any) => {
  const [one] = await listAndFormat({ _id: oid(id) });
  return one;
};

const applyFilter = (q: any, filter: any = {}, tenant: TenantScope) => {
  if (filter.status) q.status = filter.status;
  if (filter.staffid && tenant.userType !== "staff") q.staffid = oid(filter.staffid);
  if (filter.branchid && tenant.userType === "admin" && !tenant.branchid) q.branchid = oid(filter.branchid);
  if (filter.dateFrom || filter.dateTo) {
    q.claimdate = {};
    if (filter.dateFrom) q.claimdate.$gte = new Date(filter.dateFrom);
    if (filter.dateTo) {
      const to = new Date(filter.dateTo);
      to.setHours(23, 59, 59, 999);
      q.claimdate.$lte = to;
    }
  }
  return q;
};

const validateInput = (input: any) => {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new TenantError("Amount must be more than zero.", "BAD_USER_INPUT");
  if (!CLAIM_CATEGORIES.includes(input.category)) throw new TenantError("Pick a valid expense category.", "BAD_USER_INPUT");
  const date = new Date(input.claimdate);
  if (isNaN(date.getTime())) throw new TenantError("Enter a valid expense date.", "BAD_USER_INPUT");
  if (date.getTime() > Date.now() + 24 * 3600 * 1000) throw new TenantError("Expense date cannot be in the future.", "BAD_USER_INPUT");
  return {
    claimdate: date,
    category: input.category,
    amount: money(amount),
    distancekm: input.distancekm != null && input.distancekm !== "" ? Number(input.distancekm) : null,
    description: String(input.description || "").trim(),
    receipts: Array.isArray(input.receipts) ? input.receipts.filter(Boolean).slice(0, 5) : [],
  };
};

/* ------------------------------------------------------------------ */
/* Resolvers                                                          */
/* ------------------------------------------------------------------ */

export const expenseClaimResolvers = {
  Query: {
    // Lets the app decide whether to show the Expense Claims screen at all.
    isExpenseClaimsEnabled: async (_: any, __: any, context: any) => {
      try {
        await scopeFor(context);
        return true;
      } catch {
        return false;
      }
    },

    getExpenseClaims: async (_: any, { filter }: any, context: any) => {
      const tenant = await scopeFor(context);
      return listAndFormat(applyFilter({ ...visibilityQuery(tenant), isactive: true }, filter, tenant));
    },

    getDeletedExpenseClaims: async (_: any, { filter }: any, context: any) => {
      const tenant = await scopeFor(context);
      return listAndFormat(applyFilter({ ...visibilityQuery(tenant), isactive: false }, filter, tenant));
    },

    getMyExpenseClaims: async (_: any, __: any, context: any) => {
      const tenant = await scopeFor(context);
      if (tenant.userType !== "staff") return [];
      return listAndFormat({ adminid: tenant.adminid, staffid: tenant.userId, isactive: true });
    },

    getExpenseClaimById: async (_: any, { id }: any, context: any) => {
      const tenant = await scopeFor(context);
      const claim = await loadOwned(tenant, id);
      return formatOne(claim._id);
    },
  },

  Mutation: {
    addExpenseClaim: async (_: any, { input }: any, context: any) => {
      const tenant = await scopeFor(context);
      const clean = validateInput(input);

      // Staff file for themselves; admin / branch may file for a staff member.
      const staffId = tenant.userType === "staff" ? tenant.userId : input.staffid;
      if (!staffId) throw new TenantError("Select the staff member this claim is for.", "BAD_USER_INPUT");
      const staff: any = await StaffAccount.findOne({ _id: oid(staffId), admin: tenant.adminid }).lean();
      if (!staff) throw new TenantError("Staff member not found.", "NOT_FOUND");
      if (tenant.userType === "branch" && staff.branchid && !tenant.branchid?.equals(staff.branchid)) {
        throw new TenantError("That staff member belongs to another branch.");
      }

      const actor = await actorOf(tenant);
      const created: any = await ExpenseClaim.create({
        ...clean,
        adminid: tenant.adminid,
        branchid: staff.branchid || tenant.branchid || null,
        staffid: staff._id,
        status: "pending",
        createdby_id: actor.id,
        createdby_name: actor.name,
        createdby_type: actor.type,
      });

      if (tenant.userType === "staff") {
        await pushNotification({
          adminid: tenant.adminid,
          branchid: created.branchid,
          targettype: "admin",
          ntype: "expenseclaim",
          title: `Expense claim from ${staff.name}`,
          message: `${CATEGORY_LABEL[clean.category] || "Expense"} • ₹${clean.amount} • ${created.claimnumber}`,
          webpath: "/expensenote?tab=claims",
          docmodel: "ExpenseClaim",
          docid: created._id,
        });
      }
      return formatOne(created._id);
    },

    editExpenseClaim: async (_: any, { id, input }: any, context: any) => {
      const tenant = await scopeFor(context);
      const claim = await loadOwned(tenant, id);
      if (claim.status !== "pending") throw new TenantError("Only a pending claim can be edited.");
      Object.assign(claim, validateInput(input));
      await claim.save();
      return formatOne(claim._id);
    },

    cancelExpenseClaim: async (_: any, { id }: any, context: any) => {
      const tenant = await scopeFor(context);
      const claim = await loadOwned(tenant, id);
      if (claim.status !== "pending") throw new TenantError("Only a pending claim can be cancelled.");
      const actor = await actorOf(tenant);
      claim.status = "cancelled";
      claim.actionedby_id = actor.id;
      claim.actionedby_name = actor.name;
      claim.actionedby_type = actor.type;
      claim.actionedAt = new Date();
      await claim.save();
      return formatOne(claim._id);
    },

    approveExpenseClaim: async (_: any, args: any, context: any) => {
      const tenant = await scopeFor(context);
      requireApprover(tenant);
      const claim = await loadOwned(tenant, args.id);
      if (claim.status !== "pending") throw new TenantError(`This claim is already ${claim.status}.`);

      const amount = args.approvedamount != null ? money(args.approvedamount) : money(claim.amount);
      if (!(amount > 0)) throw new TenantError("Approved amount must be more than zero.", "BAD_USER_INPUT");
      if (amount > money(claim.amount)) throw new TenantError("Approved amount cannot be more than the claimed amount.", "BAD_USER_INPUT");

      const staff: any = await StaffAccount.findById(claim.staffid).lean();
      if (!staff?.ledgerid) throw new TenantError("This staff member has no ledger. Open and save the staff account once, then approve.");

      // Debit side: the ledger the approver picked, else the TA/DA Expense ledger.
      let expenseLedgerId: any = null;
      if (args.expenseledgerid) {
        const led: any = await AccountLedger.findOne({ _id: oid(args.expenseledgerid), admin: tenant.adminid }).select("_id").lean();
        if (!led) throw new TenantError("Expense ledger not found.", "NOT_FOUND");
        expenseLedgerId = led._id;
      } else {
        const led: any = await ensureCategoryLedger(tenant.adminid, "tada");
        expenseLedgerId = led._id;
      }

      // An ExpenseNote belongs to a branch. Staff without a branch → use the
      // branch the approver is working in.
      const branchid = claim.branchid || tenant.branchid;
      if (!branchid) {
        throw new TenantError("This staff member has no branch. Pick a branch in the header, then approve.");
      }

      const actor = await actorOf(tenant);
      const remark = `${claim.claimnumber} • ${CATEGORY_LABEL[claim.category] || "Expense"}${claim.description ? ` • ${claim.description}` : ""}`;
      const createdby = { createdby_id: actor.id, createdby_name: actor.name, createdby_type: actor.type };

      const note: any = await ExpenseNote.create({
        adminid: tenant.adminid,
        branchid,
        expensedate: claim.claimdate,
        // Nothing has been paid yet: the business owes the staff member.
        paymenttype: "credit",
        ledgerid: staff.ledgerid,
        category: "tada",
        staffid: staff._id,
        narration: `Expense claim ${claim.claimnumber} - ${staff.name}`,
        notes: args.remarks || "",
        expenses: [{ expenseledgerid: expenseLedgerId, amount, gstpercent: 0, remarks: remark.slice(0, 200) }],
        totalamount: amount,
        totalgst: 0,
        ...createdby,
      });
      await (ExpenseNote as any).createJournalAndPayment(note, createdby);

      claim.status = "approved";
      claim.approvedamount = amount;
      claim.expenseledgerid = expenseLedgerId;
      claim.expensenoteid = note._id;
      claim.approverremarks = args.remarks || "";
      claim.actionedby_id = actor.id;
      claim.actionedby_name = actor.name;
      claim.actionedby_type = actor.type;
      claim.actionedAt = new Date();
      if (!claim.branchid) claim.branchid = branchid;
      await claim.save();

      await pushNotification({
        adminid: tenant.adminid,
        branchid,
        targettype: "staff",
        targetid: staff._id,
        ntype: "expenseclaim",
        title: "Expense claim approved",
        message: `${claim.claimnumber} • ₹${amount}${amount < money(claim.amount) ? ` of ₹${money(claim.amount)}` : ""}`,
        appscreen: "ExpenseClaims",
        docmodel: "ExpenseClaim",
        docid: claim._id,
      });

      return formatOne(claim._id);
    },

    rejectExpenseClaim: async (_: any, { id, reason }: any, context: any) => {
      const tenant = await scopeFor(context);
      requireApprover(tenant);
      const claim = await loadOwned(tenant, id);
      if (claim.status !== "pending") throw new TenantError(`This claim is already ${claim.status}.`);
      const why = String(reason || "").trim();
      if (!why) throw new TenantError("Enter a reason for rejecting.", "BAD_USER_INPUT");

      const actor = await actorOf(tenant);
      claim.status = "rejected";
      claim.rejectionreason = why;
      claim.actionedby_id = actor.id;
      claim.actionedby_name = actor.name;
      claim.actionedby_type = actor.type;
      claim.actionedAt = new Date();
      await claim.save();

      await pushNotification({
        adminid: tenant.adminid,
        branchid: claim.branchid,
        targettype: "staff",
        targetid: claim.staffid,
        ntype: "expenseclaim",
        title: "Expense claim rejected",
        message: `${claim.claimnumber} • ${why}`,
        appscreen: "ExpenseClaims",
        docmodel: "ExpenseClaim",
        docid: claim._id,
      });

      return formatOne(claim._id);
    },

    deleteExpenseClaim: async (_: any, { id }: any, context: any) => {
      const tenant = await scopeFor(context);
      const claim = await loadOwned(tenant, id);
      // An approved claim has a posted Expense Note behind it — delete that
      // note from Expense Notes instead, so the books and the claim agree.
      if (claim.status === "approved") {
        throw new TenantError("An approved claim cannot be deleted. Delete its Expense Note instead.");
      }
      claim.isactive = false;
      await claim.save();
      return true;
    },

    resetExpenseClaim: async (_: any, { id }: any, context: any) => {
      const tenant = await scopeFor(context);
      const claim: any = await ExpenseClaim.findOne({ _id: oid(id), ...visibilityQuery(tenant), isactive: false });
      if (!claim) throw new TenantError("Claim not found.", "NOT_FOUND");
      claim.isactive = true;
      await claim.save();
      return true;
    },
  },
};
