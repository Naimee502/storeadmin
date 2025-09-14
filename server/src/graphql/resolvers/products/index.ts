import { ProductService } from "../../../models/products";
import { Types } from "mongoose";
import { getStockDetails, manageStock } from "../../../utils/stockmanager";
import { Branch } from "../../../models/branches";

export const productServiceResolvers = {
  Query: {
    getProductServices: async (_: any, { filter = {}, limit, offset }: any) => {
      const query: any = { status: filter.status !== undefined ? filter.status : true };

      [
        "adminid", "vendorid", "productcode", "productbarcode", "servicecode", "servicebarcode",
        "isservice", "isfeatured", "isshowinpos", "categoryid", "subcategoryid", "groupid",
        "modelid", "brandid", "sizeid",
      ].forEach((key) => {
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
      let productsQuery = ProductService.find(query);
      if (offset) productsQuery = productsQuery.skip(offset);
      if (limit) productsQuery = productsQuery.limit(limit);

      const products = await productsQuery.exec();
      const adminId = filter.adminid ? new Types.ObjectId(filter.adminid) : undefined;
      const branchId = filter.branchid ? new Types.ObjectId(filter.branchid) : undefined;

      const mapNestedIds = (product: any) => {
        const p = product.toObject();
        p.id = p._id.toString();
        if (p.productvariants) {
          p.productvariants = p.productvariants.map((v: any) => ({
            ...v,
            id: v._id?.toString(),
            serials: v.serials?.map((s: any) => ({ ...s, id: s._id?.toString() })),
          }));
        }
        if (p.servicevariants) {
          p.servicevariants = p.servicevariants.map((sv: any) => ({
            ...sv,
            id: sv._id?.toString(),
          }));
        }
        return p;
      };

      const response = await Promise.all(
        products.map(async (p) => {
          const mapped = mapNestedIds(p);

          // 🔹 Handle variant stock with fallback
          if (mapped.productvariants?.length) {
            mapped.productvariants = await Promise.all(
              mapped.productvariants.map(async (v: any) => {
                let stockDetails = await getStockDetails(mapped._id, adminId, branchId, v._id);

                // 👉 Fallback if variant-level stock not found
                if (stockDetails.currentstock === 0) {
                  stockDetails = await getStockDetails(mapped._id, adminId, branchId);
                }

                return { ...v, ...stockDetails };
              })
            );
          }

          // 🔹 Always calculate product-level stock
          mapped.stock = await getStockDetails(mapped._id, adminId, branchId);

          return mapped;
        })
      );

      return response;
    },

    getProductServiceById: async (_: any, { id, branchId, adminId }: any) => {
      if (!Types.ObjectId.isValid(id)) throw new Error("Invalid product ID");

      const product = await ProductService.findById(id);
      if (!product) return null;

      const response: any = product.toObject();
      response.id = response._id.toString();

      const adminObjId = adminId ? new Types.ObjectId(adminId) : undefined;
      const branchObjId = branchId ? new Types.ObjectId(branchId) : undefined;

      // 🔹 Handle product variants with stock details
      if (response.productvariants?.length) {
        response.productvariants = await Promise.all(
          response.productvariants.map(async (v: any) => {
            let stockDetails = await getStockDetails(
              response._id,
              adminObjId,
              branchObjId,
              v._id
            );

            // 👉 fallback to product-level stock if variant-level stock missing
            if (
              stockDetails.currentstock === 0 &&
              stockDetails.openingstock === 0 &&
              stockDetails.closingstock === 0
            ) {
              stockDetails = await getStockDetails(
                response._id,
                adminObjId,
                branchObjId
              );
            }

            return {
              ...v,
              id: v._id?.toString(),
              ...stockDetails, // 👈 attach all stock fields
            };
          })
        );
      }

      // 🔹 Service variants
      if (response.servicevariants) {
        response.servicevariants = response.servicevariants.map((sv: any) => ({
          ...sv,
          id: sv._id?.toString(),
        }));
      }

      // 🔹 Product-level stock details
      response.stock = await getStockDetails(response._id, adminObjId, branchObjId);

      return response;
    },

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
