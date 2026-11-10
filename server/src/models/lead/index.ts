import mongoose, { Schema } from "mongoose";

// CRM: a lead (enquiry) and its follow-ups. Tenant-scoped; deletes are soft.

const leadProductSchema = new Schema(
  {
    productid: { type: Schema.Types.ObjectId, ref: "ProductService" },
    variantid: { type: Schema.Types.ObjectId },
    // Sales unit and its pack size, as on the invoice line (e.g. 12 per Box).
    unitid: { type: Schema.Types.ObjectId, ref: "Unit" },
    unitqty: { type: Number },
    name: { type: String },
    qty: { type: Number },
    note: { type: String },
  },
  { _id: false }
);

const customFieldSchema = new Schema({ key: { type: String, required: true }, value: { type: String } }, { _id: false });

const leadSchema = new Schema(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: Schema.Types.ObjectId, ref: "Branch" },
    leadnumber: { type: String },
    name: { type: String, required: true },
    company: { type: String },
    mobile: { type: String },
    altmobile: { type: String },
    email: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    gstin: { type: String },
    // Where it came from (walkin, phone, indiamart, justdial, website, ...) and the campaign or ad.
    source: { type: String },
    subsource: { type: String },
    externalid: { type: String },
    requirement: { type: String },
    products: [leadProductSchema],
    expectedvalue: { type: Number },
    // Stage key from Business Settings (CRM stages); "won" / "lost" kinds close the lead.
    stage: { type: String },
    temperature: { type: String },
    score: { type: Number },
    tags: [{ type: String }],
    ownerid: { type: Schema.Types.ObjectId, ref: "StaffAccount" },
    nextfollowupAt: { type: Date },
    lastcontactAt: { type: Date },
    lostreason: { type: String },
    closedAt: { type: Date },
    partyid: { type: Schema.Types.ObjectId, ref: "Account" },
    customfields: [customFieldSchema],
    notes: { type: String },
    createdby_id: { type: String },
    createdby_name: { type: String },
    createdby_type: { type: String },
    clientRequestId: { type: String },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);
leadSchema.index({ adminid: 1, status: 1, createdAt: -1 });
leadSchema.index({ adminid: 1, mobile: 1 });
leadSchema.index({ adminid: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });

const followupSchema = new Schema(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: Schema.Types.ObjectId, ref: "Branch" },
    leadid: { type: Schema.Types.ObjectId, ref: "Lead" },
    partyid: { type: Schema.Types.ObjectId, ref: "Account" },
    // call, visit, meeting, whatsapp, email, other
    type: { type: String, required: true },
    dueAt: { type: Date, required: true },
    doneAt: { type: Date },
    outcome: { type: String },
    note: { type: String },
    assignedto: { type: Schema.Types.ObjectId, ref: "StaffAccount" },
    createdby_id: { type: String },
    createdby_name: { type: String },
    createdby_type: { type: String },
    clientRequestId: { type: String },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);
followupSchema.index({ adminid: 1, leadid: 1, dueAt: 1 });
followupSchema.index({ adminid: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });

export const Lead = mongoose.model("Lead", leadSchema);
export const Followup = mongoose.model("Followup", followupSchema);
