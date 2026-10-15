import crypto from "crypto";
import { ApolloError } from "apollo-server-express";
import { AdminSettings } from "../../models/adminsettings";
import { LoginOtp } from "../../models/loginotp";
import { sendLoginOtpEmail } from "../mail";

// ─────────────────────────────────────────────────────────────────────────────
// Email OTP step for the billing panel logins (Admin / Branch / Staff) and the
// customer (party) login on the app + website (kind "party", own flag:
// adminsettings.partyLoginEmailOtp, 4-digit code).
//
// Per business: Business Settings -> Feature Toggles -> "Login to the billing
// panel needs an email OTP" (adminsettings.loginEmailOtp). Off = login works
// exactly as before.
//
// On, the login mutation calls this AFTER the password (and any status /
// subscription) check has passed:
//   - no `otp` in the request  -> an OTP is mailed to the account's email and
//     the call fails with code LOGIN_OTP_REQUIRED (the panel then shows the
//     OTP box and repeats the login with the OTP);
//   - `otp` present            -> checked; wrong / expired fails with
//     LOGIN_OTP_INVALID, right lets the login go on and issue the token.
// Mail goes out through the same SMTP mailbox the app registration OTP uses
// (utils/mail — Hostinger today), with the business name as sender name.
// ─────────────────────────────────────────────────────────────────────────────

const OTP_TTL_MS = 10 * 60 * 1000;   // OTP valid for 10 minutes
const RESEND_GAP_MS = 60 * 1000;     // at most one mail a minute per user
const MAX_ATTEMPTS = 5;              // wrong tries before the OTP is burnt

type Kind = "admin" | "branch" | "staff" | "party";

// Each kind is switched on by its own Business Settings flag: the billing
// panel logins share one, the customer (party) app + website login has its own.
const FLAG: Record<Kind, "loginEmailOtp" | "partyLoginEmailOtp"> = {
  admin: "loginEmailOtp",
  branch: "loginEmailOtp",
  staff: "loginEmailOtp",
  party: "partyLoginEmailOtp",
};

const hash = (otp: string) => crypto.createHash("sha256").update(String(otp)).digest("hex");

const maskEmail = (email: string) => {
  const [user, domain] = String(email).split("@");
  if (!domain) return email;
  return `${user.slice(0, 2)}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
};

export const enforceLoginOtp = async (opts: {
  kind: Kind;
  userId: any;
  email?: string | null;
  adminId: any;
  businessName?: string | null;
  otp?: string | null;
}) => {
  const { kind, userId, email, adminId, businessName } = opts;
  const otp = String(opts.otp ?? "").trim();

  const adminRef = adminId?._id ?? adminId;
  if (!adminRef) return;
  const flag = FLAG[kind];
  const settings: any = await AdminSettings.findOne({ adminid: adminRef }).select(flag).lean();
  if (!settings?.[flag]) return; // feature off for this business

  if (!email) {
    throw new ApolloError(
      kind === "party"
        ? "No email address is saved on your account, so the login OTP cannot be sent. Please contact the store."
        : "This login has no email address, so the login OTP cannot be sent. Ask your admin to add one.",
      "LOGIN_OTP_NO_EMAIL"
    );
  }

  const now = Date.now();
  const row: any = await LoginOtp.findOne({ kind, userId });

  // ── Step 1: no OTP yet -> mail one ────────────────────────────────────────
  if (!otp) {
    const masked = maskEmail(email);
    const sameAddress = !row?.sentTo || row.sentTo === String(email).toLowerCase();
    if (row && sameAddress && row.otpExpiry.getTime() > now && now - row.lastSentAt.getTime() < RESEND_GAP_MS) {
      const wait = Math.ceil((RESEND_GAP_MS - (now - row.lastSentAt.getTime())) / 1000);
      throw new ApolloError(
        `OTP already sent to ${masked}. You can request a new one in ${wait}s.`,
        "LOGIN_OTP_REQUIRED",
        { maskedEmail: masked, resendIn: wait }
      );
    }

    // The customer app / website OTP boxes take 4 digits (same as the
    // registration OTP); the billing panel uses 6.
    const code = kind === "party"
      ? String(crypto.randomInt(1000, 10000))
      : String(crypto.randomInt(100000, 1000000));
    await LoginOtp.findOneAndUpdate(
      { kind, userId },
      { otpHash: hash(code), otpExpiry: new Date(now + OTP_TTL_MS), lastSentAt: new Date(now), attempts: 0, sentTo: String(email).toLowerCase() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Fire-and-forget: the SMTP round trip (connect + TLS + auth + send) takes
    // a few seconds, and the login screen shouldn't sit on "Please wait…" for
    // it. The OTP box appears at once; the mail follows in the background. If
    // it fails, it is logged and the user can tap Resend OTP.
    sendLoginOtpEmail(email, code, businessName || "", kind === "party")
      .then((sent) => { if (!sent) console.log(`[LOGIN OTP] ${kind} ${email} | OTP: ${code}`); })
      .catch(() => console.log(`[LOGIN OTP] ${kind} ${email} | OTP: ${code}`));

    throw new ApolloError(`OTP sent to ${masked}. Enter it to log in.`, "LOGIN_OTP_REQUIRED", {
      maskedEmail: masked,
      resendIn: Math.ceil(RESEND_GAP_MS / 1000),
    });
  }

  // ── Step 2: verify ────────────────────────────────────────────────────────
  if (!row || row.otpExpiry.getTime() <= now) {
    throw new ApolloError("OTP has expired. Tap Resend OTP to get a new one.", "LOGIN_OTP_INVALID");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await LoginOtp.deleteOne({ _id: row._id });
    throw new ApolloError("Too many wrong attempts. Tap Resend OTP to get a new one.", "LOGIN_OTP_INVALID");
  }
  if (row.sentTo && row.sentTo !== String(email).toLowerCase()) {
    throw new ApolloError("This OTP was sent to a different email. Tap Resend OTP.", "LOGIN_OTP_INVALID");
  }
  if (hash(otp) !== row.otpHash) {
    row.attempts += 1;
    await row.save();
    throw new ApolloError("Incorrect OTP. Please check your email and try again.", "LOGIN_OTP_INVALID");
  }

  await LoginOtp.deleteOne({ _id: row._id }); // one-time use
};
