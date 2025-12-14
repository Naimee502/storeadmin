import mongoose from "mongoose";
import { ExpenseNote } from "../../../models/expensenote";

export const expenseNoteResolvers = {
  Query: {
    getExpenseNotes: async (_: any, args: { filter?: any }) => {
      const filter = args.filter || {};
      const query: any = { status: true };

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.paymenttype) query.paymenttype = filter.paymenttype;
      if (filter.expensenumber)
        query.expensenumber = { $regex: filter.expensenumber, $options: "i" };
      if (typeof filter.status === "boolean") query.status = filter.status;

      if (filter.dateFrom || filter.dateTo) {
        query.expensedate = {};
        if (filter.dateFrom) query.expensedate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.expensedate.$lte = new Date(filter.dateTo);
      }

      const records = (await ExpenseNote.find(query)
        .populate("ledgerid")
        .populate("expenses.expenseledgerid")
        .lean()) as any[];

      return records.map((r: any) => ({
        id: r._id.toString(),
        ...r,
        ledgerid: r.ledgerid
          ? {
              id: r.ledgerid._id.toString(),
              ledgername: r.ledgerid.ledgername,
            }
          : null,
        expenses: r.expenses.map((e: any) => ({
          expenseledgerid: {
            id: e.expenseledgerid._id.toString(),
            ledgername: e.expenseledgerid.ledgername,
          },
          amount: e.amount,
          gstpercent: e.gstpercent,
          remarks: e.remarks,
        })),
      }));
    },

    getDeletedExpenseNotes: async (_: any, args: { filter?: any }) => {
      const filter = args.filter || {};
      const query: any = { status: false };

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);

      const records = (await ExpenseNote.find(query)
        .populate("ledgerid")
        .populate("expenses.expenseledgerid")
        .lean()) as any[];

      return records.map((r: any) => ({
        id: r._id.toString(),
        ...r,
        ledgerid: r.ledgerid
          ? {
              id: r.ledgerid._id.toString(),
              ledgername: r.ledgerid.ledgername,
            }
          : null,
        expenses: r.expenses.map((e: any) => ({
          expenseledgerid: {
            id: e.expenseledgerid._id.toString(),
            ledgername: e.expenseledgerid.ledgername,
          },
          amount: e.amount,
          gstpercent: e.gstpercent,
          remarks: e.remarks,
        })),
      }));
    },

    getExpenseNoteById: async (_: any, args: { id: string; adminid?: string }) => {
      const query: any = { _id: new mongoose.Types.ObjectId(args.id) };
      if (args.adminid) query.adminid = new mongoose.Types.ObjectId(args.adminid);

      const r = (await ExpenseNote.findOne(query)
        .populate("ledgerid")
        .populate("expenses.expenseledgerid")
        .lean()) as any;

      if (!r) return null;

      return {
        id: r._id.toString(),
        ...r,
        ledgerid: r.ledgerid
          ? {
              id: r.ledgerid._id.toString(),
              ledgername: r.ledgerid.ledgername,
            }
          : null,
        expenses: r.expenses.map((e: any) => ({
          expenseledgerid: {
            id: e.expenseledgerid._id.toString(),
            ledgername: e.expenseledgerid.ledgername,
          },
          amount: e.amount,
          gstpercent: e.gstpercent,
          remarks: e.remarks,
        })),
      };
    },
  },

  Mutation: {
    addExpenseNote: async (_: any, { input }: any) => {
      const created = await ExpenseNote.create(input);

      const populated = (await ExpenseNote.findById(created._id)
        .populate("ledgerid")
        .populate("expenses.expenseledgerid")
        .lean()) as any;

      return {
        id: populated._id.toString(),
        ...populated,
        ledgerid: populated.ledgerid
          ? {
              id: populated.ledgerid._id.toString(),
              ledgername: populated.ledgerid.ledgername,
            }
          : null,
        expenses: populated.expenses.map((e: any) => ({
          expenseledgerid: {
            id: e.expenseledgerid._id.toString(),
            ledgername: e.expenseledgerid.ledgername,
          },
          amount: e.amount,
          gstpercent: e.gstpercent,
          remarks: e.remarks,
        })),
      };
    },

    editExpenseNote: async (_: any, { id, input }: any) => {
      const updated = (await ExpenseNote.findByIdAndUpdate(id, input, { new: true })
        .populate("ledgerid")
        .populate("expenses.expenseledgerid")
        .lean()) as any;

      return {
        id: updated._id.toString(),
        ...updated,
        ledgerid: updated.ledgerid
          ? {
              id: updated.ledgerid._id.toString(),
              ledgername: updated.ledgerid.ledgername,
            }
          : null,
        expenses: updated.expenses.map((e: any) => ({
          expenseledgerid: {
            id: e.expenseledgerid._id.toString(),
            ledgername: e.expenseledgerid.ledgername,
          },
          amount: e.amount,
          gstpercent: e.gstpercent,
          remarks: e.remarks,
        })),
      };
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
