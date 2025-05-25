import { branchTypeDefs } from "./branches";
import { brandTypeDefs } from "./brands";
import { categoryTypeDefs } from "./categories";
import { modelTypeDefs } from "./models";
import { productGroupTypeDefs } from "./productgroups";
import { sizeTypeDefs } from "./size";

export const typeDefs = [branchTypeDefs, categoryTypeDefs, sizeTypeDefs, brandTypeDefs, modelTypeDefs, productGroupTypeDefs];