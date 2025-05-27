import { accountGroupResolvers } from "./accountgroups";
import { accountResolvers } from "./accounts";
import { branchResolvers } from "./branches";
import { brandResolvers } from "./brands";
import { categoryResolvers } from "./categories";
import { modelResolvers } from "./models";
import { productGroupResolvers } from "./productgroups";
import { salesmenAccountResolvers } from "./salesmenaccount";
import { sizeResolvers } from "./size";
import { unitResolvers } from "./units";
import { uploadResolvers } from "./uploads";

export const resolvers = [branchResolvers, categoryResolvers, sizeResolvers, brandResolvers, modelResolvers, productGroupResolvers, accountGroupResolvers, accountResolvers, unitResolvers, salesmenAccountResolvers, uploadResolvers];