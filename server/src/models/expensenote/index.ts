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

    narration: { type: String },
    notes: { type: String },

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
expenseNoteSchema.pre("validate", function (next) {
  if (this.paymenttype === "credit" && !this.ledgerid) {
    throw new Error("❌ Party ledger required for credit expense");
  }
  next();
});

/* ===========================================================
   CREATE JOURNAL + PAYMENT
   =========================================================== */
expenseNoteSchema.statics.createJournalAndPayment = async function (doc: any) {
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
     TRANSACTION
     ====================== */
  const trx = await Transaction.create({
    adminid: doc.adminid,
    branchid: doc.branchid,
    entrytype: "auto",
    source: { docmodel: "ExpenseNote", docid: doc._id },
    transactiondate: doc.expensedate,
    narration: `Expense Voucher ${doc.expensenumber}`,
    entries,
    totaldebit: totalDebit,
    totalcredit: totalDebit,
  });

  /* ======================
     PAYMENT
     ====================== */
  if (doc.paymenttype !== "credit") {
    await Payment.create({
      adminid: doc.adminid,
      branchid: doc.branchid,
      type: "payment",
      mode: doc.paymenttype,
      amount: totalDebit,
      transactionid: trx._id,
      ledgerid: entries[entries.length - 1].ledgerid,
      remarks: `Expense Payment ${doc.expensenumber}`,
    });
  }
};

/* ===========================================================
   AUTO POST AFTER SAVE
   =========================================================== */
expenseNoteSchema.post("save", async function (doc: any, next) {
  try {
    await (ExpenseNote as any).createJournalAndPayment(doc);
    next();
  } catch (err:any) {
    console.error("Expense posting failed", err);
    next(err);
  }
});

/* ===========================================================
   EXPORT
   =========================================================== */
interface ExpenseNoteModel extends mongoose.Model<any> {
  createJournalAndPayment(doc: any): Promise<void>;
}

export const ExpenseNote = mongoose.model<any, ExpenseNoteModel>(
  "ExpenseNote",
  expenseNoteSchema
);
