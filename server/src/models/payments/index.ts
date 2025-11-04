import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    paymentcode: { type: String, unique: true, sparse: true },

    paymentdate: { type: Date, default: Date.now },

    type: { type: String, enum: ["receipt", "payment"], required: true },

    mode: {
      type: String,
      enum: ["cash", "bank", "upi", "card", "cheque", "other"],
      required: true,
    },

    partyid: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },

    invoices: [
      {
        invoiceid: { type: mongoose.Schema.Types.ObjectId, refPath: "invoices.invoicemodel" },
        invoicemodel: { type: String, enum: ["SalesInvoice", "PurchaseInvoice"] },
        settledamount: { type: Number, required: true },
      },
    ],

    amount: { type: Number, required: true },
    reference: { type: String },
    remarks: { type: String },

    transactionid: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },

    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Auto-generate paymentcode before saving and scope to admin
paymentSchema.pre("save", async function (next) {
  if (!this.paymentcode) {
    const Payment = mongoose.model("Payment");

    const query: any = {
      adminid: this.adminid,
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
