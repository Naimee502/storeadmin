import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    // Unique transaction code (voucher no)
    transactioncode: { type: String, unique: true, sparse: true },

    entrytype: { type: String, enum: ["auto", "manual"], default: "auto" },

    source: {
      docmodel: {
        type: String,
        enum: ["SalesInvoice", "PurchaseInvoice", "Payment", "Receipt", "Journal", "Other"],
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

    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure balanced transaction
transactionSchema.pre("save", function (next) {
  const totalDebit = (this.entries || []).reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0);
  const totalCredit = (this.entries || []).reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);
  this.totaldebit = totalDebit;
  this.totalcredit = totalCredit;
  if (totalDebit !== totalCredit) {
    return next(new Error("Transaction not balanced (Debit ≠ Credit)"));
  }
  next();
});

// Auto-generate transactioncode before saving and scope to admin
transactionSchema.pre("save", async function (next) {
  if (!this.transactioncode) {
    const Transaction = mongoose.model("Transaction");

    // Search last transaction for the same admin (and optionally branch if you want branch-scoped codes)
    const query: any = {
      adminid: this.adminid,
      transactioncode: { $regex: /^#TRX\d{4}$/ },
    };

    const lastTransaction = await Transaction.findOne(query).sort({ transactioncode: -1 }).exec();

    let nextNumber = 1;
    if (lastTransaction?.transactioncode) {
      const lastNumber = parseInt(String(lastTransaction.transactioncode).replace("#TRX", ""), 10);
      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
    }

    this.transactioncode = `#TRX${nextNumber.toString().padStart(4, "0")}`;
  }

  next();
});

// optional: index to speed admin scoped lookups
transactionSchema.index({ adminid: 1, transactioncode: 1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
