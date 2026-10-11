import mongoose, { Schema } from "mongoose";

/**
 * A pending billing-panel login waiting for its email OTP.
 *
 * Only used when the business has Business Settings -> "Login to the billing
 * panel needs an email OTP" switched on. The password has already been
 * checked when a row is written here; the token is only issued once the OTP
 * mailed to the account's email comes back.
 *
 * One row per (kind, user) — a new OTP request overwrites it. The OTP itself
 * is stored as a SHA-256 hash, never in plain text. Rows clean themselves up a
 * day after the last update (TTL index).
 */
const loginOtpSchema = new Schema(
  {
    kind: { type: String, enum: ["admin", "branch", "staff"], required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    otpHash: { type: String, required: true },
    otpExpiry: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

loginOtpSchema.index({ kind: 1, userId: 1 }, { unique: true });
loginOtpSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const LoginOtp = mongoose.model("LoginOtp", loginOtpSchema);
