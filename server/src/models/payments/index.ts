import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    // Unique auto-generated payment code
    paymentcode: { type: String, unique: true, sparse: true },

    paymentdate: { type: Date, default: Date.now },

    // inflow = receipt, outflow = payment
    type: { type: String, enum: ["receipt", "payment"], required: true },

    // mode of payment
    mode: { 
      type: String, 
      enum: ["cash", "bank", "upi", "card", "cheque", "other"], 
      required: true 
    },

    // Party account (customer/vendor/expense etc.)
    partyid: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },

    // Multiple invoice settlements (partial allowed)
    invoices: [
      {
        invoiceid: { type: mongoose.Schema.Types.ObjectId, refPath: "invoices.invoicemodel" },
        invoicemodel: { type: String, enum: ["SalesInvoice", "PurchaseInvoice"] },
        settledamount: { type: Number, required: true },
      },
    ],

    amount: { type: Number, required: true },
    reference: { type: String }, // cheque no / UPI txn id / bank ref
    remarks: { type: String },

    // Auto-generated journal entry
    transactionid: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },

    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ✅ Auto-generate paymentcode before saving
paymentSchema.pre("save", async function (next) {
  if (!this.paymentcode) {
    const Payment = mongoose.model("Payment");

    // Find last payment with code pattern #PAYxxxx
    const lastPayment = await Payment.findOne({ paymentcode: { $regex: /^#PAY\d{4}$/ } })
      .sort({ paymentcode: -1 })
      .exec();

    let nextNumber = 1;
    if (lastPayment?.paymentcode) {
      const lastNumber = parseInt(lastPayment.paymentcode.replace("#PAY", ""), 10);
      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
    }

    this.paymentcode = `#PAY${nextNumber.toString().padStart(4, "0")}`;
  }
  next();
});

export const Payment = mongoose.model("Payment", paymentSchema);
