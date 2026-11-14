import mongoose from "mongoose";

export const TICKET_STATUSES = ["open", "inprogress", "waiting", "resolved", "closed"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    byid: { type: mongoose.Schema.Types.ObjectId },
    bytype: { type: String },
    byname: { type: String },
    // Internal notes are hidden from the party.
    internal: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Customer complaints and service requests, numbered per business (TKT-000001).
const supportTicketSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    ticketno: { type: String, required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, default: "" },
    priority: { type: String, enum: TICKET_PRIORITIES, default: "normal" },
    ticketstatus: { type: String, enum: TICKET_STATUSES, default: "open", index: true },
    partyid: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    assignedto: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount" },
    raisedby: { id: mongoose.Schema.Types.ObjectId, type: { type: String }, name: String },
    comments: { type: [commentSchema], default: [] },
    resolvedAt: { type: Date },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);

supportTicketSchema.index({ adminid: 1, ticketno: 1 }, { unique: true });

export const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);
