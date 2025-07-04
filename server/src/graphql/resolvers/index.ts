import { accountGroupResolvers } from "./accountgroups";
import { accountResolvers } from "./accounts";
import { adminResolvers } from "./admin";
import { branchResolvers } from "./branches";
import { brandResolvers } from "./brands";
import { categoryResolvers } from "./categories";
import { modelResolvers } from "./models";
import { productGroupResolvers } from "./productgroups";
import { productResolvers } from "./products";
import { purchaseInvoiceResolvers } from "./purchaseinvoice";
import { salesInvoiceResolvers } from "./salesinvoice";
import { salesmenAccountResolvers } from "./salesmenaccount";
import { sizeResolvers } from "./size";
import { transferStockResolvers } from "./transferstock";
import { unitResolvers } from "./units";
import { uploadResolvers } from "./uploads";

export const resolvers = [branchResolvers, categoryResolvers, sizeResolvers, brandResolvers, modelResolvers, productGroupResolvers, accountGroupResolvers, accountResolvers, unitResolvers, salesmenAccountResolvers, uploadResolvers, productResolvers, salesInvoiceResolvers, purchaseInvoiceResolvers, transferStockResolvers, adminResolvers];