import { Types } from "mongoose";
import { Branch } from "../../models/branches";
import { StaffAccount } from "../../models/staffaccounts";
import { Account } from "../../models/accounts";

/**
 * Tenant resolution.
 *
 * Background: the products module (and most master modules) used to take
 * `adminid` / `branchid` straight from the client payload and trust it. Any
 * logged-in user could swap that one value and read, write or delete another
 * business's catalogue. This helper makes the verified JWT the only source of
 * truth for back-office access.
 *
 * There are deliberately TWO access modes, because the storefront is a real
 * product requirement, not a loophole:
 *
 *   BACKOFFICE — user.type is 'admin' | 'branch' | 'staff'.
 *     adminid always comes from the token. Anything the client sent is
 *     discarded. branchid is validated to belong to that admin; branch and
 *     staff logins are pinned to their own branch and cannot pass another.
 *
 *   PUBLIC — no token, or a 'party' (customer) token.
 *     clientweb resolves a public store slug to an adminid and reads that
 *     business's catalogue without being logged in as them. That is allowed,
 *     but it is read-only, active-records-only, and cost-sensitive fields are
 *     stripped before the response leaves the server (see PUBLIC_HIDDEN_PATHS
 *     and stripSensitiveForPublic below).
 *
 * Every mutation must call requireBackofficeTenant(), which refuses PUBLIC.
 */

export type TenantMode = "backoffice" | "public";

export interface TenantScope {
  mode: TenantMode;
  /** Always set. For PUBLIC this is the storefront's admin. */
  adminid: Types.ObjectId;
  /** Undefined when the caller did not scope to a branch. */
  branchid?: Types.ObjectId;
  userType: "admin" | "branch" | "staff" | "party" | "anonymous";
  userId?: Types.ObjectId;
  /** True when the user cannot choose a branch (branch + staff logins). */
  branchPinned: boolean;
}

export class TenantError extends Error {
  extensions: { code: string };
  constructor(message: string, code = "FORBIDDEN") {
    super(message);
    this.name = "TenantError";
    this.extensions = { code };
  }
}

/* ------------------------------------------------------------------ *
 * Legacy-token lookup cache
 *
 * Access tokens are signed for 7 days and older ones carry only
 * { id, email, type } — no adminid. Rather than hitting Mongo on every
 * single request for those sessions, resolved owners are cached briefly.
 * New logins carry adminid in the token and skip this entirely.
 * ------------------------------------------------------------------ */

const OWNER_CACHE_TTL_MS = 5 * 60 * 1000;
const ownerCache = new Map<string, { adminid: string; branchid?: string; at: number }>();

const cacheGet = (key: string) => {
  const hit = ownerCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > OWNER_CACHE_TTL_MS) {
    ownerCache.delete(key);
    return null;
  }
  return hit;
};

const cacheSet = (key: string, value: { adminid: string; branchid?: string }) => {
  // Bounded so a long-running process can't grow this without limit.
  if (ownerCache.size > 5000) ownerCache.clear();
  ownerCache.set(key, { ...value, at: Date.now() });
};

/** Drop a user's cached owner — call after a login or an owner change. */
export const invalidateTenantCache = (userType: string, userId: string) => {
  ownerCache.delete(`${userType}:${userId}`);
};

const toObjectId = (value: any): Types.ObjectId | undefined => {
  if (!value) return undefined;
  const raw = typeof value === "object" && value._id ? value._id : value;
  const str = String(raw);
  return Types.ObjectId.isValid(str) ? new Types.ObjectId(str) : undefined;
};

/** Resolve which admin owns a branch / staff / party login. */
const lookupOwner = async (
  type: string,
  userId: string
): Promise<{ adminid?: string; branchid?: string }> => {
  const key = `${type}:${userId}`;
  const cached = cacheGet(key);
  if (cached) return { adminid: cached.adminid, branchid: cached.branchid };

  let adminid: string | undefined;
  let branchid: string | undefined;

  if (type === "branch") {
    const branch: any = await Branch.findById(userId).select("admin").lean();
    adminid = branch?.admin ? String(branch.admin) : undefined;
    branchid = userId; // a branch login is its own branch
  } else if (type === "staff") {
    const staff: any = await StaffAccount.findById(userId).select("admin branchid").lean();
    adminid = staff?.admin ? String(staff.admin) : undefined;
    branchid = staff?.branchid ? String(staff.branchid) : undefined;
  } else if (type === "party") {
    const account: any = await Account.findById(userId).select("admin branchid").lean();
    adminid = account?.admin ? String(account.admin) : undefined;
    branchid = account?.branchid ? String(account.branchid) : undefined;
  }

  if (adminid) cacheSet(key, { adminid, branchid });
  return { adminid, branchid };
};

export interface ResolveTenantOptions {
  /**
   * adminid the caller asked for. Ignored entirely for BACKOFFICE callers.
   * For PUBLIC callers this is the storefront being browsed, and is required.
   */
  requestedAdminId?: string | null;
  /** branchid the caller asked for (filter argument or x-branch-id header). */
  requestedBranchId?: string | null;
  /** Refuse PUBLIC access outright. Every mutation sets this. */
  backofficeOnly?: boolean;
}

export const resolveTenant = async (
  context: any,
  options: ResolveTenantOptions = {}
): Promise<TenantScope> => {
  const { requestedAdminId, requestedBranchId, backofficeOnly } = options;
  const user = context?.user;
  const headerBranchId = context?.branchid;
  const askedBranchId = requestedBranchId || headerBranchId || null;

  const type: string = user?.type || "anonymous";
  const isBackoffice = type === "admin" || type === "branch" || type === "staff";

  /* ---------------- PUBLIC ---------------- */
  if (!isBackoffice) {
    if (backofficeOnly) {
      throw new TenantError(
        "You must be signed in to your business account to perform this action.",
        "UNAUTHENTICATED"
      );
    }

    // A party (customer) login is still scoped to the business that owns it —
    // it can't be used to browse a different business's catalogue.
    let adminid = toObjectId(requestedAdminId);
    let branchPinnedId: Types.ObjectId | undefined;

    if (type === "party" && user?.id) {
      const owner = user.adminid
        ? { adminid: String(user.adminid), branchid: user.branchid ? String(user.branchid) : undefined }
        : await lookupOwner("party", String(user.id));
      const ownerAdminId = toObjectId(owner.adminid);
      if (!ownerAdminId) {
        throw new TenantError("This customer account is not linked to a business.");
      }
      if (adminid && !adminid.equals(ownerAdminId)) {
        throw new TenantError("This account cannot access another business's catalogue.");
      }
      adminid = ownerAdminId;
      branchPinnedId = toObjectId(owner.branchid);
    }

    if (!adminid) {
      throw new TenantError("A store must be specified.", "BAD_USER_INPUT");
    }

    return {
      mode: "public",
      adminid,
      branchid: branchPinnedId ?? toObjectId(askedBranchId),
      userType: (type as TenantScope["userType"]) || "anonymous",
      userId: toObjectId(user?.id),
      branchPinned: !!branchPinnedId,
    };
  }

  /* ---------------- BACKOFFICE ---------------- */
  const userId = toObjectId(user?.id);
  if (!userId) {
    throw new TenantError("Your session has expired. Please sign in again.", "UNAUTHENTICATED");
  }

  let adminid: Types.ObjectId | undefined;
  let pinnedBranchId: Types.ObjectId | undefined;

  if (type === "admin") {
    adminid = userId;
  } else {
    // Prefer the token payload (new logins); fall back to a cached lookup for
    // the 7-day tokens issued before adminid was added to the JWT.
    const fromToken = user?.adminid
      ? { adminid: String(user.adminid), branchid: user.branchid ? String(user.branchid) : undefined }
      : await lookupOwner(type, String(user.id));

    adminid = toObjectId(fromToken.adminid);
    pinnedBranchId = toObjectId(fromToken.branchid);

    if (!adminid) {
      throw new TenantError("This login is not linked to a business. Please sign in again.");
    }
  }

  // Branch resolution.
  let branchid: Types.ObjectId | undefined;

  if (pinnedBranchId) {
    // Branch and staff logins work in their own branch only. A different
    // branchid in the request is a mismatch, not a preference.
    const asked = toObjectId(askedBranchId);
    if (asked && !asked.equals(pinnedBranchId)) {
      throw new TenantError("You do not have access to that branch.");
    }
    branchid = pinnedBranchId;
  } else {
    // Admins genuinely switch branches from the header dropdown, so the
    // requested branch is honoured — after confirming they own it.
    const asked = toObjectId(askedBranchId);
    if (asked) {
      const owned = await Branch.exists({ _id: asked, admin: adminid });
      if (!owned) throw new TenantError("You do not have access to that branch.");
      branchid = asked;
    }
  }

  return {
    mode: "backoffice",
    adminid: adminid!,
    branchid,
    userType: type as TenantScope["userType"],
    userId,
    branchPinned: !!pinnedBranchId,
  };
};

/** Shorthand for mutations: resolves and refuses anything but a back-office login. */
export const requireBackofficeTenant = (context: any, options: ResolveTenantOptions = {}) =>
  resolveTenant(context, { ...options, backofficeOnly: true });

/**
 * Confirm a referenced document belongs to this tenant before it is written.
 *
 * Used on every category / brand / unit / ledger id that arrives from a
 * client payload or an imported spreadsheet — otherwise someone can hand-edit
 * a hidden ID column and point a product at another business's master data.
 */
export const assertOwnedIds = async (
  model: any,
  ids: (string | Types.ObjectId | null | undefined)[],
  adminid: Types.ObjectId,
  label: string,
  adminField = "admin"
): Promise<void> => {
  const unique = Array.from(
    new Set(ids.filter(Boolean).map((id) => String(id)))
  ).filter((id) => Types.ObjectId.isValid(id));

  if (!unique.length) return;

  const found = await model
    .find({ _id: { $in: unique }, [adminField]: adminid })
    .select("_id")
    .lean();

  if (found.length !== unique.length) {
    const ok = new Set(found.map((d: any) => String(d._id)));
    const bad = unique.filter((id) => !ok.has(id));
    throw new TenantError(
      `${label} not found for this business: ${bad.join(", ")}`,
      "BAD_USER_INPUT"
    );
  }
};

/**
 * Cost-sensitive paths removed from PUBLIC (storefront) responses. A shopper
 * browsing a store should never see what the owner paid, what stock is worth,
 * or the serial numbers on the shelf.
 */
export const PUBLIC_HIDDEN_VARIANT_FIELDS = [
  "purchaserate",
  "openingstock",
  "openingstockamount",
  "currentstockamount",
  "closingstock",
  "closingstockamount",
  "minimumstock",
  "reorderlevel",
  "racklocation",
  "serials",
] as const;

/** Strip cost/stock internals from a product before returning it publicly. */
export const stripSensitiveForPublic = (product: any) => {
  if (!product) return product;
  const variants = Array.isArray(product.productvariants) ? product.productvariants : [];
  return {
    ...product,
    productvariants: variants.map((variant: any) => {
      const clean: any = { ...variant };
      for (const field of PUBLIC_HIDDEN_VARIANT_FIELDS) delete clean[field];
      if (Array.isArray(clean.unitprices)) {
        clean.unitprices = clean.unitprices.map((price: any) => {
          const { minsalesrate, ...rest } = price || {};
          return rest;
        });
      }
      return clean;
    }),
  };
};
