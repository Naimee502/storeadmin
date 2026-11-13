import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import { resolveTenant, TenantError } from "./tenant";
import { isActionAllowed } from "./permissiongate";
import { effectiveFormPermissions, fieldOn } from "./formpermissions";

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
own("StockAdjustment", ["updateStockAdjustment", "deleteStockAdjustment", "cancelStockAdjustment", "resetStockAdjustment"]);
own("Transaction", ["editTransaction", "deleteTransaction", "resetTransaction"]);
own("TransferStock", ["editTransferStock", "deleteTransferStock", "resetTransferStock"]);
own("Visit", ["editVisit", "deleteVisit"]);

// Admin-panel mutations checked against the login's module permissions (the app's own calls are not listed).
const ACTION: Record<string, [string, string]> = {};
const act = (module: string, pairs: Record<string, string>) =>
  Object.entries(pairs).forEach(([field, action]) => (ACTION[field] = [module, action]));
const crud = (module: string, add: string, edit: string, del: string, reset: string) =>
  act(module, { [add]: "add", [edit]: "edit", [del]: "delete", [reset]: "reset" });
crud("categories", "addCategory", "editCategory", "deleteCategory", "resetCategory");
crud("subcategories", "addSubCategory", "editSubCategory", "deleteSubCategory", "resetSubCategory");
act("categories", { reorderCategories: "rearrange" });
act("subcategories", { reorderSubCategories: "rearrange" });
crud("brands", "addBrand", "editBrand", "deleteBrand", "resetBrand");
crud("models", "addModel", "editModel", "deleteModel", "resetModel");
crud("productgroups", "addProductGroup", "editProductGroup", "deleteProductGroup", "resetProductGroup");
crud("sizes", "addSize", "editSize", "deleteSize", "resetSize");
crud("units", "addUnit", "editUnit", "deleteUnit", "resetUnit");
crud("accountgroups", "addAccountGroup", "editAccountGroup", "deleteAccountGroup", "resetAccountGroup");
crud("accountledgers", "addAccountLedger", "editAccountLedger", "deleteAccountLedger", "resetAccountLedger");
crud("staffaccounts", "addStaffAccount", "editStaffAccount", "deleteStaffAccount", "resetStaffAccount");
crud("branches", "addBranch", "editBranch", "deleteBranch", "resetBranch");
act("branches", { addBranches: "add" });
act("accounts", { deleteAccount: "delete", resetAccount: "reset" });
crud("transferstock", "addTransferStock", "editTransferStock", "deleteTransferStock", "resetTransferStock");
crud("stockadjustments", "createStockAdjustment", "updateStockAdjustment", "deleteStockAdjustment", "resetStockAdjustment");
act("stockadjustments", { cancelStockAdjustment: "edit" });
crud("purchaseorder", "addPurchaseOrder", "editPurchaseOrder", "deletePurchaseOrder", "resetPurchaseOrder");
act("purchaseorder", { cancelPurchaseOrder: "cancel", reopenPurchaseOrder: "cancel", confirmPurchaseOrder: "edit", markPurchaseOrderReceived: "edit" });
crud("purchaseinvoice", "addPurchaseInvoice", "editPurchaseInvoice", "deletePurchaseInvoice", "resetPurchaseInvoice");
act("purchaseinvoice", { cancelPurchaseInvoice: "edit", reopenPurchaseInvoice: "edit", convertPurchaseOrderToInvoice: "add" });
crud("purchasereturn", "addPurchaseReturn", "editPurchaseReturn", "deletePurchaseReturn", "resetPurchaseReturn");
act("salesinvoice", { deleteSalesInvoice: "delete", resetSalesInvoice: "reset" });
act("salesreturn", { editSalesReturn: "edit", deleteSalesReturn: "delete", resetSalesReturn: "reset" });
act("salesorder", { resetSalesOrder: "reset" });
act("payments", { editPayment: "edit", deletePayment: "delete", resetPayment: "reset", reallocatePayment: "edit" });
act("transactions", { editTransaction: "edit", deleteTransaction: "delete", resetTransaction: "reset" });
crud("channels", "createChannel", "updateChannel", "deleteChannel", "resetChannel");
act("salesroutes", { createSalesRoute: "add", deleteSalesRoute: "delete", resetSalesRoute: "reset", updateSalesRouteStatus: "edit" });
crud("pricelists", "createPriceList", "updatePriceList", "deletePriceList", "resetPriceList");
crud("priceassignments", "createPriceAssignment", "updatePriceAssignment", "deletePriceAssignment", "resetPriceAssignment");
crud("chargerules", "addChargeRule", "editChargeRule", "deleteChargeRule", "resetChargeRule");
crud("expensenote", "addExpenseNote", "editExpenseNote", "deleteExpenseNote", "resetExpenseNote");

// Edit mutations of forms with field settings: a field switched off for Edit keeps its saved value.
const FORM_EDIT: Record<string, string> = {
  editSalesInvoice: "salesinvoice", editPurchaseInvoice: "purchaseinvoice", editSalesOrder: "salesorder",
  editPurchaseOrder: "purchaseorder", editDeliveryChallan: "deliverychallan", editSalesReturn: "salesreturn",
  editPurchaseReturn: "purchasereturn", updateProductService: "products", editExpenseNote: "expensenote",
  editTransaction: "transactions", editPayment: "payments", editQuotation: "quotations", editLead: "leads",
  updateService: "services", editAccount: "accounts", editStaffAccount: "staffaccounts",
};

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
  if (platform) return; // the platform owner manages every business (Business Settings, admin register)
  if (!context?.user) throw new TenantError("Please sign in again.", "UNAUTHENTICATED");

  if (field === "getAdmins") {
    args.adminId = String(await callerAdminId(context)); // a business only sees itself
    return;
  }
  if (field === "updateAdminById") {
    if (context.user.type !== "admin" || String(args?.id) !== String(context.user.id)) throw denied();
    return;
  }

  if (ACTION[field]) {
    const [module, action] = ACTION[field];
    const scope = await resolveTenant(context, { backofficeOnly: true });
    const where = {
      adminid: scope.adminid,
      branchid: scope.userType === "admin" ? undefined : scope.branchid,
      staffid: scope.userType === "staff" ? scope.userId : undefined,
    };
    if (!(await isActionAllowed(module, action, where))) {
      throw denied(`You do not have ${action} permission for this screen. Ask the business owner to allow it.`);
    }
  }

  if (FORM_EDIT[field] && args?.input && typeof args.input === "object") {
    const scope = await resolveTenant({ ...context, branchid: null }, {});
    if (scope.mode === "backoffice") {
      const perms = (await effectiveFormPermissions({ adminid: scope.adminid, userType: scope.userType, userId: scope.userId }))[FORM_EDIT[field]];
      if (perms) for (const key of Object.keys(args.input)) {
        if (key in perms && !fieldOn(perms, key, "edit")) delete args.input[key];
      }
    }
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
  list.map((r) => {
    if (!r) return r;
    const out = { ...r };
    // Only set keys a map really has: an `undefined` Query would wipe the merged one.
    if (r.Query) out.Query = wrapMap(r.Query);
    if (r.Mutation) out.Mutation = wrapMap(r.Mutation);
    return out;
  });

const blank = () => "";

// Passwords are never sent back (types keep `password` so old clients still parse).
export const hidePasswords = {
  Admin: { password: blank },
  Branch: { password: blank },
  StaffAccount: { password: blank },
};
