import { accountGroupTypeDefs } from "./accountgroups";
import { accountTypeDefs } from "./accounts";
import { branchTypeDefs } from "./branches";
import { brandTypeDefs } from "./brands";
import { categoryTypeDefs } from "./categories";
import { modelTypeDefs } from "./models";
import { productGroupTypeDefs } from "./productgroups";
import { productTypeDefs } from "./products";
import { salesInvoiceTypeDefs } from "./salesinvoice";
import { salesmenAccountTypeDefs } from "./salesmenaccount";
import { sizeTypeDefs } from "./size";
import { unitTypeDefs } from "./units";
import { uploadTypeDefs } from "./uploads";

export const typeDefs = [branchTypeDefs, categoryTypeDefs, sizeTypeDefs, brandTypeDefs, modelTypeDefs, productGroupTypeDefs, accountGroupTypeDefs, accountTypeDefs, unitTypeDefs, salesmenAccountTypeDefs, uploadTypeDefs, productTypeDefs, salesInvoiceTypeDefs];