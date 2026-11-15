import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// Restaurant: a dining table of a branch; delete sets status false.
const diningTableSchema = new mongoose.Schema(
  {
    adminid: { type: ObjectId, ref: "Admin", required: true },
    branchid: { type: ObjectId, ref: "Branch" },
    name: { type: String, required: true },
    area: { type: String },
    seats: { type: Number },
    sortorder: { type: Number },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);
diningTableSchema.index({ adminid: 1, branchid: 1, status: 1 });

// An item ordered at a table; kotno is set once it is sent to the kitchen.
const tableLineSchema = new mongoose.Schema({
  productserviceid: { type: ObjectId, ref: "ProductService" },
  variantid: { type: ObjectId },
  salesunitid: { type: ObjectId, ref: "Unit" },
  name: { type: String },
  qty: { type: Number, required: true },
  rate: { type: Number, default: 0 },
  note: { type: String },
  kotno: { type: Number },
  kotAt: { type: Date },
  cancelled: { type: Boolean },
  billedqty: { type: Number, default: 0 },
});

// Running bill of a table until every item is billed on Sales Invoices (one or more, for a split bill).
const tableOrderSchema = new mongoose.Schema(
  {
    adminid: { type: ObjectId, ref: "Admin", required: true },
    branchid: { type: ObjectId, ref: "Branch" },
    tableid: { type: ObjectId, ref: "DiningTable", required: true },
    tablename: { type: String },
    covers: { type: Number },
    waitername: { type: String },
    lines: { type: [tableLineSchema], default: [] },
    kotcount: { type: Number, default: 0 },
    orderStatus: { type: String, enum: ["open", "billed", "cancelled"], default: "open" },
    invoiceids: [{ type: ObjectId, ref: "SalesInvoice" }],
    createdby_name: { type: String },
    closedAt: { type: Date },
  },
  { timestamps: true }
);
tableOrderSchema.index({ adminid: 1, branchid: 1, orderStatus: 1 });
// One running bill per table.
tableOrderSchema.index({ tableid: 1 }, { unique: true, partialFilterExpression: { orderStatus: "open" } });

export const DiningTable = mongoose.model("DiningTable", diningTableSchema);
export const TableOrder = mongoose.model("TableOrder", tableOrderSchema);
