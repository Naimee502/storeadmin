import mongoose, { Document, Schema } from "mongoose";

/**
 * A user-initiated account deletion request.
 *
 * Submitted from the public /account-deletion page — one store-neutral URL
 * shared by every app flavour, so the same link can be pasted into every
 * Play Console listing.
 *
 * WHY THIS COLLECTION EXISTS AT ALL, when the deactivation already happens
 * inside the same mutation: Google Play expects the deletion route to be
 * auditable. If the user (or the Play review team) later asks what happened
 * to a request, this is the answer. It is also the only way an admin can
 * tell that a party's login went away because the PARTY asked for it, and
 * not because someone hit Delete in the back office — the two look
 * identical on the Account document itself.
 *
 * Nothing is ever hard-deleted. Matched accounts are switched to
 * status:false, which is exactly what the admin panel's own deleteAccount
 * does: the login stops working, every record stays put for GST, and
 * resetAccount restores it if the request turns out to be a mistake.
 */

export interface IDeletionMatch {
  docmodel: "Account" | "StaffAccount";
  docid: mongoose.Types.ObjectId;
  adminid: mongoose.Types.ObjectId;
  name?: string;
  role?: string;
}

export interface IAccountDeletionRequest extends Document {
  mobile: string;
  mobileraw: string;
  name?: string;
  reason?: string;
  source: "web" | "app";
  requeststatus: "completed" | "nomatch";
  deactivatedcount: number;
  matched: IDeletionMatch[];
  ipaddress?: string;
  useragent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IDeletionMatch>(
  {
    docmodel: { type: String, enum: ["Account", "StaffAccount"], required: true },
    docid: { type: mongoose.Schema.Types.ObjectId, required: true },
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    name: { type: String },
    role: { type: String },
  },
  { _id: false }
);

const AccountDeletionRequestSchema: Schema<IAccountDeletionRequest> = new mongoose.Schema(
  {
    // Last 10 digits, which is what every lookup runs against.
    mobile: { type: String, required: true, index: true },
    // Exactly what the person typed, kept verbatim for the audit trail.
    mobileraw: { type: String, required: true },
    name: { type: String, default: "" },
    reason: { type: String, default: "" },
    source: { type: String, enum: ["web", "app"], default: "web" },

    // "nomatch" is a normal outcome, not an error: the page deliberately
    // shows the same confirmation either way, so a stranger cannot use it
    // to find out whether a given number is a customer of this platform.
    requeststatus: { type: String, enum: ["completed", "nomatch"], default: "nomatch" },

    deactivatedcount: { type: Number, default: 0 },
    matched: { type: [MatchSchema], default: [] },

    ipaddress: { type: String, default: "" },
    useragent: { type: String, default: "" },
  },
  { timestamps: true }
);

AccountDeletionRequestSchema.index({ createdAt: -1 });

export const AccountDeletionRequest = mongoose.model<IAccountDeletionRequest>(
  "AccountDeletionRequest",
  AccountDeletionRequestSchema
);
