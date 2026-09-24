import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Firebase Cloud Messaging (HTTP v1) sender — no firebase-admin dependency.
//
// Credentials: the Firebase service-account JSON for project rudra-erp-26fe7
// (Firebase console → Project settings → Service accounts → Generate new
// private key). The server looks for it in this order:
//   1. FIREBASE_SERVICE_ACCOUNT        — the JSON itself, as an env var
//   2. FIREBASE_SERVICE_ACCOUNT_PATH   — path to the JSON file
//   3. server/firebase-service-account.json (gitignored)
// Without credentials push is skipped (logged once) and in-app notifications
// keep working exactly as before.
// ---------------------------------------------------------------------------

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

let serviceAccount: ServiceAccount | null | undefined; // undefined = not loaded yet
let cachedToken: { value: string; expiresAt: number } | null = null;

const loadServiceAccount = (): ServiceAccount | null => {
  if (serviceAccount !== undefined) return serviceAccount;
  try {
    let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      const file =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        path.resolve(__dirname, "../../../firebase-service-account.json");
      if (fs.existsSync(file)) raw = fs.readFileSync(file, "utf8");
    }
    if (!raw) {
      console.warn("[fcm] No Firebase service account configured — push notifications disabled.");
      serviceAccount = null;
      return null;
    }
    const parsed = JSON.parse(raw);
    serviceAccount = {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: String(parsed.private_key).replace(/\\n/g, "\n"),
    };
    console.log(`[fcm] Push enabled for Firebase project ${serviceAccount.project_id}`);
  } catch (e) {
    console.error("[fcm] Invalid Firebase service account:", e);
    serviceAccount = null;
  }
  return serviceAccount;
};

const getAccessToken = async (sa: ServiceAccount): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: "RS256" }
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body: any = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`OAuth token request failed: ${res.status} ${JSON.stringify(body)}`);
  }
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
};

export type PushResult = "sent" | "invalid-token" | "skipped" | "failed";

/**
 * Sends one push to one device. Never throws.
 * "invalid-token" means the token is dead (app uninstalled / re-installed) and
 * the caller should clear it.
 */
export const sendPushToToken = async (
  token: string,
  msg: { title: string; body?: string; data?: Record<string, any> }
): Promise<PushResult> => {
  const sa = loadServiceAccount();
  if (!sa || !token) return "skipped";

  // FCM data values must all be strings.
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(msg.data || {})) {
    if (v !== undefined && v !== null && v !== "") data[k] = String(v);
  }

  try {
    const accessToken = await getAccessToken(sa);
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            // A "notification" payload is what makes Android show it in the
            // status bar by itself when the app is in background / closed.
            notification: { title: msg.title, body: msg.body || "" },
            data,
            android: {
              priority: "HIGH",
              notification: {
                channel_id: "default", // created by the app (FirebaseManager)
                sound: "default",
              },
            },
            apns: { payload: { aps: { sound: "default" } } },
          },
        }),
      }
    );
    if (res.ok) return "sent";

    const err: any = await res.json().catch(() => ({}));
    const code = err?.error?.details?.find((d: any) => d.errorCode)?.errorCode || err?.error?.status;
    if (res.status === 404 || code === "UNREGISTERED") {
      return "invalid-token";
    }
    console.error("[fcm] send failed:", res.status, JSON.stringify(err));
    return "failed";
  } catch (e) {
    console.error("[fcm] send error:", e);
    return "failed";
  }
};
