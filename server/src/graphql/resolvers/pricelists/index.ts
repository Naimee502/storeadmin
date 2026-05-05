import { PriceList } from "../../../models/pricelists";
import { PriceAssignment } from "../../../models/priceassignments";
import { ProductService } from "../../../models/products";
import { Unit } from "../../../models/units";

export const priceListResolvers = {
  Query: {
    getPriceLists: async (_: any, { adminid }: { adminid: string }) => {
      return await PriceList.find({ adminid, status: true }).sort({ createdAt: -1 });
    },
    getDeletedPriceLists: async (_: any, { adminid }: { adminid: string }) => {
      return await PriceList.find({ adminid, status: false }).sort({ createdAt: -1 });
    },
    getPriceListById: async (_: any, { id }: { id: string }) => {
      return await PriceList.findById(id).populate("items.productid").populate("items.unitid");
    },
    getPriceAssignments: async (_: any, { adminid }: { adminid: string }) => {
      return await PriceAssignment.find({ adminid, status: true }).populate("pricelistid");
    },
    resolvePrice: async (_: any, { productid, variantid, unitid, accountid, channelid, region }: any) => {
      let assignments = [];
      if (accountid) {
        assignments.push(...await PriceAssignment.find({ targettype: "customer", targetid: accountid, status: true }));
      }
      if (channelid) {
        assignments.push(...await PriceAssignment.find({ targettype: "channel", targetid: channelid, status: true }));
      }
      if (region) {
        assignments.push(...await PriceAssignment.find({ targettype: "region", targetid: region, status: true }));
      }
      
      assignments.sort((a, b) => a.priority - b.priority);
      
      for (const assignment of assignments) {
        const priceList = await PriceList.findById(assignment.pricelistid);
        if (priceList) {
          const item = priceList.items.find(
            (i: any) => 
              i.productid.toString() === productid && 
              i.variantid.toString() === variantid && 
              i.unitid.toString() === unitid
          );
          if (item) return item;
        }
      }
      
      return null;
    },
  },
  Mutation: {
    createPriceList: async (_: any, { input }: any, context: any) => {
      const adminid = input.adminid || context.admin?.id;
      return await PriceList.create({ ...input, adminid });
    },
    updatePriceList: async (_: any, { id, input }: any) => {
      return await PriceList.findByIdAndUpdate(id, input, { new: true });
    },
    deletePriceList: async (_: any, { id }: any) => {
      await PriceList.findByIdAndUpdate(id, { status: false });
      return true;
    },
    resetPriceList: async (_: any, { id }: any) => {
      await PriceList.findByIdAndUpdate(id, { status: true });
      return true;
    },
    createPriceAssignment: async (_: any, { input }: any, context: any) => {
      const adminid = input.adminid || context.admin?.id;
      return await PriceAssignment.create({ ...input, adminid });
    },
    updatePriceAssignment: async (_: any, { id, input }: any) => {
      return await PriceAssignment.findByIdAndUpdate(id, input, { new: true });
    },
    deletePriceAssignment: async (_: any, { id }: any) => {
      await PriceAssignment.findByIdAndUpdate(id, { status: false });
      return true;
    },
  },
  PriceListItem: {
    productid: async (parent: any) => {
      return await ProductService.findById(parent.productid);
    },
    unitid: async (parent: any) => {
      return await Unit.findById(parent.unitid);
    }
  }
};
