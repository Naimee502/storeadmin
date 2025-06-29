import { accountGroupTypeDefs } from "./accountgroups";
import { accountTypeDefs } from "./accounts";
import { adminTypeDefs } from "./admin";
import { branchTypeDefs } from "./branches";
import { brandTypeDefs } from "./brands";
import { categoryTypeDefs } from "./categories";
import { modelTypeDefs } from "./models";
import { productGroupTypeDefs } from "./productgroups";
import { productTypeDefs } from "./products";
import { purchaseInvoiceTypeDefs } from "./purchaseinvoice";
import { salesInvoiceTypeDefs } from "./salesinvoice";
import { salesmenAccountTypeDefs } from "./salesmenaccount";
import { sizeTypeDefs } from "./size";
import { transferStockTypeDefs } from "./transferstock";
import { unitTypeDefs } from "./units";
import { uploadTypeDefs } from "./uploads";

export const typeDefs = [branchTypeDefs, categoryTypeDefs, sizeTypeDefs, brandTypeDefs, modelTypeDefs, productGroupTypeDefs, accountGroupTypeDefs, accountTypeDefs, unitTypeDefs, salesmenAccountTypeDefs, uploadTypeDefs, productTypeDefs, salesInvoiceTypeDefs, purchaseInvoiceTypeDefs, transferStockTypeDefs, adminTypeDefs];