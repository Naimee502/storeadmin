import nodemailer from "nodemailer";

// ─────────────────────────────────────────────────────────────────────────────
// Outgoing email (registration OTP) over plain SMTP — Hostinger mailbox today,
// any other SMTP provider tomorrow by changing env values only:
//
//   SMTP_HOST=smtp.hostinger.com
//   SMTP_PORT=465                      (465 = SSL, 587 = STARTTLS)
//   SMTP_USER=noreply@digisysindiatech.com
//   SMTP_PASS=<mailbox password>
//   MAIL_FROM="Rudra ERP <noreply@digisysindiatech.com>"   (optional; the name is only
//             a fallback — OTP mails use the business name, see buildFrom)
//
// Local dev: server/.env   ·   Production: ecosystem.config.js → env
// Without SMTP_HOST/USER/PASS nothing is sent and the mail is only logged to
// the server console — handy in dev, where the OTP shows up there instead.
// ─────────────────────────────────────────────────────────────────────────────

let transporter: nodemailer.Transporter<any> | null | undefined; // undefined = not built yet

const getTransporter = () => {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("[mail] SMTP not configured — emails will only be logged to the console.");
    transporter = null;
    return transporter;
  }
  const port = Number(SMTP_PORT) || 465;
  // Pooled: keeps the SMTP connection open and reuses it, so a mail doesn't
  // pay a fresh connect + TLS + login every time (that handshake was most of
  // the wait for an OTP mail).
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });
  console.log(`[mail] SMTP enabled via ${SMTP_HOST}:${port} as ${SMTP_USER}`);
  return transporter;
};

/** Open the SMTP connection at server start so the first OTP mail is quick too. */
export const warmUpMail = () => {
  const t = getTransporter();
  if (!t) return;
  t.verify()
    .then(() => console.log("[mail] SMTP connection ready"))
    .catch((e: any) => console.error("[mail] SMTP verify failed:", e?.message || e));
};

/** Returns true when the mail was handed to the SMTP server. Never throws. */
/**
 * Sender for one mail. The ADDRESS always stays the mailbox we log in with
 * (SMTP_USER / MAIL_FROM) — Hostinger refuses any other — but the display NAME
 * can be the business the mail is about, so an RKN customer sees
 * "RKN <info@…>" and a Powergold customer "Powergold Agro Product <info@…>".
 */
const buildFrom = (fromName?: string) => {
  const configured = process.env.MAIL_FROM || process.env.SMTP_USER || "";
  if (!fromName) return configured;
  const address = configured.match(/<([^>]+)>/)?.[1] || configured.trim();
  const safeName = fromName.replace(/["\r\n<>]/g, "").trim();
  return safeName ? `"${safeName}" <${address}>` : configured;
};

export const sendMail = async (msg: { to: string; subject: string; text: string; html?: string; fromName?: string }) => {
  const t = getTransporter();
  if (!t) {
    console.log(`[mail] (not sent) to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    return false;
  }
  try {
    await t.sendMail({
      from: buildFrom(msg.fromName),
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return true;
  } catch (e: any) {
    console.error("[mail] send failed:", e?.message || e);
    return false;
  }
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/** The registration OTP email. `business` is the store's name (RKN, Rudra Enterprise, …). */
export const sendOtpEmail = async (to: string, otp: string, business: string) => {
  const name = business || "our store";
  const text =
    `${otp} is your OTP to complete your registration with ${name}.\n` +
    `It is valid for 10 minutes. Do not share it with anyone.`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1f2937">
    <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(name)}</h2>
    <p style="margin:0 0 16px;font-size:14px">Use this OTP to complete your registration:</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:12px 0">${otp}</div>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280">Valid for 10 minutes. Do not share it with anyone.
    If you did not try to register, you can ignore this email.</p>
  </div>`;
  return sendMail({ to, subject: `${otp} is your ${name} registration OTP`, text, html, fromName: business });
};

/** The billing-panel login OTP email (Business Settings -> login email OTP). */
// `forParty`: the customer app / website login — no password there, so the
// mail doesn't talk about the billing panel or changing a password.
export const sendLoginOtpEmail = async (to: string, otp: string, business: string, forParty = false) => {
  const name = business || (forParty ? "your store" : "Billing panel");
  const where = forParty ? "your account" : "the billing panel";
  const ignore = forParty
    ? "If you did not try to log in, you can ignore this email."
    : "If you did not try to log in, change your password.";
  const text =
    `${otp} is your OTP to log in to ${name}.\n` +
    `It is valid for 10 minutes. Do not share it with anyone.\n` +
    ignore;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1f2937">
    <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(name)}</h2>
    <p style="margin:0 0 16px;font-size:14px">Use this OTP to log in to ${where}:</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:12px 0">${otp}</div>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280">Valid for 10 minutes. Do not share it with anyone.
    ${escapeHtml(ignore)}</p>
  </div>`;
  return sendMail({ to, subject: `${otp} is your ${name} login OTP`, text, html, fromName: business });
};
