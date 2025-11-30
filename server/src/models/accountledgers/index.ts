import mongoose from "mongoose";

const accountLedgerSchema = new mongoose.Schema(
  {
    ledgercode: { type: String }, 
    ledgername: { type: String, required: true, trim: true },

    accountgroupid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountGroup",
      required: true,
    },

    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },

    branchid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    ledgertype: {
      type: String,
      enum: ["customer", "vendor", "bank", "cash", "gst", "expense", "income", "other"],
      default: "other",
    },

    openingbalance: { type: Number, default: 0 },
    openingbalancetype: {
      type: String,
      enum: ["debit", "credit"],
      default: "debit",
    },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

accountLedgerSchema.index({ admin: 1, ledgercode: 1 }, { unique: true });
accountLedgerSchema.index({ admin: 1, ledgername: 1,  }, { unique: true });

// Auto Ledger Code per admin
accountLedgerSchema.pre("save", async function (next) {
  if (!this.ledgercode) {
    const Ledger = mongoose.model("AccountLedger");

    // Find last ledger for this admin
    const lastLedger = await Ledger.findOne({
      admin: this.admin,
      ledgercode: { $regex: /^#LEDG\d{4}$/ },
    }).sort({ ledgercode: -1 });

    let nextNum = 1;
    if (lastLedger?.ledgercode) {
      const lastNum = parseInt(lastLedger.ledgercode.replace("#LEDG", ""), 10);
      nextNum = lastNum + 1;
    }

    this.ledgercode = `#LEDG${String(nextNum).padStart(4, "0")}`;
  }

  next();
});

export const AccountLedger = mongoose.model("AccountLedger", accountLedgerSchema);
