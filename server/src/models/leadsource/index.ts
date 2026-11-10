import mongoose, { Schema } from "mongoose";

// Lead integrations: one config per business and source, and every payload a source sent.

const leadSourceSchema = new Schema(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    // indiamart, tradeindia, justdial, meta, whatsapp, website, webhook
    source: { type: String, required: true },
    enabled: { type: Boolean },
    // Secret part of this source's webhook URL (and the Meta / WhatsApp verify token).
    token: { type: String, required: true },
    // Portal keys, encrypted (utils/secret).
    key1: { type: String },
    key2: { type: String },
    key3: { type: String },
    // Round robin over these staff; empty = the admin handles the lead.
    ownerids: [{ type: Schema.Types.ObjectId, ref: "StaffAccount" }],
    rrIndex: { type: Number },
    // Book a call follow up 15 minutes after a lead arrives.
    autoFollowup: { type: Boolean },
    lastPulledAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true }
);
leadSourceSchema.index({ adminid: 1, source: 1 }, { unique: true });
leadSourceSchema.index({ token: 1 }, { unique: true });

const leadInboxSchema = new Schema(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    source: { type: String, required: true },
    externalid: { type: String },
    payload: { type: Schema.Types.Mixed },
    // created, duplicate, failed, ignored
    result: { type: String },
    leadid: { type: Schema.Types.ObjectId, ref: "Lead" },
    error: { type: String },
  },
  { timestamps: true }
);
leadInboxSchema.index({ adminid: 1, createdAt: -1 });
leadInboxSchema.index({ adminid: 1, source: 1, externalid: 1 });

export const LeadSource = mongoose.model("LeadSource", leadSourceSchema);
export const LeadInbox = mongoose.model("LeadInbox", leadInboxSchema);
