import { SalesInvoice } from "../../../models/salesinvoice";
import { SalesOrder } from "../../../models/salesorder";
import { SalesReturn } from "../../../models/salesreturn";
import { Payment } from "../../../models/payments";
import { ProductService } from "../../../models/products";
import { ProductBranchStock } from "../../../models/productbranchstock";
import { Account } from "../../../models/accounts";
import { AccountLedger } from "../../../models/accountledgers";
import { Unit } from "../../../models/units";
import { Category } from "../../../models/categories";
import { SubCategory } from "../../../models/subcategories";
import { Brand } from "../../../models/brands";
import { Model } from "../../../models/models";
import { Size } from "../../../models/size";
import { ProductGroup } from "../../../models/productgroups";
import { Branch } from "../../../models/branches";
import { StaffAccount } from "../../../models/staffaccounts";
import { PriceList } from "../../../models/pricelists";
import { PriceAssignment } from "../../../models/priceassignments";
import { ChargeRule } from "../../../models/chargerule";
import { AdminSettings } from "../../../models/adminsettings";
import { resolveTenant } from "../../../utils/tenant";
import { getPartiesTotalDue } from "../../../utils/allocation";
import { buildInvoiceQuery, formatInvoice, listPopulateFields as invoiceRefs, sourceOrderNoMap } from "../salesinvoice";
import { buildOrderQuery, formatOrder, listPopulateFields as orderRefs } from "../salesorder";
import { buildReturnQuery, formatReturn, listPopulateFields as returnRefs } from "../salesreturn";
import { buildPaymentQuery, formatPayment, LIST_POPULATE as paymentRefs } from "../payments";
import { buildProductListQuery, mapProductsWithStock, withProductListRefs } from "../products";
import { withAccountListRefs } from "../accounts";
import { withStaffListRefs } from "../staffaccounts";
import { BRANCH_LIST_ADMIN_FIELDS } from "../branches";
import { formatRule, populate as chargeRuleRefs } from "../chargerule";
import { formatSettings } from "../adminsettings";

export type SyncCtx = { context: any; adminid: string };

export type SyncCollection = {
  model: any;
  /** Field holding the business id. */
  tenant: "admin" | "adminid";
  /** Tenant plus the branch/role scoping of the module's list (no status). Default: tenant only. */
  scope?: (ctx: SyncCtx) => Promise<any>;
  /** Filter for live records in a full pull. Default { status: true }. */
  live?: any;
  /** False for deleted records. Default status === true. */
  isLive?: (doc: any) => boolean;
  /** "Changed since" filter. Default updatedAt > since. */
  changed?: (ctx: SyncCtx, since: Date) => Promise<any>;
  /** Find with the list's populates; the caller adds sort and limit. */
  find: (filter: any) => any;
  /** Shapes live docs like the list query items. Default as found. */
  shape?: (docs: any[], ctx: SyncCtx) => Promise<any[]> | any[];
};

// List queries filter on status: true; the sync pull decides status itself. Null = nothing matches.
const withoutStatus = (q: any) => {
  if (!q) return { _id: { $exists: false } };
  const { status, ...rest } = q;
  return rest;
};

const ADMIN_REF = { path: "admin", select: "name email" };

const master = (model: any, extra: any[] = []): SyncCollection => ({
  model,
  tenant: "admin",
  find: (f) => model.find(f).populate([ADMIN_REF, ...extra]).lean(),
});

export const SYNC_COLLECTIONS: Record<string, SyncCollection> = {
  salesinvoice: {
    model: SalesInvoice,
    tenant: "adminid",
    // Cancelled and fully returned bills are included so by-id reads work offline.
    scope: async (ctx) => withoutStatus(await buildInvoiceQuery({ adminid: ctx.adminid }, ctx.context)),
    find: (f) => SalesInvoice.find(f).populate(invoiceRefs).lean(),
    shape: async (docs) => {
      const orderNo = await sourceOrderNoMap(docs);
      return docs.map((inv: any) => ({
        ...formatInvoice(inv),
        sourceorderno: inv.sourceorderid ? orderNo.get(String(inv.sourceorderid._id ?? inv.sourceorderid)) ?? null : null,
      }));
    },
  },
  salesorder: {
    model: SalesOrder,
    tenant: "adminid",
    scope: async (ctx) =>
      withoutStatus(await buildOrderQuery({ adminid: ctx.adminid, includeConverted: true }, ctx.context)),
    find: (f) => SalesOrder.find(f).populate(orderRefs).lean(),
    shape: (docs) => docs.map(formatOrder),
  },
  salesreturn: {
    model: SalesReturn,
    tenant: "adminid",
    scope: async (ctx) => withoutStatus(buildReturnQuery({ adminid: ctx.adminid }, ctx.context)),
    find: (f) => SalesReturn.find(f).populate(returnRefs).lean(),
    shape: (docs) => docs.map(formatReturn),
  },
  payment: {
    model: Payment,
    tenant: "adminid",
    scope: async (ctx) => withoutStatus(await buildPaymentQuery({ adminid: ctx.adminid }, ctx.context)),
    find: (f) => Payment.find(f).populate(paymentRefs).lean(),
    shape: (docs) => docs.map(formatPayment),
  },
  product: {
    model: ProductService,
    tenant: "adminid",
    scope: async (ctx) => withoutStatus((await buildProductListQuery({}, ctx.context)).query),
    // Stock moves do not touch the product, so changed stock rows count too.
    changed: async (ctx, since) => {
      const tenant = await resolveTenant(ctx.context);
      const stock: any = { adminid: tenant.adminid, updatedAt: { $gt: since } };
      if (tenant.branchid) stock.branchid = tenant.branchid;
      const ids = await ProductBranchStock.find(stock).distinct("productid");
      return { $or: [{ updatedAt: { $gt: since } }, { _id: { $in: ids } }] };
    },
    find: (f) => withProductListRefs(ProductService.find(f)),
    shape: async (docs, ctx) => mapProductsWithStock(docs, await resolveTenant(ctx.context), false),
  },
  account: {
    model: Account,
    tenant: "admin",
    find: (f) => withAccountListRefs(Account.find(f)).lean(),
    // Outstanding as the party list shows it; it only refreshes when the account itself changes.
    shape: async (docs, ctx) => {
      const due = await getPartiesTotalDue({ partyids: docs.map((d: any) => d._id), adminid: ctx.adminid });
      return docs.map((d: any) => ({ ...d, outstanding: due[String(d._id)] || 0 }));
    },
  },
  ledger: master(AccountLedger, [
    { path: "accountgroupid", select: "accountgroupname" },
    { path: "branchid", select: "branchname" },
  ]),
  unit: master(Unit),
  category: master(Category),
  subcategory: master(SubCategory, [{ path: "category", select: "categorycode categoryname" }]),
  brand: master(Brand),
  model: master(Model),
  size: master(Size),
  productgroup: master(ProductGroup),
  branch: {
    model: Branch,
    tenant: "admin",
    find: (f) => Branch.find(f).populate({ path: "admin", select: BRANCH_LIST_ADMIN_FIELDS }).lean(),
  },
  staff: {
    model: StaffAccount,
    tenant: "admin",
    find: (f) => withStaffListRefs(StaffAccount.find(f)).lean(),
  },
  pricelist: {
    model: PriceList,
    tenant: "adminid",
    find: (f) =>
      PriceList.find(f)
        .populate([
          { path: "items.productid", select: "name" },
          { path: "items.unitid", select: "unitname" },
        ])
        .lean(),
  },
  priceassignment: {
    model: PriceAssignment,
    tenant: "adminid",
    find: (f) => PriceAssignment.find(f).populate({ path: "pricelistid", select: "name" }).lean(),
  },
  chargerule: {
    model: ChargeRule,
    tenant: "adminid",
    find: (f) => ChargeRule.find(f).populate(chargeRuleRefs).lean(),
    shape: (docs) => docs.map(formatRule),
  },
  adminsettings: {
    model: AdminSettings,
    tenant: "adminid",
    live: {},
    isLive: () => true,
    // Not lean: the list applies schema defaults through toObject().
    find: (f) => AdminSettings.find(f),
    shape: (docs) => docs.map((d: any) => formatSettings(d.toObject())),
  },
};
