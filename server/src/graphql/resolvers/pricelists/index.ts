import { AdminSettings } from "../../../models/adminsettings";
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
      return await PriceAssignment.find({ adminid, status: true }).sort({ createdAt: 1, _id: 1 }).populate("pricelistid");
    },
    getDeletedPriceAssignments: async (_: any, { adminid }: { adminid: string }) => {
      return await PriceAssignment.find({ adminid, status: false }).sort({ createdAt: 1, _id: 1 }).populate("pricelistid");
    },
    resolvePrice: async (_: any, { productid, variantid, unitid, adminid, accountid, channelid, region }: any, context: any) => {
      // Scope all lookups to the tenant's adminid when provided
      const base: any = adminid ? { adminid, status: true } : { status: true };
      let assignments = [];
      if (accountid) {
        assignments.push(...await PriceAssignment.find({ ...base, targettype: "customer", targetid: accountid }));
      }
      if (channelid && region) {
        assignments.push(...await PriceAssignment.find({ ...base, targettype: "channel_region", targetid: `${channelid}--${region}` }));
      }
      if (channelid) {
        assignments.push(...await PriceAssignment.find({ ...base, targettype: "channel", targetid: channelid }));
      }
      if (region) {
        assignments.push(...await PriceAssignment.find({ ...base, targettype: "region", targetid: region }));
      }
      if (assignments.length === 0) return null;
      
      for (const assignment of assignments) {
        const priceList = await PriceList.findById(assignment.pricelistid);
        if (priceList) {
          const item = priceList.items.find(
            (i: any) => 
              i.productid.toString() === productid && 
              i.variantid.toString() === variantid && 
              i.unitid.toString() === unitid
          );
          if (item) {
            // Every caller (POS, admin orders, party app, website) treats
            // `discount` as a rupee amount off the rate. Convert a percentage
            // discount here so "10%" isn't applied as ₹10.
            const plain: any = typeof (item as any).toObject === "function" ? (item as any).toObject() : { ...item };
            if (plain.discounttype === "percentage") {
              plain.discount = Math.round(((plain.rate || 0) * (plain.discount || 0)) / 100 * 100) / 100;
              plain.discounttype = "fixed";
            }
            // Business setting: no price-list discount on orders a salesman /
            // staff member takes (party's own app / website orders keep it).
            if (String(context?.user?.type || "") === "staff") {
              const st: any = await AdminSettings.findOne({ adminid: priceList.adminid }).select("salesmanPriceListDiscount").lean();
              if (st && st.salesmanPriceListDiscount === false) plain.discount = 0;
            }
            return plain;
          }
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
    resetPriceAssignment: async (_: any, { id }: any) => {
      await PriceAssignment.findByIdAndUpdate(id, { status: true });
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
