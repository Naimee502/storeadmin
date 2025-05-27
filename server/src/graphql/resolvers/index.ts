import { accountGroupResolvers } from "./accountgroups";
import { accountResolvers } from "./accounts";
import { branchResolvers } from "./branches";
import { brandResolvers } from "./brands";
import { categoryResolvers } from "./categories";
import { modelResolvers } from "./models";
import { productGroupResolvers } from "./productgroups";
import { sizeResolvers } from "./size";
import { unitResolvers } from "./units";

export const resolvers = [branchResolvers, categoryResolvers, sizeResolvers, brandResolvers, modelResolvers, productGroupResolvers, accountGroupResolvers, accountResolvers, unitResolvers];