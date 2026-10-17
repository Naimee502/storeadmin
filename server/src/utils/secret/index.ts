import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Reversible encryption for secrets we must read back later (a business's own
// SMTP mailbox password). AES-256-GCM; the key comes from SECRET_ENC_KEY, or
// JWT_ACCESS_SECRET when that is not set. Changing that key makes values saved
// before it unreadable — the business then re-enters the password once.
// Stored form: "v1:<iv b64>:<tag b64>:<cipher b64>".
// ─────────────────────────────────────────────────────────────────────────────

const key = () =>
  crypto
    .createHash("sha256")
    .update(String(process.env.SECRET_ENC_KEY || process.env.JWT_ACCESS_SECRET || "rudra-default-secret"))
    .digest();

export const encryptSecret = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
};

/** Returns "" when the value is missing or can't be decrypted (wrong key). */
export const decryptSecret = (stored?: string | null): string => {
  if (!stored) return "";
  try {
    const [v, iv, tag, data] = String(stored).split(":");
    if (v !== "v1") return "";
    const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch {
    return "";
  }
};
