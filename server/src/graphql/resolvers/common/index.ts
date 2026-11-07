import mongoose from "mongoose";
import { Admin } from "../../../models/admin";
import { permissionsResolvers } from "../permissions";

type ClearTarget = {
  /** Mongoose model name. */
  model: string;
  /** Field holding the business (admin) id. */
  tenant: "admin" | "adminid";
  /** What "deleted" means for this model. Defaults to { status: false }. */
  deleted?: Record<string, any>;
  /** Permission module when it differs from the key (e.g. claims live under expensenote). */
  permission?: string;
};

// Permission module id (same as the client) -> where its deleted entries live.
export const CLEAR_TARGETS: Record<string, ClearTarget> = {
  units: { model: "Unit", tenant: "admin" },
  sizes: { model: "Size", tenant: "admin" },
  brands: { model: "Brand", tenant: "admin" },
  categories: { model: "Category", tenant: "admin" },
  subcategories: { model: "SubCategory", tenant: "admin" },
  models: { model: "Model", tenant: "admin" },
  productgroups: { model: "ProductGroup", tenant: "admin" },
  accountgroups: { model: "AccountGroup", tenant: "admin" },
  accountledgers: { model: "AccountLedger", tenant: "admin" },
  accounts: { model: "Account", tenant: "admin" },
  branches: { model: "Branch", tenant: "admin" },
  staffaccounts: { model: "StaffAccount", tenant: "admin" },
  channels: { model: "Channel", tenant: "admin" },
  products: { model: "ProductService", tenant: "adminid" },
  salesinvoice: { model: "SalesInvoice", tenant: "adminid" },
  purchaseinvoice: { model: "PurchaseInvoice", tenant: "adminid" },
  salesorder: { model: "SalesOrder", tenant: "adminid" },
  purchaseorder: { model: "PurchaseOrder", tenant: "adminid" },
  salesreturn: { model: "SalesReturn", tenant: "adminid" },
  purchasereturn: { model: "PurchaseReturn", tenant: "adminid" },
  transferstock: { model: "TransferStock", tenant: "admin" },
  stockadjustments: { model: "StockAdjustment", tenant: "adminid" },
  transactions: { model: "Transaction", tenant: "adminid" },
  payments: { model: "Payment", tenant: "adminid" },
  expensenote: { model: "ExpenseNote", tenant: "adminid" },
  expenseclaims: { model: "ExpenseClaim", tenant: "adminid", permission: "expensenote", deleted: { isactive: false } },
  salesroutes: { model: "SalesRoute", tenant: "adminid" },
  pricelists: { model: "PriceList", tenant: "adminid" },
  priceassignments: { model: "PriceAssignment", tenant: "adminid" },
  chargerules: { model: "ChargeRule", tenant: "adminid" },
  announcements: { model: "Announcement", tenant: "adminid", deleted: { isactive: false } },
  attendance: { model: "Attendance", tenant: "adminid", deleted: { status_active: false } },
};

// Same rule as the client: no record for the module = allowed,
// a saved record without "clear" = not allowed.
const allows = (permissions: Record<string, any> = {}, moduleId: string, action: string) => {
  const section = Object.entries(permissions).find(([k]) => k.toLowerCase() === moduleId.toLowerCase())?.[1] as any;
  if (!section) return true;
  return section[action] === true;
};

async function canClear(user: any, moduleId: string): Promise<boolean> {
  if (user.type === "admin") {
    const admin: any = await Admin.findById(user.id).select("defaultPermissions").lean();
    const perms = admin?.defaultPermissions || {};
    if (!Object.keys(perms).length) return true; // nothing configured yet: owner has everything
    return allows(perms, moduleId, "clear");
  }
  if (user.type === "branch" || user.type === "staff") {
    const eff: any = await permissionsResolvers.Query.getEffectivePermissions(null, { scope: user.type, scopeid: user.id });
    return allows(eff?.permissions, moduleId, "clear");
  }
  return false;
}

export const commonResolvers = {
  Mutation: {
    clearDeletedEntries: async (_: any, { module, ids }: { module: string; ids: string[] }, context: any) => {
      const user = context?.user;
      if (!user?.id) throw new Error("Not authenticated");

      const target = CLEAR_TARGETS[String(module || "").toLowerCase()];
      if (!target) throw new Error(`Clear is not available for ${module}`);
      if (!(await canClear(user, target.permission || module))) throw new Error("You do not have permission to clear deleted entries");

      const tenantId = user.type === "admin" ? user.id : user.adminid;
      if (!tenantId) throw new Error("Business not found for this login");

      const validIds = (ids || []).filter((id) => mongoose.isValidObjectId(id));
      if (!validIds.length) return 0;

      const Model = mongoose.models[target.model];
      if (!Model) throw new Error(`Model ${target.model} is not registered`);

      // Only this business's entries that are already deleted can be cleared.
      const filter = {
        _id: { $in: validIds },
        [target.tenant]: tenantId,
        ...(target.deleted || { status: false }),
      };
      const res = await Model.updateMany(
        filter,
        { $set: { cleared: true, clearedAt: new Date(), clearedBy: String(user.id) } },
        { strict: false }
      );
      return res.modifiedCount ?? 0;
    },
  },
};
