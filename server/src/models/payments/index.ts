import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    paymentcode: { type: String },

    paymentdate: { type: Date, default: Date.now },

    type: { type: String, enum: ["receipt", "payment", "refund"], required: true },

    mode: {
      type: String,
      enum: ["cash", "bank", "upi", "card", "cheque", "other"],
      required: true,
    },

    partyid: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },

    // The OTHER side of the voucher when there is no party — Tally's Receipt /
    // Payment, where the counter leg is simply a ledger: Capital introduced,
    // a loan taken or repaid, rent, salary, interest, a bank charge.
    //
    // Exactly one of partyid / counterledgerid carries the non-cash leg. With a
    // party the leg is that party's ledger and the money can settle bills; with
    // a counter ledger there are no bills, just the two legs.
    counterledgerid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger", default: null },

    ledgerid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger", required: true },

    invoices: [
      {
        invoiceid: { type: mongoose.Schema.Types.ObjectId, refPath: "invoices.invoicemodel" },
        invoicemodel: { type: String, enum: ["SalesInvoice", "PurchaseInvoice", "SalesReturn", "PurchaseReturn", "ExpenseNote"] },
        // Amount knocked off the bill's outstanding (the receivable/payable cleared).
        settledamount: { type: Number, required: true },
        // Optional concessions given while settling (feature-flagged in the UI):
        // the bill is fully cleared but cash received is lower by these amounts,
        // which post to "Discount Allowed" / "Commission" ledgers.
        discount: { type: Number, default: 0 },
        commission: { type: Number, default: 0 },
        // Audit: was this line picked by the user, or proposed by FIFO?
        // Lets a report answer "who cleared this bill and how" months later.
        allocatedmode: { type: String, enum: ["manual", "auto_fifo"], default: "manual" },
        allocatedat: { type: Date },
      },
    ],

    amount: { type: Number, required: true },

    // Concession totals for the WHOLE payment. For a party settlement these are
    // just the sum of invoices[].discount / .commission, kept here so a report
    // never has to walk the array. In Ledger mode there is no bill line at all,
    // so this is the only place the concession can live.
    discount: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },

    // Part of this receipt that cleared the party's OPENING BALANCE — the
    // amount they carried in before any invoice existed. It isn't a bill, so it
    // can't live in invoices[]; without this field an advance always looked
    // bigger than the party's real credit.
    openingsettled: { type: Number, default: 0 },

    // Cash received but not tied to any bill — Tally's "On Account".
    // The party ledger is ALWAYS posted in full, so this never affects the
    // books; it only tells the aging report how much is still floating.
    unallocatedamount: { type: Number, default: 0 },

    // How this payment's lines were produced. "on_account" means nothing was
    // allocated at all (the whole amount is floating).
    allocationmode: {
      type: String,
      enum: ["manual", "auto_fifo", "on_account"],
      default: "manual",
    },

    reference: { type: String },
    remarks: { type: String },

    transactionid: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    // The salesman who booked the source order in the field (when this receipt
    // was auto-created from an order→invoice). Lets salesman reports credit the
    // collection to them even when an admin formalised the invoice.
    orderedby_id: { type: mongoose.Schema.Types.ObjectId },
    orderedby_name: { type: String },
    orderedby_type: { type: String },

    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

paymentSchema.index({ adminid: 1, branchid: 1, paymentcode: 1 }, { unique: true });

// Auto-generate paymentcode before saving and scope to admin
paymentSchema.pre("save", async function (next) {
  if (!this.paymentcode) {
    const Payment = mongoose.model("Payment");

    const query: any = {
      adminid: this.adminid,
      branchid: this.branchid,
      paymentcode: { $regex: /^#PAY\d{4}$/ },
    };

    const lastPayment = await Payment.findOne(query).sort({ paymentcode: -1 }).exec();
    let nextNumber = 1;
    if (lastPayment?.paymentcode) {
      const lastNumber = parseInt(String(lastPayment.paymentcode).replace("#PAY", ""), 10);
      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
    }
    this.paymentcode = `#PAY${nextNumber.toString().padStart(4, "0")}`;
  }
  next();
});

// index for fast admin scoped lookup
paymentSchema.index({ adminid: 1, paymentcode: 1 });

export const Payment = mongoose.model("Payment", paymentSchema);
