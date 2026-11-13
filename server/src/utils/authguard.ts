import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import { resolveTenant, TenantError } from "./tenant";

// Callable without a login: sign-in, sign-up and storefront reads.
const PUBLIC = new Set([
  "loginAdmin", "loginBranch", "loginStaff", "loginStaffByMobile", "loginParty",
  "loginEmailOtp", "partyLoginEmailOtp", "sendOTP", "verifyOTP", "registerAccount",
  "confirmSubscription", "verifyToken",
  "getStorefrontByStoreSlug", "getAdminByCode", "getAdminById", "getAdminSettings",
  "getBranches", "getProductServices", "getCategories", "getChargeRules", "getChannels",
  "resolvePrice", "reverseGeocode", "isAnnouncementsEnabled",
]);

// Platform owner only (x-platform-key header).
const PLATFORM = new Set([
  "getAdminByEmail", "getDeletedAdmins", "getPendingSubscriptions",
  "createAdmin", "deleteAdmin", "resetAdmin", "approveSubscription", "rejectSubscription",
]);

// Mutations acting on one record by `id`: the record must belong to the caller's business.
const OWNED: Record<string, string> = {};
const own = (model: string, names: string[]) => names.forEach((n) => (OWNED[n] = model));
own("AccountGroup", ["editAccountGroup", "deleteAccountGroup", "resetAccountGroup"]);
own("AccountLedger", ["editAccountLedger", "deleteAccountLedger", "resetAccountLedger"]);
own("Account", ["editAccount", "deleteAccount", "resetAccount"]);
own("Branch", ["editBranch", "deleteBranch", "resetBranch"]);
own("Brand", ["editBrand", "deleteBrand", "resetBrand"]);
own("Category", ["editCategory", "deleteCategory", "resetCategory"]);
own("SubCategory", ["editSubCategory", "deleteSubCategory", "resetSubCategory"]);
own("Size", ["editSize", "deleteSize", "resetSize"]);
own("Model", ["editModel", "deleteModel", "resetModel"]);
own("ProductGroup", ["editProductGroup", "deleteProductGroup", "resetProductGroup"]);
own("Unit", ["editUnit", "deleteUnit", "resetUnit"]);
own("Channel", ["updateChannel", "deleteChannel", "resetChannel"]);
own("ChargeRule", ["editChargeRule", "deleteChargeRule", "resetChargeRule"]);
own("ExpenseNote", ["editExpenseNote", "deleteExpenseNote", "resetExpenseNote"]);
own("Payment", ["editPayment", "deletePayment", "reallocatePayment", "resetPayment"]);
own("PriceList", ["updatePriceList", "deletePriceList", "resetPriceList"]);
own("PriceAssignment", ["updatePriceAssignment", "deletePriceAssignment", "resetPriceAssignment"]);
own("PurchaseInvoice", ["editPurchaseInvoice", "deletePurchaseInvoice", "resetPurchaseInvoice"]);
own("PurchaseOrder", ["editPurchaseOrder", "deletePurchaseOrder", "resetPurchaseOrder", "cancelPurchaseOrder", "reopenPurchaseOrder"]);
own("PurchaseReturn", ["editPurchaseReturn", "deletePurchaseReturn", "resetPurchaseReturn"]);
own("SalesInvoice", ["editSalesInvoice", "deleteSalesInvoice", "resetSalesInvoice"]);
own("SalesOrder", ["editSalesOrder", "deleteSalesOrder", "resetSalesOrder"]);
own("SalesReturn", ["editSalesReturn", "deleteSalesReturn", "resetSalesReturn"]);
own("SalesRoute", ["updateSalesRoute", "deleteSalesRoute", "resetSalesRoute", "updateSalesRouteStatus"]);
own("StaffAccount", ["editStaffAccount", "deleteStaffAccount", "resetStaffAccount"]);
own("StockAdjustment", ["editStockAdjustment", "deleteStockAdjustment", "cancelStockAdjustment", "resetStockAdjustment"]);
own("Transaction", ["editTransaction", "deleteTransaction", "resetTransaction"]);
own("TransferStock", ["editTransferStock", "deleteTransferStock", "resetTransferStock"]);
own("Visit", ["editVisit", "deleteVisit"]);

// Fields that take the business id as an argument instead of a record id.
const ADMIN_ARG: Record<string, string> = {
  updateAdminSettings: "adminid", testBusinessSmtp: "adminid",
};

const denied = (msg = "You do not have access to this record.") => new TenantError(msg, "FORBIDDEN");

export const isPlatform = (context: any): boolean => {
  const want = String(process.env.PLATFORM_KEY || "");
  const got = String(context?.req?.headers?.["x-platform-key"] || "");
  if (!want || !got || want.length !== got.length) return false;
  return crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
};

const callerAdminId = async (context: any): Promise<Types.ObjectId> =>
  (await resolveTenant({ ...context, branchid: null }, {})).adminid;

const ownerOf = async (modelName: string, id: any): Promise<string | undefined> => {
  if (!Types.ObjectId.isValid(String(id))) return undefined; // offline temp ids are checked once synced
  let model: any;
  try { model = mongoose.model(modelName); } catch { return undefined; }
  const key = model.schema.path("adminid") ? "adminid" : model.schema.path("admin") ? "admin" : "";
  if (!key) return undefined;
  const doc: any = await model.findById(id).select(key).lean();
  return doc?.[key] ? String(doc[key]) : undefined; // old rows without an owner are left to the resolver
};

const checkPermissionsScope = async (context: any, args: any, admin: Types.ObjectId, write: boolean) => {
  const { scope, scopeid } = args || {};
  if (scope === "admin") {
    if (String(scopeid) !== String(admin)) throw denied();
    if (write && context.user?.type !== "admin") throw denied("Only the business owner can change business-wide permissions.");
    return;
  }
  const model = scope === "branch" ? "Branch" : scope === "staff" ? "StaffAccount" : "";
  if (!model) return;
  const owner = await ownerOf(model, scopeid);
  if (owner !== undefined && owner !== String(admin)) throw denied();
};

/** Runs before every Query / Mutation field. */
const check = async (field: string, args: any, context: any) => {
  if (PUBLIC.has(field)) return;
  const platform = isPlatform(context);
  if (PLATFORM.has(field)) {
    if (!platform) throw denied("This action is for the platform owner only.");
    return;
  }
  if (platform && (field === "getAdmins" || field === "updateAdminById")) return;
  if (!context?.user) throw new TenantError("Please sign in again.", "UNAUTHENTICATED");

  if (field === "getAdmins") {
    args.adminId = String(await callerAdminId(context)); // a business only sees itself
    return;
  }
  if (field === "updateAdminById") {
    if (context.user.type !== "admin" || String(args?.id) !== String(context.user.id)) throw denied();
    return;
  }

  if (OWNED[field] && args?.id != null) {
    const owner = await ownerOf(OWNED[field], args.id);
    if (owner !== undefined && owner !== String(await callerAdminId(context))) throw denied();
    return;
  }
  if (ADMIN_ARG[field]) {
    const asked = args?.[ADMIN_ARG[field]];
    if (asked && String(asked) !== String(await callerAdminId(context))) throw denied();
    return;
  }
  if (field === "setPermissions" || field === "getPermissions" || field === "getEffectivePermissions") {
    await checkPermissionsScope(context, args, await callerAdminId(context), field === "setPermissions");
  }
};

const wrapMap = (map: any) => {
  if (!map) return map;
  const out: any = {};
  for (const [field, fn] of Object.entries(map)) {
    out[field] = typeof fn === "function"
      ? async (parent: any, args: any, context: any, info: any) => {
          await check(field, args || {}, context);
          return (fn as any)(parent, args, context, info);
        }
      : fn;
  }
  return out;
};

/** Login and tenant check in one place, so no resolver can be missed. */
export const guardResolvers = (list: any[]) =>
  list.map((r) => (r ? { ...r, Query: wrapMap(r.Query), Mutation: wrapMap(r.Mutation) } : r));

const blank = () => "";

// Passwords are never sent back (types keep `password` so old clients still parse).
export const hidePasswords = {
  Admin: { password: blank },
  Branch: { password: blank },
  StaffAccount: { password: blank },
};
