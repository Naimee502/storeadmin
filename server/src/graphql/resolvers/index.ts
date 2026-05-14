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
import { channelResolvers } from "./channel";
import { stockAdjustmentResolvers } from "./stockadjustments";
import { salesRouteResolvers } from "./salesroutes";
import { priceListResolvers } from "./pricelists";
import { salesOrderResolvers } from "./salesorder";
import { purchaseOrderResolvers } from "./purchaseorder";
import { attendanceResolvers } from "./attendance";
import { salesReturnResolvers } from "./salesreturn";
import { purchaseReturnResolvers } from "./purchasereturn";
import { adminSettingsResolvers } from "./adminsettings";
import { permissionsResolvers } from "./permissions";

export const resolvers = [
  branchResolvers,
  categoryResolvers,
  subCategoryResolvers,
  sizeResolvers,
  brandResolvers,
  modelResolvers,
  productGroupResolvers,
  accountGroupResolvers,
  accountLedgerResolvers,
  accountResolvers,
  unitResolvers,
  staffAccountResolvers,
  uploadResolvers,
  productServiceResolvers,
  salesInvoiceResolvers,
  purchaseInvoiceResolvers,
  transferStockResolvers,
  adminResolvers,
  transactionResolvers,
  paymentResolvers,
  expenseNoteResolvers,
  channelResolvers,
  stockAdjustmentResolvers,
  salesRouteResolvers,
  priceListResolvers,
  salesOrderResolvers,
  purchaseOrderResolvers,
  attendanceResolvers,
  salesReturnResolvers,
  purchaseReturnResolvers,
  adminSettingsResolvers,
  permissionsResolvers,
];