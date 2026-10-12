import mongoose from "mongoose";

/* ===========================================================
   EXPENSE CLAIM (Zoho-Expense style reimbursement request)

   A salesman / delivery boy / staff spends their own money in the field
   (fuel, travel, food, lodging...) and asks the business to pay it back.

     pending  ──approve──▶ approved  → an ExpenseNote is created:
                                        Dr TA/DA Expense / Cr <staff ledger>
                                        (the business now owes the staff)
              ──reject───▶ rejected  (reason shown to the staff)
              ──cancel───▶ cancelled (by the staff, while still pending)

   Reimbursement is NOT done here. The approved claim's Expense Note shows up
   in Payments → Expense like every other unpaid note, and paying it posts
   Dr <staff ledger> / Cr Cash-Bank. A claim is kept in its own collection —
   not as a "pending" ExpenseNote — because every report and ledger reads
   ExpenseNote as booked expense; an unapproved claim must never reach them.
   =========================================================== */

export const CLAIM_CATEGORIES = ["travel", "fuel", "food", "lodging", "phone", "other"] as const;
export const CLAIM_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

const expenseClaimSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },

    claimnumber: { type: String },

    staffid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount", required: true, index: true },

    claimdate: { type: Date, required: true },
    category: { type: String, enum: CLAIM_CATEGORIES, default: "other" },
    amount: { type: Number, required: true, min: 0 },
    // Fuel claims: how far the staff travelled. Informational only.
    distancekm: { type: Number, default: null },
    description: { type: String, default: "" },
    // Bill / receipt photos (uploadImage urls).
    receipts: { type: [String], default: [] },

    status: { type: String, enum: CLAIM_STATUSES, default: "pending", index: true },

    // Set on approval. The approver may pass less than was claimed (a bill
    // that only partly qualifies) — the note is booked at this figure.
    approvedamount: { type: Number, default: null },
    expenseledgerid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger", default: null },
    expensenoteid: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseNote", default: null },
    approverremarks: { type: String, default: "" },
    rejectionreason: { type: String, default: "" },
    actionedby_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    actionedby_name: { type: String, default: "" },
    actionedby_type: { type: String, default: "" },
    actionedAt: { type: Date, default: null },

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    // Soft delete (Deleted Entries), same as every other module.
    isactive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

expenseClaimSchema.index({ adminid: 1, claimnumber: 1 }, { unique: true, sparse: true });

/* #CLM0001, numbered per business. */
expenseClaimSchema.pre("save", async function (next) {
  if (!this.claimnumber) {
    const Model = mongoose.model("ExpenseClaim");
    const last: any = await Model.findOne({
      adminid: this.adminid,
      claimnumber: { $regex: /^#CLM\d+$/ },
    })
      .sort({ createdAt: -1 })
      .select("claimnumber")
      .lean();
    const lastNum = last?.claimnumber ? parseInt(String(last.claimnumber).replace("#CLM", ""), 10) || 0 : 0;
    this.claimnumber = `#CLM${String(lastNum + 1).padStart(4, "0")}`;
  }
  next();
});

export const ExpenseClaim = mongoose.model("ExpenseClaim", expenseClaimSchema);
