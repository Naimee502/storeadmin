import { ProductService } from "../../../models/products";
import { Types } from "mongoose";
import { getStockDetails, manageStock } from "../../../utils/stockmanager";
import { Branch } from "../../../models/branches";

export const productServiceResolvers = {
  Query: {
    getProductServices: async (_: any, { filter = {}, limit = 50, offset = 0 }: any) => {
      try {
        const query: any = {};
        query.status = typeof filter.status === "boolean" ? filter.status : true;

        const directKeys = [
          "adminid","vendorid","productcode","productbarcode","servicecode",
          "servicebarcode","isservice","isfeatured","isshowinpos",
          "categoryid","subcategoryid","groupid","modelid","brandid","sizeid"
        ];

        directKeys.forEach((key) => {
          if (filter[key] !== undefined && filter[key] !== "") query[key] = filter[key];
        });

        if (filter.name_contains) {
          query.name = { $regex: filter.name_contains, $options: "i" };
        }

        if (filter.createdFrom || filter.createdTo) {
          query.createdAt = {};
          if (filter.createdFrom) query.createdAt.$gte = new Date(filter.createdFrom);
          if (filter.createdTo) query.createdAt.$lte = new Date(filter.createdTo);
        }

        const totalCount = await ProductService.countDocuments(query);

        let productsQuery = ProductService.find(query)
          .populate({ path: "categoryid", select: "id categoryname" })
          .populate({ path: "subcategoryid", select: "id subcategoryname" })
          .populate({ path: "groupid", select: "id productgroupname" })
          .populate({ path: "modelid", select: "id modelname" })
          .populate({ path: "brandid", select: "id brandname" })
          .populate({ path: "sizeid", select: "id sizename" })

          .populate({ path: "productvariants.baseunitid", select: "id unitname" })
          .populate({ path: "productvariants.purchaseunitid", select: "id unitname" })
          .populate({ path: "productvariants.unitconversions.unitid", select: "id unitname" })
          .populate({ path: "productvariants.pricing.unitprices.unitid", select: "id unitname" })

          .populate({ path: "salesaccountid", select: "id ledgername" })
          .populate({ path: "purchaseaccountid", select: "id ledgername" })
          .populate({ path: "serviceaccountid", select: "id ledgername" })
          .lean();

        if (offset) productsQuery = productsQuery.skip(offset);
        if (limit) productsQuery = productsQuery.limit(limit);

        const products = await productsQuery.exec();

        const adminId = filter.adminid ? new Types.ObjectId(filter.adminid) : undefined;
        const branchId = filter.branchid ? new Types.ObjectId(filter.branchid) : undefined;

        const convertRef = (obj: any) => {
          if (!obj) return obj;
          const { _id, ...rest } = obj;
          return { id: _id?.toString(), ...rest };
        };

        const response = await Promise.all(
          products.map(async (p: any) => {
            const mapped: any = {
              ...p,
              id: p._id?.toString(),
              _id: p._id // ✅ keep _id for stock lookup
            };

            // top-level refs
            mapped.categoryid = convertRef(mapped.categoryid);
            mapped.subcategoryid = convertRef(mapped.subcategoryid);
            mapped.groupid = convertRef(mapped.groupid);
            mapped.modelid = convertRef(mapped.modelid);
            mapped.brandid = convertRef(mapped.brandid);
            mapped.sizeid = convertRef(mapped.sizeid);

            mapped.salesaccountid = convertRef(mapped.salesaccountid);
            mapped.purchaseaccountid = convertRef(mapped.purchaseaccountid);
            mapped.serviceaccountid = convertRef(mapped.serviceaccountid);

            // ✅ Product Variant Mapping
            if (mapped.productvariants?.length) {
              mapped.productvariants = await Promise.all(
                mapped.productvariants.map(async (v: any) => {
                  let stock = await getStockDetails(mapped._id, adminId, branchId, v._id);
                  if (stock.currentstock === 0)
                    stock = await getStockDetails(mapped._id, adminId, branchId);

                  // ✅ Convert nested keys
                  const variant = {
                    ...v,
                    id: v._id?.toString(),
                    _id: v._id
                  };

                  // units
                  variant.baseunitid = convertRef(variant.baseunitid);
                  variant.purchaseunitid = convertRef(variant.purchaseunitid);

                  // unit conversions
                  if (variant.unitconversions?.length) {
                    variant.unitconversions = variant.unitconversions.map((u: any) => ({
                      factor: u.factor,
                      unitid: convertRef(u.unitid),
                    }));
                  }

                  // serials
                  if (variant.serials?.length) {
                    variant.serials = variant.serials.map((s: any) => ({
                      ...s,
                      id: s._id?.toString(),
                    }));
                  }

                  // pricing
                  if (variant.pricing?.length) {
                    variant.pricing = variant.pricing.map((p: any) => ({
                      ...p,
                      unitprices: p.unitprices?.map((u: any) => ({
                        ...u,
                        unitid: typeof u.unitid === "string"
                          ? { id: u.unitid } 
                          : convertRef(u.unitid)
                      }))
                    }));
                  }

                  return { ...variant, ...stock };
                })
              );
            }

            return mapped;
          })
        );
        
        return response;

      } catch (err) {
        console.error("❌ Error in getProductServices:", err);
        throw new Error("Failed to fetch products / services");
      }
    },

    getProductServiceById: async (_: any, { id, branchId, adminId }: any) => {
      if (!Types.ObjectId.isValid(id)) throw new Error("Invalid product ID");

      const product = await ProductService.findById(id)
        .populate("categoryid", "id categoryname")
        .populate("subcategoryid", "id subcategoryname")
        .populate("groupid", "id productgroupname")
        .populate("modelid", "id modelname")
        .populate("brandid", "id brandname")
        .populate("sizeid", "id sizename")
        .populate("salesaccountid", "id ledgername")
        .populate("purchaseaccountid", "id ledgername")
        .populate("serviceaccountid", "id ledgername")
        .populate("productvariants.baseunitid", "id unitname")
        .populate("productvariants.purchaseunitid", "id unitname")
        .populate("productvariants.unitconversions.unitid", "id unitname")
        .populate("productvariants.pricing.unitprices.unitid", "id unitname") // ✅ add this
        .lean();

      if (!product) return null;

      const adminObjId = adminId ? new Types.ObjectId(adminId) : undefined;
      const branchObjId = branchId ? new Types.ObjectId(branchId) : undefined;

      const convertRef = (obj: any) => {
        if (!obj) return obj;
        const { _id, ...rest } = obj;
        return { id: _id?.toString(), ...rest };
      };

      const response: any = {
        ...product,
        id: product._id?.toString(),
        _id: product._id
      };

      // Convert top refs
      response.categoryid = convertRef(response.categoryid);
      response.subcategoryid = convertRef(response.subcategoryid);
      response.groupid = convertRef(response.groupid);
      response.modelid = convertRef(response.modelid);
      response.brandid = convertRef(response.brandid);
      response.sizeid = convertRef(response.sizeid);
      response.salesaccountid = convertRef(response.salesaccountid);
      response.purchaseaccountid = convertRef(response.purchaseaccountid);
      response.serviceaccountid = convertRef(response.serviceaccountid);

      // ✅ Variant + Pricing + Stock
      if (response.productvariants?.length) {
        response.productvariants = await Promise.all(
          response.productvariants.map(async (v: any) => {
            let stock = await getStockDetails(response.id, adminObjId, branchObjId, v._id);
            if (stock.currentstock === 0) {
              stock = await getStockDetails(response._id, adminObjId, branchObjId);
            }

            const variant: any = {
              ...v,
              id: v._id?.toString(),
              _id: v._id 
            };

            variant.baseunitid = convertRef(variant.baseunitid);
            variant.purchaseunitid = convertRef(variant.purchaseunitid);

            if (variant.unitconversions?.length) {
              variant.unitconversions = variant.unitconversions.map((u:any) => ({
                factor: u.factor,
                unitid: convertRef(u.unitid)
              }));
            }

            if (variant.pricing?.length) {
              variant.pricing = variant.pricing.map((p:any) => ({
                ...p,
                unitprices: p.unitprices?.map((u:any) => ({
                  ...u,
                  unitid: typeof u.unitid === "string"
                    ? { id: u.unitid }
                    : convertRef(u.unitid)
                }))
              }));
            }

            return { ...variant, ...stock };
          })
        );
      }

      response.stock = await getStockDetails(response.id, adminObjId, branchObjId);

      return response;
    }
  },

  Mutation: {
    addProductService: async (_: any, { input }: any) => {

      const created = await ProductService.create(input);
      const savedProduct = await ProductService.findById(created._id);
      if (!savedProduct) throw new Error("Failed to find the created product");

      // Fetch all branches under this admin
      const branches = await Branch.find({ admin: new Types.ObjectId(input.adminid) });

      // For each variant, create stock entry for each branch
      for (const v of savedProduct.productvariants || []) {
        for (const b of branches) {
          const qty = b._id.equals(input.branchid) ? v.openingstock ?? 0 : 0;
          await manageStock({
            adminId: new Types.ObjectId(input.adminid), // ✅ added
            productId: savedProduct._id,
            branchId: b._id,
            variant: v,
            qty,
            unitId: v.baseunitid ? new Types.ObjectId(v.baseunitid) : undefined,
            action: "SET",
            allowCreate: true,
          });
        }
      }

      return savedProduct;
    },

    updateProductService: async (_: any, { id, input }: any) => {

      const product = await ProductService.findById(id);
      if (!product) throw new Error("Product not found");

      const branches = await Branch.find({ admin: new Types.ObjectId(product.adminid) });

      // Prepare variants
      const preparedVariants = (input.productvariants || []).map((v: any) => {
        const variantId = v._id || v.id; // allow either
        return {
          ...v,
          _id: variantId && Types.ObjectId.isValid(variantId)
            ? new Types.ObjectId(variantId)
            : new Types.ObjectId(),
        };
      });

      // Handle stock updates
      for (const pv of preparedVariants) {
        const existingVariant = (product.productvariants || []).find((old: any) =>
          old._id.equals(pv._id)
        );

        if (existingVariant) {

          await manageStock({
            adminId: new Types.ObjectId(product.adminid), // ✅ added
            productId: product._id,
            branchId: new Types.ObjectId(product.branchid),
            variant: pv,
            qty: Number(pv.currentstock ?? 0),
            unitId: pv.baseunitid ? new Types.ObjectId(pv.baseunitid) : undefined,
            action: "SET",
            allowCreate: false,
          });
        } else {
          for (const b of branches) {
            const qty = b._id.equals(product.branchid) ? Number(pv.currentstock ?? 0) : 0;

            await manageStock({
              adminId: new Types.ObjectId(product.adminid), // ✅ added
              productId: product._id,
              branchId: b._id,
              variant: pv,
              qty,
              unitId: pv.baseunitid ? new Types.ObjectId(pv.baseunitid) : undefined,
              action: "SET",
              allowCreate: true,
            });
          }
        }
      }

      product.set({ ...input, productvariants: preparedVariants });
      const updated = await product.save();

      return updated;
    },

    deleteProductService: async (_: any, { id }: { id: string }) => {
      const result = await ProductService.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetProductService: async (_: any, { id }: { id: string }) => {
      const result = await ProductService.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
