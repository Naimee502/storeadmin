import { accountGroupResolvers } from "./accountgroups";
import { accountLedgerResolvers } from "./accountledgers";
import { accountResolvers } from "./accounts";
import { adminResolvers } from "./admin";
import { branchResolvers } from "./branches";
import { brandResolvers } from "./brands";
import { categoryResolvers } from "./categories";
import { modelResolvers } from "./models";
import { paymentResolvers } from "./payments";
import { productGroupResolvers } from "./productgroups";
import { productServiceResolvers } from "./products";
import { productImportResolvers } from "./productimport";
import { purchaseInvoiceResolvers } from "./purchaseinvoice";
import { salesInvoiceResolvers } from "./salesinvoice";
import { staffAccountResolvers } from "./staffaccounts";
import { sizeResolvers } from "./size";
import { subCategoryResolvers } from "./subcategories";
import { transactionResolvers } from "./transactions";
import { transferStockResolvers } from "./transferstock";
import { unitResolvers } from "./units";
import { uploadResolvers } from "./uploads";
import { expenseNoteResolvers } from "./expensenote";
import { expenseClaimResolvers } from "./expenseclaim";
import { announcementResolvers } from "./announcement";
import { channelResolvers } from "./channel";
import { stockAdjustmentResolvers } from "./stockadjustments";
import { salesRouteResolvers } from "./salesroutes";
import { priceListResolvers } from "./pricelists";
import { salesOrderResolvers } from "./salesorder";
import { purchaseOrderResolvers } from "./purchaseorder";
import { attendanceResolvers } from "./attendance";
import { salesReturnResolvers } from "./salesreturn";
import { geocodeResolvers } from "./geocode";
import { purchaseReturnResolvers } from "./purchasereturn";
import { adminSettingsResolvers } from "./adminsettings";
import { permissionsResolvers } from "./permissions";
import { chargeRuleResolvers } from "./chargerule";
import { visitResolvers } from "./visit";
import { salesmanReportResolvers } from "./salesmanreport";
import { locationPingResolvers } from "./locationping";
import { notificationResolvers } from "./notifications";
import { accountDeletionResolvers } from "./accountdeletionrequest";
import { commonResolvers } from "./common";
import { offlineDeviceResolvers } from "./offlinedevice";
import { syncResolvers } from "./sync";

import { withOfflineActions, withOfflineWrites } from "../../utils/offlinesync";
import { SalesOrder } from "../../models/salesorder";
import { SalesInvoice } from "../../models/salesinvoice";
import { PurchaseOrder } from "../../models/purchaseorder";
import { Unit } from "../../models/units";
import { Category } from "../../models/categories";
import { SubCategory } from "../../models/subcategories";
import { Brand } from "../../models/brands";
import { Model } from "../../models/models";
import { Size } from "../../models/size";
import { ProductGroup } from "../../models/productgroups";
import { ProductService } from "../../models/products";
import { Account } from "../../models/accounts";
import { AccountLedger } from "../../models/accountledgers";
import { ExpenseNote } from "../../models/expensenote";
import { Transaction } from "../../models/transactions";
import { ExpenseClaim } from "../../models/expenseclaim";
import { Visit } from "../../models/visit";

export const resolvers = [
  branchResolvers,
  withOfflineWrites(categoryResolvers, { model: Category, typename: "Category", tenant: "admin", add: "addCategory", edit: "editCategory", del: "deleteCategory", isoUpdatedAt: true }),
  withOfflineWrites(subCategoryResolvers, { model: SubCategory, typename: "SubCategory", tenant: "admin", add: "addSubCategory", edit: "editSubCategory", del: "deleteSubCategory", isoUpdatedAt: true }),
  withOfflineWrites(sizeResolvers, { model: Size, typename: "Size", tenant: "admin", add: "addSize", edit: "editSize", del: "deleteSize", isoUpdatedAt: true }),
  withOfflineWrites(brandResolvers, { model: Brand, typename: "Brand", tenant: "admin", add: "addBrand", edit: "editBrand", del: "deleteBrand", isoUpdatedAt: true }),
  withOfflineWrites(modelResolvers, { model: Model, typename: "Model", tenant: "admin", add: "addModel", edit: "editModel", del: "deleteModel", isoUpdatedAt: true }),
  withOfflineWrites(productGroupResolvers, { model: ProductGroup, typename: "ProductGroup", tenant: "admin", add: "addProductGroup", edit: "editProductGroup", del: "deleteProductGroup", isoUpdatedAt: true }),
  accountGroupResolvers,
  withOfflineWrites(accountLedgerResolvers, { model: AccountLedger, typename: "AccountLedger", tenant: "admin", add: "addAccountLedger", edit: "editAccountLedger", del: "deleteAccountLedger" }),
  withOfflineWrites(accountResolvers, { model: Account, typename: "Account", tenant: "admin", add: "addAccount", edit: "editAccount", del: "deleteAccount" }),
  withOfflineWrites(unitResolvers, { model: Unit, typename: "Unit", tenant: "admin", add: "addUnit", edit: "editUnit", del: "deleteUnit", isoUpdatedAt: true }),
  staffAccountResolvers,
  uploadResolvers,
  withOfflineWrites(productServiceResolvers, { model: ProductService, typename: "ProductService", tenant: "adminid", add: "addProductService", edit: "updateProductService", del: "deleteProductService" }),
  productImportResolvers,
  withOfflineActions(salesInvoiceResolvers, SalesInvoice, ["markSalesInvoiceDispatched", "markSalesInvoiceDelivered", "assignInvoiceDeliveryBoy"]),
  purchaseInvoiceResolvers,
  transferStockResolvers,
  adminResolvers,
  withOfflineWrites(transactionResolvers, { model: Transaction, typename: "Transaction", tenant: "adminid", add: "addTransaction", edit: "editTransaction", del: "deleteTransaction" }),
  paymentResolvers,
  withOfflineWrites(expenseNoteResolvers, { model: ExpenseNote, typename: "ExpenseNote", tenant: "adminid", add: "addExpenseNote", edit: "editExpenseNote", del: "deleteExpenseNote" }),
  withOfflineWrites(expenseClaimResolvers, { model: ExpenseClaim, typename: "ExpenseClaim", tenant: "adminid", add: "addExpenseClaim", edit: "editExpenseClaim", del: "deleteExpenseClaim" }),
  announcementResolvers,
  channelResolvers,
  stockAdjustmentResolvers,
  salesRouteResolvers,
  priceListResolvers,
  withOfflineActions(salesOrderResolvers, SalesOrder, ["confirmSalesOrder", "markSalesOrderDispatched", "markSalesOrderDelivered", "assignOrderDeliveryBoy"]),
  withOfflineActions(purchaseOrderResolvers, PurchaseOrder, ["confirmPurchaseOrder", "markPurchaseOrderReceived"]),
  attendanceResolvers,
  salesReturnResolvers,
  geocodeResolvers,
  purchaseReturnResolvers,
  adminSettingsResolvers,
  permissionsResolvers,
  chargeRuleResolvers,
  withOfflineWrites(visitResolvers, { model: Visit, typename: "Visit", tenant: "adminid", add: "addVisit", edit: "editVisit", del: "deleteVisit" }),
  salesmanReportResolvers,
  locationPingResolvers,
  notificationResolvers,
  accountDeletionResolvers,
  commonResolvers,
  offlineDeviceResolvers,
  syncResolvers,
];