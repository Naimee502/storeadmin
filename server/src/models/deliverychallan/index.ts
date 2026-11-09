import mongoose from "mongoose";
import { nextMainBillNumber } from "../../utils/billnumber";
import { ProductBranchStock } from "../productbranchstock";
import { ProductService } from "../products";
import { convertToBaseUnit } from "../../utils/unitconversation";

// Goods leaving with a challan (Rule 55). Posts nothing to the ledger; stock moves
// here only when the challan comes first (stockapplied), so the invoice made from it skips stock.
const deliveryChallanSchema = new mongoose.Schema(
  {
    partyacc: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    billdate: { type: String, required: true },
    billnumber: { type: String },
    clientRequestId: { type: String },
    offlineNumber: { type: String },
    reason: {
      type: String,
      enum: ["sale", "jobwork", "approval", "repair", "branchtransfer", "other"],
      default: "sale",
    },
    notes: { type: String },

    sourceorderid: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder" },
    sourceinvoiceid: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice" },

    subtotal: { type: Number, default: 0 },
    totaldiscount: { type: Number, default: 0 },
    totalgst: { type: Number, default: 0 },
    totalamount: { type: Number, default: 0 },

    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    productservice: [
      {
        productserviceid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService", required: true },
        variantid: { type: mongoose.Schema.Types.ObjectId },
        salesunitid: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
        unitqty: { type: Number, default: 1 },
        qty: { type: Number, required: true },
        rate: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        gst: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
      },
    ],

    transportname: { type: String },
    vehiclenumber: { type: String },
    ewaybillno: { type: String },
    distance: { type: Number },
    deliverydate: { type: String },

    // Whether this challan took the goods out of branch stock (false when made from an invoice).
    stockapplied: { type: Boolean, default: false },
    challanStatus: { type: String, enum: ["open", "delivered", "returned"], default: "open" },
    deliveredAt: { type: Date },
    returnedAt: { type: Date },

    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);

deliveryChallanSchema.pre("save", async function (next) {
  if (!this.billnumber) this.billnumber = await nextMainBillNumber("DeliveryChallan", this.adminid);
  next();
});

deliveryChallanSchema.index(
  { adminid: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } }
);
deliveryChallanSchema.index({ adminid: 1, sourceorderid: 1 });
deliveryChallanSchema.index({ adminid: 1, sourceinvoiceid: 1 });

/** Move branch stock for a challan's lines: sign -1 takes goods out, +1 puts them back. */
export async function moveChallanStock(doc: any, sign: 1 | -1) {
  for (const item of doc?.productservice || []) {
    const product: any = await ProductService.findById(item.productserviceid).select("productvariants isservice").lean();
    if (!product || product.isservice) continue;
    const variant = product.productvariants?.find((v: any) => String(v._id) === String(item.variantid));
    const qtyBase = convertToBaseUnit(Number(item.qty) * Number(item.unitqty || 1), item.salesunitid, variant);
    const key = { productid: item.productserviceid, variantid: item.variantid, branchid: doc.branchid };
    const stock: any = await ProductBranchStock.findOne(key).lean();
    const cur = Number(stock?.currentstock || 0);
    const avg = Number(stock?.averagecost || 0);
    const next = cur + sign * qtyBase;
    // adminid is written so an upserted row stays visible to stock reports.
    await ProductBranchStock.updateOne(
      key,
      { $set: { currentstock: next, currentstockamount: next * avg, closingstock: next, closingstockamount: next * avg, adminid: doc.adminid } },
      { upsert: true }
    );
  }
}

export const DeliveryChallan = mongoose.model("DeliveryChallan", deliveryChallanSchema);
