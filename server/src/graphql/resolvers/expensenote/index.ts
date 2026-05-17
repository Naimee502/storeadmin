import mongoose from "mongoose";
import { ExpenseNote } from "../../../models/expensenote";
import { AccountLedger } from "../../../models/accountledgers";
import { AccountGroup } from "../../../models/accountgroups";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Ensure a single ledger exists under a given group; create both if missing.
// Mirrors the pattern used elsewhere (sales invoice GST ledger creation,
// staff account auto-ledger setup).
const ensureLedger = async (
  adminid: any,
  ledgername: string,
  groupName: string,
  groupCategory: "expenses" | "income" | "assets" | "liabilities" = "expenses",
  ledgertype: string = "expense"
) => {
  let ledger = await AccountLedger.findOne({ admin: adminid, ledgername });
  if (ledger) return ledger;

  let group = await AccountGroup.findOne({ admin: adminid, accountgroupname: groupName });
  if (!group) {
    group = await AccountGroup.create({
      admin: adminid,
      accountgroupname: groupName,
      category: groupCategory,
      status: true,
    });
  }

  ledger = await AccountLedger.create({
    admin: adminid,
    accountgroupid: group._id,
    ledgername,
    ledgertype,
    openingbalance: 0,
    openingbalancetype: "debit",
    status: true,
  });
  return ledger;
};

// Map an expense category to the canonical ledger that should sit on the
// debit side of the journal entry. Resolved on demand so admins who don't
// use TA/DA or salary never see these ledgers in their COA.
const ensureCategoryLedger = async (adminid: any, category: string) => {
  if (category === "tada") {
    return ensureLedger(
      adminid,
      "TA/DA Expense",
      "Selling & Distribution Expenses",
      "expenses",
      "expense"
    );
  }
  if (category === "salary") {
    return ensureLedger(
      adminid,
      "Staff Salary",
      "Direct Expenses",
      "expenses",
      "expense"
    );
  }
  return null; // general / other → user picks ledger manually
};

const formatLedgerRef = (l: any) =>
  l ? { id: l._id.toString(), ledgername: l.ledgername } : null;

const formatStaffRef = (s: any) =>
  s
    ? {
        id: s._id.toString(),
        name: s.name,
        staffcode: s.staffcode,
        ledgerid: s.ledgerid?.toString?.() ?? s.ledgerid,
        salary: s.salary,
        role: s.role,
      }
    : null;

const formatExpense = (r: any) => ({
  id: r._id.toString(),
  ...r,
  ledgerid: formatLedgerRef(r.ledgerid),
  staffid: formatStaffRef(r.staffid),
  expenses: r.expenses.map((e: any) => ({
    expenseledgerid: formatLedgerRef(e.expenseledgerid),
    amount: e.amount,
    gstpercent: e.gstpercent,
    remarks: e.remarks,
  })),
});

const populatePaths = ["ledgerid", "staffid", "expenses.expenseledgerid"];

export const expenseNoteResolvers = {
  Query: {
    getExpenseNotes: async (_: any, args: { filter?: any }, context: any) => {
      const filter = args.filter || {};
      const query: any = { status: true };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        query.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        query.createdby_id = user?.id;
      }

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.paymenttype) query.paymenttype = filter.paymenttype;
      if (filter.category) query.category = filter.category;
      if (filter.staffid) query.staffid = new mongoose.Types.ObjectId(filter.staffid);
      if (filter.expensenumber)
        query.expensenumber = { $regex: filter.expensenumber, $options: "i" };
      if (typeof filter.status === "boolean") query.status = filter.status;

      if (filter.dateFrom || filter.dateTo) {
        query.expensedate = {};
        if (filter.dateFrom) query.expensedate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.expensedate.$lte = new Date(filter.dateTo);
      }

      const records = (await ExpenseNote.find(query)
        .populate(populatePaths)
        .sort({ expensedate: -1, createdAt: -1 })
        .lean()) as any[];

      return records.map(formatExpense);
    },

    getDeletedExpenseNotes: async (_: any, args: { filter?: any }, context: any) => {
      const filter = args.filter || {};
      const query: any = { status: false };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        query.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        query.createdby_id = user?.id;
      }

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);

      const records = (await ExpenseNote.find(query)
        .populate(populatePaths)
        .lean()) as any[];

      return records.map(formatExpense);
    },

    getExpenseNoteById: async (_: any, args: { id: string; adminid?: string }) => {
      const query: any = { _id: new mongoose.Types.ObjectId(args.id) };
      if (args.adminid) query.adminid = new mongoose.Types.ObjectId(args.adminid);

      const r = (await ExpenseNote.findOne(query)
        .populate(populatePaths)
        .lean()) as any;

      if (!r) return null;
      return formatExpense(r);
    },

    // Returns the canonical ledger for a given expense category, creating
    // it lazily if it doesn't exist yet. The form calls this once when the
    // user picks "TA/DA" or "Salary" so the expense line auto-populates.
    getExpenseCategoryLedger: async (
      _: any,
      args: { adminid: string; category: string }
    ) => {
      const ledger = await ensureCategoryLedger(args.adminid, args.category);
      return formatLedgerRef(ledger);
    },
  },

  Mutation: {
    addExpenseNote: async (_: any, { input }: any, context: any) => {
      // For TA/DA + salary, ensure the canonical expense ledger exists
      // *before* saving, since the journal poster will look it up.
      if (input.category && input.category !== "general" && input.category !== "other") {
        await ensureCategoryLedger(input.adminid, input.category);
      }

      // ✅ Extract user info from context and populate createdby fields
      const { user } = context;
      const createdbyData = {
        createdby_id: user?.id,
        createdby_name: user?.name || user?.email,
        createdby_type: user?.type || 'admin',
      };

      const created = await ExpenseNote.create({ ...input, ...createdbyData });
      const populated = (await ExpenseNote.findById(created._id)
        .populate(populatePaths)
        .lean()) as any;

      return formatExpense(populated);
    },

    editExpenseNote: async (_: any, { id, input }: any) => {
      const updated = (await ExpenseNote.findByIdAndUpdate(id, input, { new: true })
        .populate(populatePaths)
        .lean()) as any;
      return formatExpense(updated);
    },

    deleteExpenseNote: async (_: any, { id }: any) => {
      const result = await ExpenseNote.findByIdAndUpdate(id, { status: false });
      return !!result;
    },

    resetExpenseNote: async (_: any, { id }: any) => {
      const result = await ExpenseNote.findByIdAndUpdate(id, { status: true });
      return !!result;
    },
  },
};
