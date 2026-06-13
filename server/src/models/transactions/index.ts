import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    transactioncode: { type: String },

    entrytype: { type: String, enum: ["auto", "manual"], default: "auto" },

    source: {
      docmodel: {
        type: String,
        enum: ["SalesInvoice", "PurchaseInvoice", "SalesReturn", "PurchaseReturn", "Payment", "Receipt", "Journal", "ExpenseNote", "Other"],
      },
      docid: { type: mongoose.Schema.Types.ObjectId },
    },

    transactiondate: { type: Date, default: Date.now },
    narration: { type: String },

    entries: [
      {
        ledgerid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger", required: true },
        debit: { type: Number, default: 0 },
        credit: { type: Number, default: 0 },
        productserviceid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService" },
        variantid: { type: mongoose.Schema.Types.ObjectId },
        remarks: String,
      },
    ],

    totaldebit: { type: Number, default: 0 },
    totalcredit: { type: Number, default: 0 },

    // Tally-style bill allocation (Agst Ref): when this journal settles a
    // party's outstanding invoices, record the party + per-invoice allocation.
    // Same shape as Payment.invoices so outstanding is computed consistently.
    partyid: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    invoices: [
      {
        invoiceid: { type: mongoose.Schema.Types.ObjectId },
        invoicemodel: { type: String, enum: ["SalesInvoice", "PurchaseInvoice"] },
        settledamount: { type: Number, default: 0 },
      },
    ],

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ===========================================================
   FIXED: Balance Check With Proper Rounding + Correct Variables
   =========================================================== */
transactionSchema.pre("save", function (next) {
  const totalDebit = parseFloat(
    (this.entries || [])
      .reduce((sum, e) => sum + (Number(e.debit) || 0), 0)
      .toFixed(2)
  );

  const totalCredit = parseFloat(
    (this.entries || [])
      .reduce((sum, e) => sum + (Number(e.credit) || 0), 0)
      .toFixed(2)
  );

  this.totaldebit = totalDebit;
  this.totalcredit = totalCredit;

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    console.error("Transaction not balanced!");
    throw new Error(`Transaction not balanced (Debit ${totalDebit} ≠ Credit ${totalCredit})`);
  }

  next();
});

/* ===========================================================
   Auto-generate transactioncode (#TRX0001, #TRX0002...)
   =========================================================== */
transactionSchema.pre("save", async function (next) {
  if (!this.transactioncode) {
    const Transaction = mongoose.model("Transaction");

    const lastTransaction = await Transaction.findOne({
      adminid: this.adminid,
      branchid: this.branchid,
      transactioncode: { $regex: /^#TRX\d{4}$/ },
    })
      .sort({ transactioncode: -1 })
      .exec();

    let nextNumber = 1;
    if (lastTransaction?.transactioncode) {
      const lastNumber = parseInt(lastTransaction.transactioncode.replace("#TRX", ""), 10);
      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
    }

    this.transactioncode = `#TRX${nextNumber.toString().padStart(4, "0")}`;
  }

  next();
});

transactionSchema.index(
  { adminid: 1, branchid: 1, transactioncode: 1 },
  { unique: true }
);

export const Transaction = mongoose.model("Transaction", transactionSchema);
