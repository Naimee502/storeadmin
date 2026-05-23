// models/expensenote.ts
import mongoose from "mongoose";
import { Transaction } from "../transactions";
import { Payment } from "../payments";
import { AccountLedger } from "../accountledgers";
import { getOrCreateAccount } from "../../utils/helper";

/* ===========================================================
   EXPENSE NOTE SCHEMA (LEDGER BASED – TALLY STYLE)
   =========================================================== */

const expenseNoteSchema = new mongoose.Schema(
  {
    adminid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    branchid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    /* ======================
       EXPENSE VOUCHER INFO
       ====================== */
    expensenumber: {
      type: String,
    },

    expensedate: {
      type: Date,
      default: Date.now,
    },

    paymenttype: {
      type: String,
      enum: ["cash", "bank", "credit"],
      required: true,
    },

    /**
     * 🔑 PARTY LEDGER
     * Required ONLY for CREDIT expenses
     * (Vendor / Staff / Any Ledger)
     */
    ledgerid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountLedger",
      default: null,
    },

    /**
     * Expense purpose. "general" = ad-hoc expense (default behaviour),
     * "tada" = Travelling/Daily Allowance for a salesman/staff,
     * "salary" = monthly salary entry for a staff member.
     * Used to drive smart UX in the form and to filter reports.
     */
    category: {
      type: String,
      enum: ["general", "tada", "salary", "other"],
      default: "general",
      index: true,
    },

    /**
     * Optional staff link. Set when category is tada/salary so we can
     * report "total expense paid to staff X this month" cleanly. The
     * actual ledger CREDIT (or expense-line metadata) still flows through
     * the existing `ledgerid` and `expenses[]` plumbing.
     */
    staffid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffAccount",
      default: null,
      index: true,
    },

    /**
     * Salary period like "2026-05" — only meaningful when category=salary.
     * Used to prevent paying the same staff member twice for the same month.
     */
    salaryPeriod: { type: String, default: null },

    narration: { type: String },
    notes: { type: String },

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    autocreate: {
      ledger: { type: Boolean, default: true }
    },

    /* ======================
       EXPENSE LINES
       ====================== */
    expenses: [
      {
        expenseledgerid: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AccountLedger",
          required: true,
        },

        amount: {
          type: Number,
          required: true,
          min: 0,
        },

        gstpercent: {
          type: Number,
          default: 0,
        },

        remarks: { type: String },
      },
    ],

    /* ======================
       TOTALS
       ====================== */
    totalamount: {
      type: Number,
      required: true,
    },

    totalgst: {
      type: Number,
      default: 0,
    },

    status: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* ===========================================================
   INDEXES
   =========================================================== */
expenseNoteSchema.index(
  { adminid: 1, branchid: 1, expensenumber: 1 },
  { unique: true }
);

/* ===========================================================
   AUTO EXPENSE NUMBER (#EXP0001)
   =========================================================== */
expenseNoteSchema.pre("save", async function (next) {
  if (!this.expensenumber) {
    const ExpenseNote = mongoose.model("ExpenseNote");

    const last = await ExpenseNote.findOne({
      adminid: this.adminid,
      branchid: this.branchid,
      expensenumber: { $regex: /^#EXP\d{4}$/ },
    })
      .sort({ expensenumber: -1 })
      .exec();

    let nextNum = 1;
    if (last?.expensenumber) {
      nextNum =
        parseInt(last.expensenumber.replace("#EXP", ""), 10) + 1;
    }

    this.expensenumber = `#EXP${String(nextNum).padStart(4, "0")}`;
  }

  next();
});

/* ===========================================================
   VALIDATION
   =========================================================== */
expenseNoteSchema.pre("validate", async function (next) {
  if (this.paymenttype === "credit" && !this.ledgerid) {
    return next(new Error("❌ Party ledger required for credit expense"));
  }

  // Prevent duplicate salary payment to same staff for same period
  if (
    this.category === "salary" &&
    this.salaryPeriod &&
    this.staffid &&
    this.isNew
  ) {
    const ExpenseNote = mongoose.model("ExpenseNote");
    const dupe = await ExpenseNote.findOne({
      adminid: this.adminid,
      category: "salary",
      staffid: this.staffid,
      salaryPeriod: this.salaryPeriod,
      status: true,
    });
    if (dupe) {
      return next(
        new Error(
          `❌ Salary already recorded for this staff for ${this.salaryPeriod}.`
        )
      );
    }
  }

  next();
});

/* ===========================================================
   CREATE JOURNAL + PAYMENT
   =========================================================== */
expenseNoteSchema.statics.createJournalAndPayment = async function (doc: any, userContext?: any) {
  const entries: any[] = [];
  let totalDebit = 0;

  /* ======================
     EXPENSE & GST DEBITS
     ====================== */
  for (const row of doc.expenses) {
    const baseAmt = Number(row.amount);
    const gstAmt = parseFloat(
      ((baseAmt * Number(row.gstpercent || 0)) / 100).toFixed(2)
    );

    const expenseLedger = await AccountLedger.findById(row.expenseledgerid);
    const expenseName = expenseLedger?.ledgername || "Expense";

    // 🔹 Expense Debit
    entries.push({
      ledgerid: row.expenseledgerid,
      debit: baseAmt,
      credit: 0,
      remarks: row.remarks || `Expense - ${expenseName}`,
    });

    totalDebit += baseAmt;

    // 🔹 GST Debit
    if (gstAmt > 0) {
      const cgst = await AccountLedger.findOne({
        admin: doc.adminid,
        ledgername: "Input CGST",
      });

      const sgst = await AccountLedger.findOne({
        admin: doc.adminid,
        ledgername: "Input SGST",
      });

      if (cgst && sgst) {
        const split = parseFloat((gstAmt / 2).toFixed(2));

        entries.push(
          {
            ledgerid: cgst._id,
            debit: split,
            credit: 0,
            remarks: `Input CGST on ${expenseName}`,
          },
          {
            ledgerid: sgst._id,
            debit: split,
            credit: 0,
            remarks: `Input SGST on ${expenseName}`,
          }
        );
      } else {
        const gstLedger = await getOrCreateAccount(
          "Input GST",
          "gst",
          doc.adminid,
          doc.branchid
        );

        entries.push({
          ledgerid: gstLedger._id,
          debit: gstAmt,
          credit: 0,
          remarks: `Input GST on ${expenseName}`,
        });
      }

      totalDebit += gstAmt;
    }
  }

  /* ======================
     CREDIT ENTRY
     ====================== */
  if (doc.paymenttype === "credit") {
    entries.push({
      ledgerid: doc.ledgerid,
      debit: 0,
      credit: totalDebit,
      remarks: `Expense Credit ${doc.expensenumber}`,
    });
  } else {
    const ledgerName = doc.paymenttype === "cash" ? "Cash" : "Bank Account";

    const payLedger = await AccountLedger.findOne({
      admin: doc.adminid,
      ledgername: ledgerName,
    });

    if (!payLedger) {
        throw new Error(
            `❌ Default ledger "${ledgerName}" not found. Please re-run admin setup.`
        );
    }

    entries.push({
      ledgerid: payLedger?._id,
      debit: 0,
      credit: totalDebit,
      remarks: `Expense paid via ${doc.paymenttype}`,
    });
  }

  /* ======================
     SAVE / UPDATE TRANSACTION
     (find existing to avoid duplicates on edit)
     ====================== */
  const txCreatedById = userContext?.createdby_id || doc.createdby_id;
  const txCreatedByName = userContext?.createdby_name || doc.createdby_name;
  const txCreatedByType = userContext?.createdby_type || doc.createdby_type;

  let trx = await Transaction.findOne({
    "source.docmodel": "ExpenseNote",
    "source.docid": doc._id,
  });

  if (trx) {
    trx.entries = entries;
    trx.totaldebit = totalDebit;
    trx.totalcredit = totalDebit;
    trx.transactiondate = doc.expensedate;
    trx.narration = `Expense Voucher ${doc.expensenumber}`;
    if (userContext) {
      trx.createdby_id = txCreatedById;
      trx.createdby_name = txCreatedByName;
      trx.createdby_type = txCreatedByType;
    }
    await trx.save();
  } else {
    trx = await Transaction.create({
      adminid: doc.adminid,
      branchid: doc.branchid,
      entrytype: "auto",
      source: { docmodel: "ExpenseNote", docid: doc._id },
      transactiondate: doc.expensedate,
      narration: `Expense Voucher ${doc.expensenumber}`,
      entries,
      totaldebit: totalDebit,
      totalcredit: totalDebit,
      createdby_id: txCreatedById,
      createdby_name: txCreatedByName,
      createdby_type: txCreatedByType,
    });
  }

  /* ======================
     SAVE / UPDATE PAYMENT (cash / bank only)
     (find existing via transactionid to avoid duplicates on edit)
     ====================== */
  if (doc.paymenttype !== "credit") {
    const payCreatedById = userContext?.createdby_id || doc.createdby_id;
    const payCreatedByName = userContext?.createdby_name || doc.createdby_name;
    const payCreatedByType = userContext?.createdby_type || doc.createdby_type;
    const payLedgerId = entries[entries.length - 1].ledgerid;

    const existingPayment = await Payment.findOne({ transactionid: trx._id });

    if (existingPayment) {
      existingPayment.amount = totalDebit;
      existingPayment.mode = doc.paymenttype;
      existingPayment.ledgerid = payLedgerId;
      existingPayment.remarks = `Expense Payment ${doc.expensenumber}`;
      if (userContext) {
        existingPayment.createdby_id = payCreatedById;
        existingPayment.createdby_name = payCreatedByName;
        existingPayment.createdby_type = payCreatedByType;
      }
      await existingPayment.save();
    } else {
      await Payment.create({
        adminid: doc.adminid,
        branchid: doc.branchid,
        type: "payment",
        mode: doc.paymenttype,
        amount: totalDebit,
        transactionid: trx._id,
        ledgerid: payLedgerId,
        remarks: `Expense Payment ${doc.expensenumber}`,
        createdby_id: payCreatedById,
        createdby_name: payCreatedByName,
        createdby_type: payCreatedByType,
      });
    }
  }
};

/* ===========================================================
   ❌ DISABLED: Post "save" hook - resolvers now call createJournalAndPayment explicitly WITH userContext
   This prevents duplicate Transaction/Payment creation and ensures Created By is never N/A
   =========================================================== */
// expenseNoteSchema.post("save", async function (doc: any, next) {
//   try {
//     await (ExpenseNote as any).createJournalAndPayment(doc);
//     next();
//   } catch (err:any) {
//     console.error("Expense posting failed", err);
//     next(err);
//   }
// });

/* ===========================================================
   EXPORT
   =========================================================== */
interface ExpenseNoteModel extends mongoose.Model<any> {
  createJournalAndPayment(doc: any, userContext?: any): Promise<void>;
}

export const ExpenseNote = mongoose.model<any, ExpenseNoteModel>(
  "ExpenseNote",
  expenseNoteSchema
);
