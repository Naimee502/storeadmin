import mongoose from "mongoose";

const salesOrderSchema = new mongoose.Schema(
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

    salesmenid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount" },

    // Route this order was booked against (when taken on a route run) + how the
    // order originated. app = salesman app on a route, manual = back-office
    // entry, pos = POS dashboard. Powers the field reports route-vs-no-route /
    // via-app split.
    routeid: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRoute", default: null },
    ordersource: {
      type: String,
      enum: ["app", "manual", "pos"],
      default: "manual",
    },

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    productservice: [
      {
        productserviceid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService", required: true },
        variantid: { type: mongoose.Schema.Types.ObjectId },
        salesunitid: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
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

    // Agreed total captured at order time (ecommerce / Amazon-style).
    // Snapshot of totalamount when the order was first placed — the price the
    // customer agreed to. Must NOT drift if catalog prices change later.
    // Set once on create; never recomputed by edits.
    lockedTotal: { type: Number },

    // Canonical lifecycle status (single source of truth for the whole system).
    // pending → confirmed → dispatched → delivered, plus cancelled / returned.
    // Works for order-only businesses (no invoice). Invoice + apps read/sync this.
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "dispatched", "delivered", "cancelled", "returned"],
      default: "pending",
    },
    // Order lifecycle status. "open" → in flight, "cancelled" → user
    // cancelled before conversion, "converted" → became a Sales Invoice.
    // Kept alongside the existing soft-delete `status` boolean.
    cancelStatus: { type: String, default: "open" },
    cancelReason: { type: String },
    cancelledAt: { type: Date },

    // Fulfilment lifecycle (additive — does not replace isConverted/cancelStatus).
    // pending → (confirmed when isConverted) → dispatched → delivered.
    deliveryStatus: { type: String, enum: ["pending", "dispatched", "delivered"], default: "pending" },
    deliveredAt: { type: Date },
    deliveredById: { type: mongoose.Schema.Types.ObjectId },
    deliveredByName: { type: String },
    deliveredByType: { type: String },
    // Optional delivery-boy assignment (used in the delivery module, Phase 3).
    deliveryboyid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount" },

    status: { type: Boolean, default: true }
  },
  { timestamps: true }
);

salesOrderSchema.pre("save", async function (next) {
  if (!this.billnumber) {
    const lastOrder = await mongoose.model("SalesOrder").findOne({ adminid: this.adminid }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastOrder && lastOrder.billnumber) {
      const lastNum = parseInt(lastOrder.billnumber, 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    this.billnumber = nextNum.toString().padStart(6, "0");
  }
  next();
});

export const SalesOrder = mongoose.model("SalesOrder", salesOrderSchema);
