import mongoose from "mongoose";
import { ExpenseNote } from "../../../models/expensenote";
import { AccountLedger } from "../../../models/accountledgers";
import { AccountGroup } from "../../../models/accountgroups";
import { AdminSettings } from "../../../models/adminsettings";
import { StaffAccount } from "../../../models/staffaccounts";
import { containsRx, pageWindow, textMatch, notCleared } from "../../../utils/listquery";
import { activeText, dmyOrDash, fixed2, searchAndFilterClauses, textOr } from "../transactions/listtext";

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
export const ensureCategoryLedger = async (adminid: any, category: string) => {
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

export const formatExpense = (r: any) => ({
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

// List resolvers only: same paths, but fetch just the fields formatLedgerRef /
// formatStaffRef read, instead of whole ledger / staff documents per row.
export const listPopulatePaths: any[] = [
  { path: "ledgerid", select: "ledgername" },
  { path: "staffid", select: "name staffcode ledgerid salary role" },
  { path: "expenses.expenseledgerid", select: "ledgername" },
];

/** Role and filter scope of the expense notes list (getExpenseNotes and its page query). */
export function buildExpenseNoteQuery(filter: any, context: any): any {
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
  return query;
}

// Columns of the Expense Notes list the server can search and filter.
const EXPENSE_TEXT_KEYS = [
  "expensenumber", "expensedate", "categoryLabel", "staffLabel", "ledgername",
  "paymenttype", "narration", "totalamount", "totalgst", "createdByDisplay", "status",
];

/** Clause matching the text one Expense Notes list column shows. */
const expenseColumnClause = (adminid?: any) => async (key: string, term: string): Promise<any | null> => {
  switch (key) {
    case "expensenumber":
      return { expensenumber: containsRx(term) };
    case "expensedate":
      return textMatch(dmyOrDash("$expensedate"), term);
    case "categoryLabel":
      return textMatch({
        $switch: {
          branches: [
            { case: { $eq: ["$category", "tada"] }, then: "TA/DA" },
            { case: { $eq: ["$category", "salary"] }, then: "Salary" },
            { case: { $eq: ["$category", "other"] }, then: "Other" },
          ],
          default: "General",
        },
      }, term);
    case "staffLabel": {
      // "Name (CODE)" of the linked staff member, "-" without one.
      const scope: any = adminid ? { admin: adminid } : {};
      const staffIds = await StaffAccount.find({
        ...scope,
        ...textMatch({
          $concat: [
            { $ifNull: [{ $toString: "$name" }, ""] },
            { $cond: [{ $gt: [{ $strLenCP: { $ifNull: [{ $toString: "$staffcode" }, ""] } }, 0] }, { $concat: [" (", { $toString: "$staffcode" }, ")"] }, ""] },
          ],
        }, term),
      }).distinct("_id");
      const or: any[] = [{ staffid: { $in: staffIds } }];
      if ("-".includes(term)) or.push({ staffid: null });
      return { $or: or };
    }
    case "ledgername": {
      const q: any = { ledgername: containsRx(term) };
      if (adminid) q.admin = adminid;
      const or: any[] = [{ ledgerid: { $in: await AccountLedger.find(q).distinct("_id") } }];
      if ("-".includes(term)) or.push({ ledgerid: null });
      return { $or: or };
    }
    case "paymenttype":
      return textMatch(textOr("$paymenttype", "-"), term);
    case "narration":
      return { narration: containsRx(term) };
    case "totalamount":
      return textMatch(fixed2("$totalamount"), term);
    case "totalgst":
      return textMatch(fixed2("$totalgst"), term);
    case "createdByDisplay":
      return textMatch(textOr("$createdby_name", "N/A"), term);
    case "status":
      return textMatch(activeText(), term);
  }
  return null;
};

export const expenseNoteResolvers = {
  Query: {
    getExpenseNotes: async (_: any, args: { filter?: any }, context: any) => {
      const filter = args.filter || {};
      const query = buildExpenseNoteQuery(filter, context);

      const records = (await ExpenseNote.find(query)
        .populate(listPopulatePaths)
        .sort({ expensedate: -1, createdAt: -1 })
        .lean()) as any[];

      return records.map(formatExpense);
    },

    // One page of getExpenseNotes, same order (expense date, newest first).
    getExpenseNotesPage: async (
      _: any,
      { filter = {}, page = 1, pageSize = 10, search = "", columnFilters = [] }:
        { filter?: any; page?: number; pageSize?: number; search?: string; columnFilters?: any[] },
      context: any
    ) => {
      const f = filter || {};
      const clauses: any[] = [buildExpenseNoteQuery(f, context)];
      clauses.push(...(await searchAndFilterClauses(search, columnFilters, EXPENSE_TEXT_KEYS, expenseColumnClause(f.adminid))));
      const query = { $and: clauses };
      const { skip, limit } = pageWindow(page, pageSize);

      const [total, records] = await Promise.all([
        ExpenseNote.countDocuments(query),
        ExpenseNote.find(query)
          .populate(listPopulatePaths)
          .sort({ expensedate: -1, createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean() as Promise<any[]>,
      ]);
      return { items: records.map(formatExpense), total };
    },

    getDeletedExpenseNotes: async (_: any, args: { filter?: any }, context: any) => {
      const filter = args.filter || {};
      const query: any = { status: false, ...notCleared };
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

      const records = (await ExpenseNote.find(query).sort({ createdAt: 1, _id: 1 })
        .populate(listPopulatePaths)
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
        createdby_name: input.createdby_name || user?.name || user?.email,
        createdby_type: user?.type || input.createdby_type || 'admin',
      };

      // ✅ Set autocreate flags from AdminSettings
      const created = await ExpenseNote.create({ ...input, ...createdbyData });

      // ✅ Explicitly call createJournalAndPayment WITH userContext
      // (ensures Transaction/Payment Created By is never N/A)
      await ExpenseNote.createJournalAndPayment(created, createdbyData);

      const populated = (await ExpenseNote.findById(created._id)
        .populate(populatePaths)
        .lean()) as any;

      return formatExpense(populated);
    },

    editExpenseNote: async (_: any, { id, input }: any, context: any) => {
      const oldExp = await ExpenseNote.findById(id);
      if (!oldExp) throw new Error("Expense note not found");

      // ✅ Extract user context for createJournalAndPayment
      const { user } = context;
      const userContext = {
        createdby_id: user?.id,
        createdby_name: input.createdby_name || oldExp.createdby_name || user?.name || user?.email,
        createdby_type: user?.type || input.createdby_type || 'admin',
      };

      const updated = (await ExpenseNote.findByIdAndUpdate(id, input, { new: true })
        .populate(populatePaths)
        .lean()) as any;

      // The journal always reposts on edit -- there is no switch for it any more.
      if (updated) {
        await ExpenseNote.createJournalAndPayment(updated, userContext);
      }

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
