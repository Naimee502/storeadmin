import mongoose from "mongoose";
import { Admin } from "../models/admin";

/**
 * "Order-only mode" — a business that runs on orders and payment collection
 * alone and never issues an invoice.
 *
 * There is no separate setting for it: the admin expresses the intent by
 * switching the invoice module OFF, so `Admin.allowedmodules` is the single
 * source of truth (the order screens already read the same flag to show
 * "Confirmed" instead of "Convert to Invoice").
 *
 * It matters because an ORDER posts nothing — no stock, no ledger, no
 * receivable or payable — so no payment can ever be settled against it. The
 * order resolvers therefore create the invoice silently when the order moves
 * forward: the books stay correct while the user only ever sees the order.
 *
 * Memoised for a few seconds because it is asked once per ROW by list field
 * resolvers; without the cache every listing would run an Admin query per
 * order. Module toggles change about never, so a short TTL is plenty.
 */

const cache = new Map<string, { value: boolean; at: number }>();
const TTL_MS = 30_000;

const isModuleDisabled = async (adminid: any, moduleId: string): Promise<boolean> => {
  if (!adminid) return false;
  const key = `${String(adminid)}:${moduleId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const admin: any = await Admin.findById(adminid).select("allowedmodules").lean();
    const allowed = admin?.allowedmodules;
    // null / missing => every module on (the schema default), so invoicing is live.
    const value = Array.isArray(allowed)
      ? !allowed.some((m: string) => String(m).toLowerCase() === moduleId)
      : false;
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch (e) {
    // Never block a status change over this lookup — assume invoicing is on,
    // which is the behaviour the app had before order-only mode existed.
    return false;
  }
};

/** Sales side: the "salesinvoice" module is switched off for this admin. */
export const isSalesOrderOnlyMode = (adminid: any) =>
  isModuleDisabled(adminid, "salesinvoice");

/** Purchase side: the "purchaseinvoice" module is switched off for this admin. */
export const isPurchaseOrderOnlyMode = (adminid: any) =>
  isModuleDisabled(adminid, "purchaseinvoice");

/**
 * Read an id off a ref as GraphQL field resolvers see it. `formatOrder` /
 * `formatInvoice` spread the lean document, so a ref arrives either as a raw
 * ObjectId or as a `{ id: "..." }` object built by toSimpleRef, depending on
 * the populate list.
 *
 * The trap: on a raw ObjectId, `.id` is NOT undefined — BSON defines it as the
 * raw 12-byte Buffer. So the obvious `v?.id || v` hands a Buffer to findById,
 * which casts badly and throws; one failed field resolver makes Apollo drop the
 * WHOLE query result on the client. Only a STRING `id` means a populated ref.
 */
export const refId = (v: any): any => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (typeof v.id === "string") return v.id;
  if (v._id) return v._id;
  return v;
};

/** Back-compat alias — same Buffer-safe behaviour. */
export const adminIdOf = refId;
