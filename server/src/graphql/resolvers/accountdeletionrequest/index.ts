import { Types } from "mongoose";
import { Account } from "../../../models/accounts";
import { StaffAccount } from "../../../models/staffaccounts";
import { AccountDeletionRequest, IDeletionMatch } from "../../../models/accountdeletionrequest";
import { pushNotification } from "../../../models/notifications";
import { isCustomerParty } from "../../../utils/partytype";

/**
 * Public account deletion endpoint, behind /account-deletion.
 *
 * Three rules shape everything below.
 *
 * 1. The reply never changes. Registered or not, the caller is told the
 *    request was received. A page that answers "this number isn't
 *    registered" is a free lookup service for anyone who wants to know
 *    who shops here, and the number typed in is the only thing the page
 *    asks for. The true outcome goes on the request document instead.
 *
 * 2. Nothing is erased. Matched logins are switched to status:false —
 *    the same switch the admin panel's own delete throws — so the person
 *    can no longer sign in, while invoices, ledger entries and payments
 *    stay exactly where they are. Indian tax rules require those records
 *    to survive for years, and the public page says so in as many words.
 *    resetAccount puts a login back if a request was a mistake.
 *
 * 3. Only logins are touched. Vendor, bank and expense ledgers share the
 *    Account collection but never sign into the app, so switching one off
 *    because its phone number was typed here would break the back office
 *    for no one's benefit.
 */

/** Digits only, last ten — "+91 98765 43210" and "9876543210" are one number. */
const normalizeMobile = (raw: string): string => {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/**
 * Crude per-IP throttle. The endpoint takes no token and writes to the
 * database, so an open loop against it would otherwise be free. In-memory
 * is enough here: the server runs as a single pm2 process, and the worst
 * case of a restart is that a handful of counters reset.
 */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

const rateLimited = (ip: string): boolean => {
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // never let the map grow without bound
  return recent.length > RATE_LIMIT;
};

// Same words in every outcome — see rule 1 above.
const GENERIC_OK =
  "Your account deletion request has been submitted successfully. " +
  "Any login linked to this mobile number has been deactivated.";

export const accountDeletionResolvers = {
  Query: {
    getAccountDeletionRequests: async (
      _: any,
      { adminid, limit = 100 }: { adminid: string; limit?: number }
    ) => {
      if (!adminid || !Types.ObjectId.isValid(adminid)) return [];
      return AccountDeletionRequest.find({ "matched.adminid": new Types.ObjectId(adminid) })
        .sort({ createdAt: -1 })
        .limit(Math.min(limit ?? 100, 500))
        .lean();
    },
  },

  Mutation: {
    requestAccountDeletion: async (
      _: any,
      { mobile, name, reason }: { mobile: string; name?: string; reason?: string },
      context: any
    ) => {
      const mobileraw = String(mobile || "").trim();
      const normalized = normalizeMobile(mobileraw);

      // A format complaint gives nothing away — it is true of any ten
      // digits, registered or not — so it is safe to be specific here.
      if (normalized.length !== 10) {
        return { ok: false, message: "Please enter a valid 10-digit mobile number." };
      }

      const req = context?.req;
      const ip = String(
        req?.headers?.["x-forwarded-for"]?.toString().split(",")[0].trim() || req?.ip || ""
      );

      if (rateLimited(ip)) {
        return {
          ok: false,
          message: "Too many requests from this device. Please try again later.",
        };
      }

      // Matches a bare number, a 91-prefixed one and a +91-prefixed one.
      const tail = new RegExp(`${normalized}$`);
      const matched: IDeletionMatch[] = [];

      try {
        // --- Party logins ------------------------------------------------
        // status:true only: an already-deactivated login is nothing to do
        // again, and re-running it would inflate the count on the receipt.
        const parties = await Account.find({ mobile: tail, status: true })
          .select("_id name type admin")
          .lean();

        for (const p of parties as any[]) {
          if (!isCustomerParty(p.type)) continue; // rule 3
          matched.push({
            docmodel: "Account",
            docid: p._id,
            adminid: p.admin,
            name: p.name,
            role: "party",
          });
        }

        // --- Staff / salesman / delivery-boy logins ----------------------
        const staff = await StaffAccount.find({ mobile: tail, status: true })
          .select("_id name role admin")
          .lean();

        for (const s of staff as any[]) {
          matched.push({
            docmodel: "StaffAccount",
            docid: s._id,
            adminid: s.admin,
            name: s.name,
            role: s.role,
          });
        }

        // --- Deactivate --------------------------------------------------
        const partyIds = matched.filter((m) => m.docmodel === "Account").map((m) => m.docid);
        const staffIds = matched.filter((m) => m.docmodel === "StaffAccount").map((m) => m.docid);

        if (partyIds.length) {
          // The pending OTP goes with the login. Leaving a live one behind
          // would let whoever holds the phone walk straight back in.
          await Account.updateMany(
            { _id: { $in: partyIds } },
            { $set: { status: false, otp: null, otpExpiry: null } }
          );
        }

        if (staffIds.length) {
          // fcmtoken too, or the handset keeps receiving this business's
          // push notifications after the login is gone.
          await StaffAccount.updateMany(
            { _id: { $in: staffIds } },
            { $set: { status: false, fcmtoken: null } }
          );
        }

        // --- Record + tell the admin -------------------------------------
        await AccountDeletionRequest.create({
          mobile: normalized,
          mobileraw,
          name: String(name || "").trim(),
          reason: String(reason || "").trim(),
          source: "web",
          requeststatus: matched.length ? "completed" : "nomatch",
          deactivatedcount: matched.length,
          matched,
          ipaddress: ip,
          useragent: String(req?.headers?.["user-agent"] || ""),
        });

        // One notification per business, even when a number is linked to
        // several of that business's logins.
        const notified = new Set<string>();
        for (const m of matched) {
          const key = String(m.adminid);
          if (notified.has(key)) continue;
          notified.add(key);
          await pushNotification({
            adminid: m.adminid,
            targettype: "admin",
            ntype: "system",
            title: "Account deletion request",
            message:
              `${m.name || "A user"} (${normalized}) requested account deletion. ` +
              `The login has been deactivated — records are retained.`,
          });
        }
      } catch (err) {
        // The person is owed an answer either way. Swallowing this keeps a
        // database hiccup from looking, on a compliance page of all places,
        // like a refusal to act on the request.
        console.error("requestAccountDeletion failed:", err);
      }

      return { ok: true, message: GENERIC_OK };
    },
  },
};
