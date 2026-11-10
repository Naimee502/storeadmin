import mongoose from "mongoose";
import { nextMainBillNumber } from "../../utils/billnumber";
import { ProductBranchStock } from "../productbranchstock";
import { ProductService } from "../products";
import { convertToBaseUnit } from "../../utils/unitconversation";

const { ObjectId } = mongoose.Schema.Types;

// Same line keys as the bills so the offline stock engine reads them.
const lineSchema = new mongoose.Schema(
  {
    productserviceid: { type: ObjectId, ref: "ProductService", required: true },
    variantid: { type: ObjectId },
    salesunitid: { type: ObjectId, ref: "Unit" },
    unitqty: { type: Number },
    qty: { type: Number, required: true },
    // BOM only: % extra lost while making.
    wastage: { type: Number },
    rate: { type: Number },
    amount: { type: Number },
    note: { type: String },
  },
  { _id: false }
);

const operationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    workcenter: { type: String },
    minutes: { type: Number },
    costperhour: { type: Number },
    outsourced: { type: Boolean },
  },
  { _id: false }
);

// Recipe: components (may themselves have a BOM) for `qty` of one finished item.
const bomSchema = new mongoose.Schema(
  {
    adminid: { type: ObjectId, ref: "Admin", required: true },
    name: { type: String },
    productserviceid: { type: ObjectId, ref: "ProductService", required: true },
    variantid: { type: ObjectId },
    salesunitid: { type: ObjectId, ref: "Unit" },
    qty: { type: Number, required: true },
    items: { type: [lineSchema], default: undefined },
    byproducts: { type: [lineSchema], default: undefined },
    operations: { type: [operationSchema], default: undefined },
    overhead: { type: Number },
    isdefault: { type: Boolean },
    notes: { type: String },
    clientRequestId: { type: String },
    createdby_name: { type: String },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);
bomSchema.index({ adminid: 1, productserviceid: 1 });
bomSchema.index({ adminid: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });

// Plan to make an item; moves no stock.
const workOrderSchema = new mongoose.Schema(
  {
    adminid: { type: ObjectId, ref: "Admin", required: true },
    branchid: { type: ObjectId, ref: "Branch", required: true },
    billnumber: { type: String },
    offlineNumber: { type: String },
    clientRequestId: { type: String },
    billdate: { type: String, required: true },
    duedate: { type: String },
    bomid: { type: ObjectId, ref: "Bom" },
    productserviceid: { type: ObjectId, ref: "ProductService", required: true },
    variantid: { type: ObjectId },
    salesunitid: { type: ObjectId, ref: "Unit" },
    qty: { type: Number, required: true },
    qtyproduced: { type: Number },
    sourceorderid: { type: ObjectId, ref: "SalesOrder" },
    // planned, inprogress, completed, cancelled
    workStatus: { type: String, default: "planned" },
    notes: { type: String },
    createdby_name: { type: String },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);
workOrderSchema.pre("save", async function (next) {
  if (!this.billnumber) this.billnumber = await nextMainBillNumber("WorkOrder", this.adminid);
  next();
});
workOrderSchema.index({ adminid: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });

// Components go out of stock, outputs and by-products come in.
const productionSchema = new mongoose.Schema(
  {
    adminid: { type: ObjectId, ref: "Admin", required: true },
    branchid: { type: ObjectId, ref: "Branch", required: true },
    billnumber: { type: String },
    offlineNumber: { type: String },
    clientRequestId: { type: String },
    billdate: { type: String, required: true },
    workorderid: { type: ObjectId, ref: "WorkOrder" },
    bomid: { type: ObjectId, ref: "Bom" },
    components: { type: [lineSchema], default: undefined },
    outputs: { type: [lineSchema], default: undefined },
    byproducts: { type: [lineSchema], default: undefined },
    labourcost: { type: Number },
    overhead: { type: Number },
    materialcost: { type: Number },
    totalcost: { type: Number },
    // pass, fail, hold
    qcstatus: { type: String },
    qctests: { type: [{ _id: false, parameter: String, expected: String, actual: String, ok: Boolean }], default: undefined },
    serials: { type: [String], default: undefined },
    batchnumber: { type: String },
    notes: { type: String },
    createdby_name: { type: String },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);
productionSchema.pre("save", async function (next) {
  if (!this.billnumber) this.billnumber = await nextMainBillNumber("ProductionEntry", this.adminid);
  next();
});
productionSchema.index({ adminid: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });
productionSchema.index({ adminid: 1, workorderid: 1 });

const variantOf = (product: any, variantid: any) =>
  product?.productvariants?.find((v: any) => String(v._id) === String(variantid));

/** Base-unit qty of a line, null for services. */
export async function baseQty(line: any) {
  const product: any = await ProductService.findById(line.productserviceid).select("productvariants isservice").lean();
  if (!product || product.isservice) return null;
  return convertToBaseUnit(Number(line.qty || 0) * Number(line.unitqty || 1), line.salesunitid, variantOf(product, line.variantid));
}

/** sign 1 applies the entry, -1 reverses it. Incoming goods re-average at their line rate. */
export async function moveProductionStock(doc: any, sign: 1 | -1) {
  const move = async (line: any, dir: 1 | -1) => {
    const qtyBase = await baseQty(line);
    if (qtyBase === null) return;
    const key = { productid: line.productserviceid, variantid: line.variantid, branchid: doc.branchid };
    const stock: any = await ProductBranchStock.findOne(key).lean();
    const cur = Number(stock?.currentstock || 0);
    const avg = Number(stock?.averagecost || 0);
    const delta = sign * dir * qtyBase;
    const next = cur + delta;
    let nextAvg = avg;
    if (dir === 1) {
      // Rate is per line unit; spread it over base units.
      const unitCost = qtyBase ? (Number(line.rate || 0) * Number(line.qty || 0)) / qtyBase : 0;
      const held = Math.max(cur, 0) * avg;
      if (next > 0) nextAvg = Math.max(0, (held + delta * unitCost) / next);
    }
    await ProductBranchStock.updateOne(
      key,
      {
        $set: { currentstock: next, currentstockamount: next * nextAvg, closingstock: next, closingstockamount: next * nextAvg, averagecost: nextAvg, adminid: doc.adminid },
        $setOnInsert: { openingstock: 0 },
      },
      { upsert: true }
    );
  };
  for (const l of doc?.components || []) await move(l, -1);
  for (const l of doc?.outputs || []) await move(l, 1);
  for (const l of doc?.byproducts || []) await move(l, 1);
}

export const Bom = mongoose.model("Bom", bomSchema);
export const WorkOrder = mongoose.model("WorkOrder", workOrderSchema);
export const ProductionEntry = mongoose.model("ProductionEntry", productionSchema);
