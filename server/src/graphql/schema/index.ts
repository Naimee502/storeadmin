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
import { channelTypeDefs } from "./channel";
import { stockAdjustmentTypeDefs } from "./stockadjustments";

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
  channelTypeDefs,
  stockAdjustmentTypeDefs
];