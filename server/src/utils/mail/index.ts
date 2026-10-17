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

/**
 * Sender for one mail. The ADDRESS always stays the mailbox we log in with
 * (SMTP_USER / MAIL_FROM) — Hostinger refuses any other — but the display NAME
 * can be the business the mail is about, so an RKN customer sees
 * "RKN <info@…>" and a Powergold customer "Powergold Agro Product <info@…>".
 */
const buildFrom = (fromName?: string, mailbox?: string) => {
  const configured = mailbox || process.env.MAIL_FROM || process.env.SMTP_USER || "";
  if (!fromName) return configured;
  const address = configured.match(/<([^>]+)>/)?.[1] || configured.trim();
  const safeName = fromName.replace(/["\r\n<>]/g, "").trim();
  return safeName ? `"${safeName}" <${address}>` : configured;
};

// ── Per-business mailbox (Business Settings -> Email (SMTP)) ────────────────
// A business that saved its own mailbox (veer@dkmarketing.co.in) gets its OTP
// mails sent FROM that mailbox. One pooled transporter per business, rebuilt
// when its settings change. Anything missing -> the platform mailbox above.
type BizMailer = { sig: string; user: string; t: nodemailer.Transporter<any> };
const bizMailers = new Map<string, BizMailer>();

export type SmtpConfig = { host: string; port: number; user: string; pass: string };

const makeTransport = (c: SmtpConfig) =>
  nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.port === 465,
    auth: { user: c.user, pass: c.pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
  });

/** The business's saved SMTP settings, or null when not (fully) set. */
export const getBusinessSmtp = async (adminId: any): Promise<SmtpConfig | null> => {
  const ref = adminId?._id ?? adminId;
  if (!ref) return null;
  // Lazy import: models import nothing from here, but keep the mail util
  // loadable on its own (scripts, tests).
  const { AdminSettings } = await import("../../models/adminsettings");
  const { decryptSecret } = await import("../secret");
  const s: any = await AdminSettings.findOne({ adminid: ref })
    .select("smtpHost smtpPort smtpUser smtpPassEnc")
    .lean();
  const pass = decryptSecret(s?.smtpPassEnc);
  if (!s?.smtpHost || !s?.smtpUser || !pass) return null;
  return { host: s.smtpHost, port: Number(s.smtpPort) || 465, user: s.smtpUser, pass };
};

const getBusinessMailer = async (adminId: any): Promise<BizMailer | null> => {
  const ref = String(adminId?._id ?? adminId ?? "");
  if (!ref) return null;
  const c = await getBusinessSmtp(ref);
  const old = bizMailers.get(ref);
  if (!c) {
    if (old) { old.t.close(); bizMailers.delete(ref); }
    return null;
  }
  const sig = `${c.host}|${c.port}|${c.user}|${c.pass}`;
  if (old && old.sig === sig) return old;
  if (old) old.t.close();
  const m = { sig, user: c.user, t: makeTransport(c) };
  bizMailers.set(ref, m);
  return m;
};

/** Forget a business's cached mailbox (called when its settings are saved). */
export const clearBusinessMailer = (adminId: any) => {
  const ref = String(adminId?._id ?? adminId ?? "");
  const old = bizMailers.get(ref);
  if (old) { old.t.close(); bizMailers.delete(ref); }
};

/**
 * Send a test mail through the given settings (not the cached ones), so the
 * panel can show the real SMTP error — wrong password, wrong port, … .
 * Returns "" on success, otherwise the error message.
 */
export const sendTestMail = async (c: SmtpConfig, to: string, business: string) => {
  const t = makeTransport({ ...c });
  try {
    await t.sendMail({
      from: buildFrom(business, c.user),
      to,
      subject: `Test mail from ${business || "your store"}`,
      text:
        `This is a test mail from ${business || "your store"}.\n` +
        `Your OTP mails will now be sent from ${c.user}.`,
    });
    return "";
  } catch (e: any) {
    return String(e?.message || e || "Sending failed");
  } finally {
    t.close();
  }
};

/**
 * Returns true when the mail was handed to an SMTP server. Never throws.
 * With `adminId`, the business's own mailbox is tried first; if that is not
 * set or fails, the platform mailbox sends it so the OTP still arrives.
 */
export const sendMail = async (msg: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromName?: string;
  adminId?: any;
}) => {
  if (msg.adminId) {
    try {
      const m = await getBusinessMailer(msg.adminId);
      if (m) {
        await m.t.sendMail({
          from: buildFrom(msg.fromName, m.user),
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        });
        return true;
      }
    } catch (e: any) {
      console.error(`[mail] business mailbox failed (admin ${msg.adminId}), using platform mailbox:`, e?.message || e);
    }
  }

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
export const sendOtpEmail = async (to: string, otp: string, business: string, adminId?: any) => {
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
  return sendMail({ to, subject: `${otp} is your ${name} registration OTP`, text, html, fromName: business, adminId });
};

/** The billing-panel login OTP email (Business Settings -> login email OTP). */
// `forParty`: the customer app / website login — no password there, so the
// mail doesn't talk about the billing panel or changing a password.
export const sendLoginOtpEmail = async (to: string, otp: string, business: string, forParty = false, adminId?: any) => {
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
  return sendMail({ to, subject: `${otp} is your ${name} login OTP`, text, html, fromName: business, adminId });
};
