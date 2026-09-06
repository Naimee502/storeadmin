import mongoose from "mongoose";

const purchaseOrderSchema = new mongoose.Schema(
  {
    paymenttype: { type: String, required: true },
    partyacc: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    taxorsupplytype: { type: String, required: true },
    billdate: { type: String, required: true },
    billtype: { type: String, required: true },
    billnumber: { type: String }, // Auto-generated if not provided
    notes: { type: String },

    ordertype: { type: String, default: "retail" },
    subtotal: { type: Number, required: true },
    totaldiscount: { type: Number, required: true },
    totalgst: { type: Number, required: true },
    totalamount: { type: Number, required: true },

    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    purchasemenid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount" },

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    productservice: [
      {
        productserviceid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService", required: true },
        variantid: { type: mongoose.Schema.Types.ObjectId },
        purchaseunitid: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
        unitqty: { type: Number, default: 1 },
        gst: { type: Number, required: true },
        qty: { type: Number, required: true },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        salesaccountid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger" },
        purchaseaccountid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger" },
        serviceaccountid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger" },
      }
    ],

    othercharges: [
      {
        ledgerid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger", required: true },
        ledgername: { type: String },
        amount: { type: Number, required: true },
        gstpercent: { type: Number, default: 0 },
        gstamount: { type: Number, default: 0 },
        totalamount: { type: Number, required: true },
        remarks: { type: String },
      }
    ],

    deliverydate: { type: String },
    duedate: { type: String },
    transportname: { type: String },
    vehiclenumber: { type: String },
    ewaybillno: { type: String },
    distance: { type: Number },
    roundoff: { type: Number, default: 0 },
    invoicediscount: { type: Number, default: 0 },
    invoicediscounttype: { type: String, default: "amount" },

    isservice: { type: Boolean, default: false },
    isConverted: { type: Boolean, default: false },

    // Canonical lifecycle status, mirroring SalesOrder.orderStatus. A purchase
    // has no dispatch leg of its own — the goods simply arrive — so the middle
    // step is "received" where sales has dispatched + delivered.
    // pending → confirmed → received, plus cancelled / returned.
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "received", "cancelled", "returned"],
      default: "pending",
    },
    receivedAt: { type: Date },
    receivedById: { type: mongoose.Schema.Types.ObjectId },
    receivedByName: { type: String },
    receivedByType: { type: String },

    // Order lifecycle: "open" / "cancelled" / "converted".
    cancelStatus: { type: String, default: "open" },
    cancelReason: { type: String },
    cancelledAt: { type: Date },
    status: { type: Boolean, default: true }
  },
  { timestamps: true }
);

purchaseOrderSchema.pre("save", async function (next) {
  if (!this.billnumber) {
    // Use the HIGHEST existing billnumber (not the latest createdAt) so numbers
    // never repeat even if docs were inserted out of order — the createdAt sort
    // handed two orders the same PO number. Zero-padded strings sort correctly
    // as strings. Same rule as SalesOrder.
    const lastOrder = await mongoose.model("PurchaseOrder")
      .findOne({ adminid: this.adminid, billnumber: { $ne: null } })
      .sort({ billnumber: -1 })
      .select("billnumber")
      .lean() as any;
    let nextNum = 1;
    if (lastOrder && lastOrder.billnumber) {
      const lastNum = parseInt(lastOrder.billnumber, 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    this.billnumber = nextNum.toString().padStart(6, "0");
  }
  next();
});

export const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);
