import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import { defaultFieldResolver, getNamedType, getNullableType, isInputObjectType, isListType, isNonNullType } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { resolveTenant, TenantError } from "./tenant";
import { Branch } from "../models/branches";
import { AdminSettings } from "../models/adminsettings";
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

// Login-free reads that carry one business's data. Signed-in callers get their own business;
// callers without a back-office login see only the fields the app and website ask for.
const TENANT_PUBLIC = new Set([
  "getBranches", "getAdminSettings", "getAdminByCode", "getAdminById", "getCategories",
  "getChargeRules", "getChannels", "resolvePrice",
]);
const ANON_FIELDS: Record<string, string[]> = {
  Admin: ["id", "name", "companyName", "email", "mobile", "admincode", "businesstype", "allowedmodules"],
  Branch: ["id", "branchname", "status"],
  Category: ["id", "categoryname", "image", "status"],
  Channel: ["id", "channelName", "handlesChannels", "isDefault", "status"],
  ChargeRule: [
    "id", "name", "active", "applyToCreatorTypes", "chargeType", "freeAboveValue", "gstpercent", "ledgerid",
    "minOrderValue", "onlyWhenDeliveryBoy", "paymentTypes", "priority", "value",
  ],
  AdminSettings: [
    "id", "allowProductImageDownload", "appCatalogBrowseMode", "appCategoryAutoScroll", "appProductAutoScroll",
    "appProductImageRatio", "attendanceSelfieRequired", "brandLogo", "deliveryMode", "displayProductPriceOnWebsite",
    "displayStockOnWebsite", "doubleDisplayPrice", "enablePaymentDiscountCommission", "geoFenceEnabled",
    "geoFenceRadiusM", "heroBannerSlides", "partyManagesDownline", "printShowPartyBalance", "privacyPolicyUrl",
    "promoBanners", "restrictQuantityByStock", "salesmanLeaderboardEnabled", "salesmanOrderDiscountEnabled",
    "secureScreenApp", "showPartyLiveLocation", "showWhatsappChat", "supportEmail", "supportPhone",
    "supportWhatsapp", "termsConditionsUrl", "themeBrandColor", "trackPartyStock",
  ],
};

// Sign-in fields with a failed-attempt limit per account and network address.
const LOGIN = new Set([
  "loginAdmin", "loginBranch", "loginStaff", "loginStaffByMobile", "loginParty", "verifyOTP",
]);
const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFails = new Map<string, { n: number; at: number }>();

const loginKey = (field: string, args: any, context: any) =>
  [field, args?.adminId || "", String(args?.email || args?.mobile || "").toLowerCase(), context?.req?.ip || ""].join(":");

const limitLogin = async (field: string, args: any, context: any, run: () => any) => {
  const key = loginKey(field, args, context);
  const hit = loginFails.get(key);
  if (hit && Date.now() - hit.at > LOGIN_WINDOW_MS) loginFails.delete(key);
  if ((loginFails.get(key)?.n || 0) >= LOGIN_MAX_FAILS) {
    throw new TenantError("Too many failed sign-in attempts. Please wait 15 minutes and try again.", "TOO_MANY_ATTEMPTS");
  }
  try {
    const result = await run();
    loginFails.delete(key);
    return result;
  } catch (e) {
    if (loginFails.size > 10000) loginFails.clear();
    const prev = loginFails.get(key);
    loginFails.set(key, { n: (prev?.n || 0) + 1, at: prev?.at || Date.now() });
    throw e;
  }
};

// Platform owner only (x-platform-key header).
const PLATFORM = new Set([
  "getAdminByEmail", "getDeletedAdmins", "getPendingSubscriptions",
  "createAdmin", "deleteAdmin", "resetAdmin", "approveSubscription", "rejectSubscription",
]);

// Fields acting on one record by `id`: the record must belong to the caller's business.
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
own("SalesInvoice", ["getSalesInvoiceById", "cancelSalesInvoice", "reopenSalesInvoice", "markSalesInvoiceDispatched", "markSalesInvoiceDelivered", "assignInvoiceDeliveryBoy", "saveInvoiceGstDetails"]);
own("SalesOrder", ["getSalesOrderById", "convertSalesOrderToInvoice", "cancelSalesOrder", "reopenSalesOrder", "confirmSalesOrder", "markSalesOrderDispatched", "markSalesOrderDelivered", "assignOrderDeliveryBoy"]);
own("PurchaseInvoice", ["getPurchaseInvoiceById", "cancelPurchaseInvoice", "reopenPurchaseInvoice"]);
own("PurchaseOrder", ["getPurchaseOrderById", "convertPurchaseOrderToInvoice", "confirmPurchaseOrder", "markPurchaseOrderReceived"]);
own("SalesReturn", ["getSalesReturnById"]);
own("PurchaseReturn", ["getPurchaseReturnById"]);
own("ProductService", ["getProductServiceById", "updateProductService", "deleteProductService", "resetProductService", "getServiceById", "updateService", "deleteService", "resetService"]);
own("Transaction", ["getTransactionById"]);
own("Payment", ["getPaymentById"]);
own("ExpenseNote", ["getExpenseNoteById"]);
own("ExpenseClaim", ["getExpenseClaimById", "editExpenseClaim", "cancelExpenseClaim", "approveExpenseClaim", "rejectExpenseClaim", "deleteExpenseClaim", "resetExpenseClaim"]);
own("Announcement", ["getAnnouncement", "getAnnouncementReaders", "editAnnouncement", "deleteAnnouncement", "resetAnnouncement", "markAnnouncementRead"]);
own("Attendance", ["getAttendanceLogById", "editAttendanceLog", "deleteAttendanceLog", "resetAttendanceLog", "deletePunch"]);
own("Holiday", ["getHolidayById", "editHoliday", "deleteHoliday", "resetHoliday"]);
own("LeaveType", ["getLeaveTypeById", "editLeaveType", "deleteLeaveType", "resetLeaveType"]);
own("LeaveRequest", ["getLeaveRequestById", "editLeaveRequest", "approveLeaveRequest", "rejectLeaveRequest", "cancelLeaveRequest", "deleteLeaveRequest", "resetLeaveRequest"]);
own("LeaveBalance", ["deleteLeaveBalance", "resetLeaveBalance"]);
own("Notification", ["markNotificationRead"]);
own("DeliveryChallan", ["getDeliveryChallanById", "editDeliveryChallan", "deleteDeliveryChallan", "resetDeliveryChallan", "markDeliveryChallanDelivered", "markDeliveryChallanReturned", "saveChallanEWayBill"]);
own("Lead", ["getLeadById", "editLead", "deleteLead", "resetLead", "setLeadStage", "convertLeadToParty", "aiDraftMessage"]);
own("Followup", ["getFollowupById", "editFollowup", "deleteFollowup", "resetFollowup", "completeFollowup"]);
own("Quotation", ["getQuotationById", "editQuotation", "deleteQuotation", "resetQuotation", "setQuotationStatus", "reviseQuotation"]);
own("Bom", ["getBomById", "editBom", "deleteBom", "resetBom"]);
own("WorkOrder", ["getWorkOrderById", "editWorkOrder", "setWorkOrderStatus", "deleteWorkOrder", "resetWorkOrder"]);
own("ProductionEntry", ["getProductionEntryById", "editProductionEntry", "deleteProductionEntry", "resetProductionEntry"]);
own("Appointment", ["getAppointmentById", "editAppointment", "setAppointmentStatus", "deleteAppointment", "resetAppointment"]);
own("JobCard", ["getJobCardById", "editJobCard", "setJobCardStatus", "deleteJobCard", "resetJobCard"]);
own("Contract", ["getContractById", "editContract", "deleteContract", "resetContract"]);
own("MembershipPlan", ["getMembershipPlanById", "editMembershipPlan", "deleteMembershipPlan", "resetMembershipPlan"]);
own("Membership", ["getMembershipById", "editMembership", "deleteMembership", "resetMembership"]);
own("Opportunity", ["setOpportunityState", "convertOpportunityToLead", "aiDraftForOpportunity"]);
own("Insight", ["setInsightState"]);
own("LeadInbox", ["retryLeadInbox"]);
own("Account", ["getAccountById", "approveAccount"]);
own("Branch", ["getBranch"]);
own("Category", ["getCategoryById"]);
own("SubCategory", ["getSubCategoryById"]);
own("Size", ["getSizeById"]);
own("Brand", ["getBrandById"]);
own("Model", ["getModelById"]);
own("ProductGroup", ["getProductGroupById"]);
own("AccountGroup", ["getAccountGroupById"]);
own("AccountLedger", ["getAccountLedgerById"]);
own("Unit", ["getUnitById"]);
own("StaffAccount", ["getStaffAccountById"]);
own("TransferStock", ["getTransferStockById"]);
own("StockAdjustment", ["getStockAdjustmentById"]);
own("SalesRoute", ["getSalesRouteById"]);
own("Channel", ["getChannelById"]);
own("PriceList", ["getPriceListById"]);
own("ChargeRule", ["getChargeRuleById"]);
// Fields whose record id arg is not named `id`.
const ID_ARG: Record<string, string> = { deletePunch: "logid", aiDraftMessage: "leadid" };

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
act("attendance", { approveLeaveRequest: "edit", rejectLeaveRequest: "edit" });

// Edit mutations of forms with field settings: a field switched off for Edit keeps its saved value.
const FORM_EDIT: Record<string, string> = {
  editSalesInvoice: "salesinvoice", editPurchaseInvoice: "purchaseinvoice", editSalesOrder: "salesorder",
  editPurchaseOrder: "purchaseorder", editDeliveryChallan: "deliverychallan", editSalesReturn: "salesreturn",
  editPurchaseReturn: "purchasereturn", updateProductService: "products", editExpenseNote: "expensenote",
  editTransaction: "transactions", editPayment: "payments", editQuotation: "quotations", editLead: "leads",
  updateService: "services", editAccount: "accounts", editStaffAccount: "staffaccounts",
  editAppointment: "appointments", editJobCard: "jobcards", editContract: "contracts", editMembership: "memberships",
  editBom: "bom", editWorkOrder: "workorders", editProductionEntry: "production", editBranch: "branches",
  updatePriceList: "pricelists", updateSalesRoute: "salesroutes", updateStockAdjustment: "stockadjustments",
  editTransferStock: "transferstock",
};

// Fields that take the business id as an argument instead of a record id.
const ADMIN_ARG: Record<string, string> = {
  updateAdminSettings: "adminid", testBusinessSmtp: "adminid",
};

const denied = (msg = "You do not have access to this record.") => new TenantError(msg, "FORBIDDEN");

// Saves that carry custom fields (Business Settings -> Custom Fields), by entity.
const CUSTOM_ENTITY: Record<string, string> = {
  addProductService: "product", updateProductService: "product", addLead: "lead", editLead: "lead",
  addAppointment: "appointment", editAppointment: "appointment", addJobCard: "jobcard", editJobCard: "jobcard",
  addContract: "contract", editContract: "contract",
};

// Same rules the forms apply, so an API call cannot save what the form would refuse.
const checkCustomFields = async (entity: string, values: any[], adminid: any) => {
  const st: any = await AdminSettings.findOne({ adminid }).select("customFieldDefs").lean();
  const defs = (st?.customFieldDefs || []).filter((d: any) => d.entity === entity);
  const bad = (msg: string) => new TenantError(msg, "BAD_USER_INPUT");
  for (const d of defs) {
    const v = String(values.find((x: any) => x?.key === d.key)?.value ?? "").trim();
    if (!v) {
      if (d.required) throw bad(`${d.label} is required.`);
      continue;
    }
    if (d.type === "number" && !Number.isFinite(Number(v))) throw bad(`${d.label} must be a number.`);
    if (d.type === "date" && isNaN(new Date(v).getTime())) throw bad(`${d.label} must be a date.`);
    if (d.type === "select" && (d.options || []).length && !d.options.includes(v)) throw bad(`${d.label}: choose one of the listed options.`);
  }
};

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
  if (!write || context.user?.type === "admin") return;
  // A branch login may set its own staff's permissions; nobody else below the owner may.
  const staff: any = scope === "staff" && context.user?.type === "branch" && Types.ObjectId.isValid(String(scopeid))
    ? await mongoose.model("StaffAccount").findById(scopeid).select("branchid").lean()
    : null;
  if (!staff || String(staff.branchid) !== String(context.user.id)) throw denied("Only the business owner can change these permissions.");
};

// Staff punch for themselves; punching for a colleague needs the attendance add permission.
const checkPunch = async (context: any, input: any) => {
  const me = context.user;
  if (me.type === "party") throw denied();
  if (me.type === "staff" && String(input.staffid || "") !== String(me.id)) {
    const scope = await resolveTenant(context, { backofficeOnly: true });
    const where = { adminid: scope.adminid, branchid: scope.branchid, staffid: scope.userId };
    if (!(await isActionAllowed("attendance", "add", where))) throw denied("You can punch only for yourself.");
  }
  const owner = await ownerOf("StaffAccount", input.staffid);
  if (owner !== undefined && owner !== String(await callerAdminId(context))) throw denied();
};

const TENANT_KEYS = ["adminid", "adminId", "admin"];
const isIdArg = (type: any) => ["ID", "String"].includes((getNamedType(type) as any)?.name);
const idValue = (type: any, id: string) => (isListType(getNullableType(type)) ? [id] : id);

// Every adminid / admin arg the schema declares is set to the login's business, sent or not.
// Returns the branchids sent in the inputs so a write can confirm they are this business's.
const scopeArgs = (info: any, args: any, adminid: string): string[] => {
  const branchids: string[] = [];
  const def = info?.parentType?.getFields?.()[info.fieldName];
  for (const arg of def?.args || []) {
    if (TENANT_KEYS.includes(arg.name) && isIdArg(arg.type)) {
      args[arg.name] = idValue(arg.type, adminid);
      continue;
    }
    const input = getNamedType(arg.type);
    if (!isInputObjectType(input)) continue;
    const fields = input.getFields();
    const keys = TENANT_KEYS.filter((k) => fields[k] && isIdArg(fields[k].type));
    if (!keys.length) continue;
    const many = isListType(getNullableType(arg.type));
    if (!many && !(args[arg.name] && typeof args[arg.name] === "object")) args[arg.name] = {};
    const values = many ? (Array.isArray(args[arg.name]) ? args[arg.name] : []) : [args[arg.name]];
    for (const value of values) {
      if (!value || typeof value !== "object") continue;
      for (const k of keys) value[k] = idValue(fields[k].type, adminid);
      if (fields.branchid && value.branchid) branchids.push(String(value.branchid));
    }
  }
  return branchids;
};

/** Runs before every Query / Mutation field. */
const check = async (field: string, args: any, context: any, info?: any) => {
  if (PUBLIC.has(field)) {
    if (TENANT_PUBLIC.has(field) && context?.user && !isPlatform(context)) {
      scopeArgs(info, args, String(await callerAdminId(context)));
    }
    return;
  }
  const platform = isPlatform(context);
  if (PLATFORM.has(field)) {
    if (!platform) throw denied("This action is for the platform owner only.");
    return;
  }
  if (platform) return; // the platform owner manages every business (Business Settings, admin register)
  if (!context?.user) throw new TenantError("Please sign in again.", "UNAUTHENTICATED");
  const op = info?.parentType?.name;
  if ((op === "Query" || op === "Mutation") && field !== "getAdmins") {
    const admin = await callerAdminId(context);
    const branchids = scopeArgs(info, args, String(admin));
    if (op === "Mutation") {
      const ids = Array.from(new Set(branchids)).filter((id) => Types.ObjectId.isValid(id));
      if (ids.length && (await Branch.countDocuments({ _id: { $in: ids }, admin })) !== ids.length) {
        throw denied("You do not have access to that branch.");
      }
    }
  }

  if (field === "getAdmins") {
    args.adminId = String(await callerAdminId(context)); // a business only sees itself
    return;
  }
  if ((field === "updateAdminSettings" || field === "testBusinessSmtp") && context.user.type !== "admin") {
    throw denied("Only the business owner can change business settings.");
  }
  if (field === "punch" && args?.input) await checkPunch(context, args.input);
  if (CUSTOM_ENTITY[field] && Array.isArray(args?.input?.customfields)) {
    await checkCustomFields(CUSTOM_ENTITY[field], args.input.customfields, await callerAdminId(context));
  }
  if (field === "approveLeaveRequest" || field === "rejectLeaveRequest") {
    args.approverid = String(context.user.id); // the approver is whoever is signed in
    args.approverType = context.user.type;
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

  const recordId = args?.[ID_ARG[field] || "id"];
  if (OWNED[field] && recordId != null) {
    const owner = await ownerOf(OWNED[field], recordId);
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
          await check(field, args || {}, context, info);
          if (TENANT_PUBLIC.has(field) && !context?.user && !isPlatform(context) && !args?.adminid && !args?.adminId
            && isListType(getNullableType(info.returnType))) return []; // no business named: nothing to list
          if (LOGIN.has(field)) return limitLogin(field, args, context, () => (fn as any)(parent, args, context, info));
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

const rootFieldOf = (info: any): string | undefined => {
  if (info?.operation?.operation !== "query") return undefined;
  let path = info.path;
  while (path?.prev) path = path.prev;
  const sel = info.operation.selectionSet.selections.find(
    (x: any) => x.kind === "Field" && (x.alias?.value ?? x.name.value) === path?.key
  );
  return sel?.name?.value;
};

const hiddenFor = (context: any, info: any) =>
  !isPlatform(context) && (!context?.user || context.user.type === "party") && TENANT_PUBLIC.has(rootFieldOf(info) || "");

/** Field resolvers that blank, for login-free callers, what the app and website never ask for. */
export const hideFromAnonymous = (typeDefs: any, maps: any[]) => {
  const schema = makeExecutableSchema({ typeDefs, resolverValidationOptions: { requireResolversToMatchSchema: "ignore" } });
  const out: any = {};
  for (const [type, allowed] of Object.entries(ANON_FIELDS)) {
    const fields = (schema.getType(type) as any)?.getFields?.() || {};
    for (const [name, def] of Object.entries<any>(fields)) {
      if (allowed.includes(name) || isNonNullType(def.type)) continue;
      const orig = maps.map((m) => m?.[type]?.[name]).filter(Boolean).pop();
      const run = typeof orig === "function" ? orig : orig?.resolve || defaultFieldResolver;
      (out[type] = out[type] || {})[name] = (parent: any, args: any, context: any, info: any) =>
        hiddenFor(context, info) ? null : run(parent, args, context, info);
    }
  }
  return out;
};

const blank = () => "";

// Passwords are never sent back (types keep `password` so old clients still parse).
export const hidePasswords = {
  Admin: { password: blank },
  Branch: { password: blank },
  StaffAccount: { password: blank },
};
