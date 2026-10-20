import { accountGroupTypeDefs } from "./accountgroups";
import { accountLedgerTypeDefs } from "./accountledgers";
import { accountTypeDefs } from "./accounts";
import { adminTypeDefs } from "./admin";
import { branchTypeDefs } from "./branches";
import { brandTypeDefs } from "./brands";
import { categoryTypeDefs } from "./categories";
import { modelTypeDefs } from "./models";
import { paymentTypeDefs } from "./payments";
import { productGroupTypeDefs } from "./productgroups";
import { productServiceTypeDefs } from "./products";
import { purchaseInvoiceTypeDefs } from "./purchaseinvoice";
import { salesInvoiceTypeDefs } from "./salesinvoice";
import { staffAccountTypeDefs } from "./staffaccounts";
import { sizeTypeDefs } from "./size";
import { subCategoryTypeDefs } from "./subcategories";
import { transactionTypeDefs } from "./transactions";
import { transferStockTypeDefs } from "./transferstock";
import { unitTypeDefs } from "./units";
import { uploadTypeDefs } from "./uploads";
import { expenseNoteTypeDefs } from "./expensenote";
import { expenseClaimTypeDefs } from "./expenseclaim";
import { announcementTypeDefs } from "./announcement";
import { channelTypeDefs } from "./channel";
import { stockAdjustmentTypeDefs } from "./stockadjustments";
import { salesRouteSchema } from "./salesroutes";
import { priceListTypeDefs } from "./pricelists";
import { salesOrderTypeDefs } from "./salesorder";
import { purchaseOrderTypeDefs } from "./purchaseorder";
import { attendanceTypeDefs } from "./attendance";
import { salesReturnTypeDefs } from "./salesreturn";
import { geocodeTypeDefs } from "./geocode";
import { purchaseReturnTypeDefs } from "./purchasereturn";
import { adminSettingsTypeDefs } from "./adminsettings";
import { permissionsTypeDefs } from "./permissions";
import { chargeRuleTypeDefs } from "./chargerule";
import { visitTypeDefs } from "./visit";
import { salesmanReportTypeDefs } from "./salesmanreport";
import { locationPingTypeDefs } from "./locationping";
import { notificationTypeDefs } from "./notifications";
import { accountDeletionTypeDefs } from "./accountdeletionrequest";

export const typeDefs = [
  branchTypeDefs,
  categoryTypeDefs,
  subCategoryTypeDefs,
  sizeTypeDefs,
  brandTypeDefs,
  modelTypeDefs,
  productGroupTypeDefs,
  accountGroupTypeDefs,
  accountLedgerTypeDefs,
  accountTypeDefs,
  unitTypeDefs,
  staffAccountTypeDefs,
  uploadTypeDefs,
  productServiceTypeDefs,
  salesInvoiceTypeDefs,
  purchaseInvoiceTypeDefs,
  transferStockTypeDefs,
  adminTypeDefs,
  transactionTypeDefs,
  paymentTypeDefs,
  expenseNoteTypeDefs,
  expenseClaimTypeDefs,
  announcementTypeDefs,
  channelTypeDefs,
  stockAdjustmentTypeDefs,
  salesRouteSchema,
  priceListTypeDefs,
  salesOrderTypeDefs,
  purchaseOrderTypeDefs,
  attendanceTypeDefs,
  salesReturnTypeDefs,
  geocodeTypeDefs,
  purchaseReturnTypeDefs,
  adminSettingsTypeDefs,
  permissionsTypeDefs,
  chargeRuleTypeDefs,
  visitTypeDefs,
  salesmanReportTypeDefs,
  locationPingTypeDefs,
  notificationTypeDefs,
  accountDeletionTypeDefs,
];