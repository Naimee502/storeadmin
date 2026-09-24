import mongoose, { Schema } from "mongoose";

/**
 * A customer signup that has NOT been confirmed yet.
 *
 * registerAccount only stores the details here and emails an OTP. The real
 * Account (with its ledger, account code and the admin notification) is
 * created by verifyOTP once the right OTP comes back. So a signup that is
 * abandoned before the OTP never shows up in Party Accounts.
 *
 * One row per (admin, mobile); registering again just overwrites it. Rows
 * expire on their own a day after the last OTP (TTL index).
 */
const pendingRegistrationSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    otp: { type: String, required: true },
    otpExpiry: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pendingRegistrationSchema.index({ admin: 1, mobile: 1 }, { unique: true });
pendingRegistrationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const PendingRegistration = mongoose.model("PendingRegistration", pendingRegistrationSchema);
