import { branchResolvers } from "./branches";
import { brandResolvers } from "./brands";
import { categoryResolvers } from "./categories";
import { modelResolvers } from "./models";
import { productGroupResolvers } from "./productgroups";
import { sizeResolvers } from "./size";

export const resolvers = [branchResolvers, categoryResolvers, sizeResolvers, brandResolvers, modelResolvers, productGroupResolvers];