import { ProductService } from "../../../models/products";
import { Types } from "mongoose";
import { getAvailableStock, manageStock } from "../../../utils/stockmanager";
import { ProductBranchStock } from "../../../models/productbranchstock";
import { Branch } from "../../../models/branches";

export const productServiceResolvers = {
  Query: {
    getProductServices: async (_: any, { filter = {}, limit, offset }: any) => {
      const query: any = { status: filter.status !== undefined ? filter.status : true };

      [
        "adminid",
        "vendorid",
        "productcode",
        "productbarcode",
        "servicecode",
        "servicebarcode",
        "isservice",
        "isfeatured",
        "isshowinpos",
        "categoryid",
        "subcategoryid",
        "groupid",
        "modelid",
        "brandid",
        "sizeid",
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
                let stock = await getAvailableStock(mapped._id, adminId, branchId, v._id);

                // 👉 Fallback if variant-level stock not found
                if (stock === 0) {
                  stock = await getAvailableStock(mapped._id, adminId, branchId);
                }

                return { ...v, currentstock: stock };
              })
            );
          }

          // 🔹 Always calculate product-level stock
          mapped.currentstock = await getAvailableStock(mapped._id, adminId, branchId);

          return mapped;
        })
      );

      return response;
    },

    getProductServiceById: async (_: any, { id, branchId, adminId }: any) => {
      if (!Types.ObjectId.isValid(id)) throw new Error("Invalid product ID");

      const product = await ProductService.findById(id);
      if (!product) return null;

      const response: any = product.toObject(); // 👈 cast to any
      response.id = response._id.toString();

      const adminObjId = adminId ? new Types.ObjectId(adminId) : undefined;
      const branchObjId = branchId ? new Types.ObjectId(branchId) : undefined;

      // 🔹 Handle variant-level stock with fallback
      if (response.productvariants?.length) {
        response.productvariants = await Promise.all(
          response.productvariants.map(async (v: any) => {
            let stock = await getAvailableStock(
              response._id,
              adminObjId,
              branchObjId,
              v._id
            );

            // 👉 fallback to product-level stock if variant-level stock missing
            if (stock === 0) {
              stock = await getAvailableStock(response._id, adminObjId, branchObjId);
            }

            return {
              ...v,
              id: v._id?.toString(),
              currentstock: stock, // 👈 safe now
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

      // 🔹 Product-level stock
      response.currentstock = await getAvailableStock(
        response._id,
        adminObjId,
        branchObjId
      );

      return response;
    },

  },

  Mutation: {
    addProductService: async (_: any, { input }: any) => {
      const created = await ProductService.create(input);
      const savedProduct = await ProductService.findById(created._id);
      if (!savedProduct) throw new Error("Failed to find the created product");

      await Promise.all(
        (savedProduct.productvariants || []).map((v: any) =>
          manageStock({
            productId: savedProduct._id,
            branchId: input.branchid,
            variant: v,
            qty: v.openingstock ?? 0,
            action: "CREATE_PRODUCT",
          })
        )
      );

      return savedProduct;
    },

    updateProductService: async (_: any, { id, input }: any) => {
      console.log("🔹 Updating product:", id);

      const product = await ProductService.findById(id);
      if (!product) throw new Error("Product not found");

      // Fetch ALL branches for this admin
      const branches = await Branch.find({ admin: new Types.ObjectId(product.adminid) });
      console.log(`🏢 Found ${branches.length} branches for admin=${product.adminid}`);

      // Normalize variants
      const preparedVariants = (input.productvariants || []).map((v: any) => {
        const providedId = v.id ?? v._id;
        const isValidId = providedId && Types.ObjectId.isValid(providedId);
        const assignedId = isValidId ? new Types.ObjectId(providedId) : new Types.ObjectId();

        if (!isValidId) {
          console.log(`🆕 New variant "${v.name}" → assigned _id: ${assignedId}`);
        } else {
          console.log(`♻️ Existing variant "${v.name}" → using _id: ${assignedId}`);
        }

        const { tempid, __typename, ...rest } = v;
        return { ...rest, _id: assignedId, id: assignedId.toString() };
      });

      // Loop each variant and sync stock
      for (const pv of preparedVariants) {
        const vid = pv._id;
        const newQty = Number(pv.currentstock ?? 0);

        console.log(`\n🔍 Processing variant ${pv.name} (${vid.toString()}) with stock=${newQty}`);

        // For existing variants → only update current branch
        if ((product.productvariants ?? []).some((old: any) => old._id.equals(vid))) {
          await manageStock({
            productId: product._id,
            branchId: new Types.ObjectId(product.branchid),
            variant: pv,
            qty: newQty,
            unitId: pv.baseunitid ? new Types.ObjectId(pv.baseunitid) : undefined,
            action: "SET",
            allowCreate: true,
          });
        } else {
          // For new variants → create stock row in ALL branches
          for (const b of branches) {
            await manageStock({
              productId: product._id,
              branchId: b._id,
              variant: pv,
              qty: b._id.equals(product.branchid) ? newQty : 0, // only assign input qty to current branch
              unitId: pv.baseunitid ? new Types.ObjectId(pv.baseunitid) : undefined,
              action: "SET",
              allowCreate: true,
            });
          }
        }
      }

      // Save product itself
      product.set({
        ...input,
        productvariants: preparedVariants,
      });

      const updated = await product.save();
      console.log("✅ Product fields updated & stock synced");

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
