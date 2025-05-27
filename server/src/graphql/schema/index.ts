import { accountGroupTypeDefs } from "./accountgroups";
import { accountTypeDefs } from "./accounts";
import { branchTypeDefs } from "./branches";
import { brandTypeDefs } from "./brands";
import { categoryTypeDefs } from "./categories";
import { modelTypeDefs } from "./models";
import { productGroupTypeDefs } from "./productgroups";
import { sizeTypeDefs } from "./size";
import { unitTypeDefs } from "./units";

export const typeDefs = [branchTypeDefs, categoryTypeDefs, sizeTypeDefs, brandTypeDefs, modelTypeDefs, productGroupTypeDefs, accountGroupTypeDefs, accountTypeDefs, unitTypeDefs];