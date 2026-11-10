import mongoose from "mongoose";
import { nextMainBillNumber } from "../../utils/billnumber";

// A price offer. Posts nothing and moves no stock; revisions share the number (R0, R1, ...).
const quotationSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    billnumber: { type: String },
    offlineNumber: { type: String },
    clientRequestId: { type: String },
    revision: { type: Number, default: 0 },
    // First quotation of this number; revisions point at it.
    rootid: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation" },

    // A party, or a lead not yet a party (its details are kept on the quotation).
    partyacc: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    leadid: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" },
    customername: { type: String },
    customermobile: { type: String },
    customeraddress: { type: String },
    customercity: { type: String },
    customerstate: { type: String },
    customergstin: { type: String },
    contactperson: { type: String },

    billdate: { type: String, required: true },
    validtill: { type: String },
    subject: { type: String },
    intro: { type: String },
    terms: { type: String },
    notes: { type: String },

    productservice: [
      {
        productserviceid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService" },
        variantid: { type: mongoose.Schema.Types.ObjectId },
        salesunitid: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
        unitqty: { type: Number, default: 1 },
        qty: { type: Number, required: true },
        rate: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        gst: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
        description: { type: String },
        // Optional lines print apart and stay out of the total.
        optional: { type: Boolean },
      },
    ],
    subtotal: { type: Number, default: 0 },
    totaldiscount: { type: Number, default: 0 },
    totalgst: { type: Number, default: 0 },
    totalamount: { type: Number, default: 0 },

    // draft, sent, accepted, rejected, revised, converted
    quotationStatus: { type: String, default: "draft" },
    statusreason: { type: String },
    statusAt: { type: Date },
    convertedorderid: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder" },

    createdby_id: { type: String },
    createdby_name: { type: String },
    createdby_type: { type: String },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);

quotationSchema.pre("save", async function (next) {
  if (!this.billnumber) this.billnumber = await nextMainBillNumber("Quotation", this.adminid);
  next();
});

quotationSchema.index({ adminid: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });
quotationSchema.index({ adminid: 1, billnumber: 1, revision: -1 });
quotationSchema.index({ adminid: 1, leadid: 1 });

export const Quotation = mongoose.model("Quotation", quotationSchema);
