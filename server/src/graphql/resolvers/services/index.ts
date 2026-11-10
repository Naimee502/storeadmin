import { ProductService } from "../../../models/products";
import { productServiceResolvers } from "../products";
import { TenantError, requireBackofficeTenant } from "../../../utils/tenant";
import { assertModuleOn } from "../../../utils/modulegate";
import { isActionAllowed } from "../../../utils/permissiongate";

const P: any = productServiceResolvers;

async function gate(context: any, action: string) {
  const scope = await requireBackofficeTenant(context);
  const where = {
    adminid: scope.adminid,
    branchid: scope.userType === "admin" ? undefined : scope.branchid,
    staffid: scope.userType === "staff" ? scope.userId : undefined,
  };
  await assertModuleOn("services", "Services", where);
  if (!(await isActionAllowed("services", action, where))) throw new TenantError("You do not have permission for this Services action.");
  return scope;
}

async function ownService(id: string, context: any, action: string) {
  const scope = await gate(context, action);
  const d: any = await ProductService.findOne({ _id: id, adminid: scope.adminid }).select("isservice").lean();
  if (!d?.isservice) throw new TenantError("Service not found.", "BAD_USER_INPUT");
}

// A service is always saved as one, with no stock variants.
const asService = (input: any) => ({ ...input, isservice: true, productvariants: [] });

export const servicesResolvers = {
  Query: {
    getServicesPage: (p: any, args: any, context: any, info: any) =>
      P.Query.getProductServicesPage(p, { ...args, filter: { ...(args?.filter || {}), isservice: true } }, context, info),
    getServices: (p: any, args: any, context: any, info: any) =>
      P.Query.getProductServices(p, { filter: { ...(args?.filter || {}), isservice: true } }, context, info),
    getServiceById: async (p: any, { id }: any, context: any, info: any) => {
      const d = await P.Query.getProductServiceById(p, { id }, context, info);
      return d?.isservice ? d : null;
    },
  },
  Mutation: {
    addService: async (p: any, { input }: any, context: any, info: any) => {
      await gate(context, "add");
      return P.Mutation.addProductService(p, { input: asService(input) }, context, info);
    },
    updateService: async (p: any, { id, input }: any, context: any, info: any) => {
      await ownService(id, context, "edit");
      return P.Mutation.updateProductService(p, { id, input: asService(input) }, context, info);
    },
    deleteService: async (p: any, { id }: any, context: any, info: any) => {
      await ownService(id, context, "delete");
      return P.Mutation.deleteProductService(p, { id }, context, info);
    },
    resetService: async (p: any, { id }: any, context: any, info: any) => {
      await ownService(id, context, "reset");
      return P.Mutation.resetProductService(p, { id }, context, info);
    },
  },
};
