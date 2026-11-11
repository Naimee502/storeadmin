import mongoose, { Schema } from "mongoose";

// AI: what the agent did (audit + the monthly cap) and the opportunities it found.

const aiLogSchema = new Schema(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: Schema.Types.ObjectId, ref: "Branch" },
    // ask, readinquiry, score, draftmessage, draftquote, summary
    task: { type: String, required: true },
    model: { type: String },
    // Which key paid for it: "platform" or "own".
    keysource: { type: String },
    promptchars: { type: Number },
    intokens: { type: Number },
    outtokens: { type: Number },
    ms: { type: Number },
    ok: { type: Boolean },
    error: { type: String },
    // The question only; answers and customer text are not stored.
    question: { type: String },
    userid: { type: String },
    username: { type: String },
  },
  { timestamps: true }
);
aiLogSchema.index({ adminid: 1, createdAt: -1 });

const opportunitySchema = new Schema(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: Schema.Types.ObjectId, ref: "Branch" },
    // dormant, coldquote, servicedue, amcdue, crosssell, nofollowup
    kind: { type: String, required: true },
    // One row per customer and kind; found again later just updates it.
    dedupekey: { type: String, required: true },
    partyacc: { type: Schema.Types.ObjectId, ref: "Account" },
    leadid: { type: Schema.Types.ObjectId, ref: "Lead" },
    name: { type: String },
    mobile: { type: String },
    city: { type: String },
    title: { type: String },
    // Plain-language why, written from the data (AI rewrites it when it is on).
    reason: { type: String },
    // 0-100, highest first on the dashboard.
    score: { type: Number },
    value: { type: Number },
    dueAt: { type: Date },
    lastorderAt: { type: Date },
    draftmessage: { type: String },
    // open, done, dismissed, converted
    state: { type: String, default: "open" },
    convertedleadid: { type: Schema.Types.ObjectId, ref: "Lead" },
    actedby_name: { type: String },
    actedAt: { type: Date },
    foundAt: { type: Date },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);
opportunitySchema.index({ adminid: 1, dedupekey: 1 }, { unique: true });
opportunitySchema.index({ adminid: 1, state: 1, score: -1 });

export const AiLog = mongoose.model("AiLog", aiLogSchema);
export const Opportunity = mongoose.model("Opportunity", opportunitySchema);
