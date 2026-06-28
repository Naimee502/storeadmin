import { Types } from "mongoose";
import { ProductService } from "../../../models/products";
import { getStockDetails, manageStock } from "../../../utils/stockmanager";
import { Branch } from "../../../models/branches";
import { ProductBranchStock } from "../../../models/productbranchstock";

function normalizeId(value: any) {
  if (!value) return null;

  // If object: use its id/_id
  if (typeof value === "object") {
    if (value.id && Types.ObjectId.isValid(value.id)) {
      return new Types.ObjectId(value.id);
    }
    if (value._id && Types.ObjectId.isValid(value._id)) {
      return new Types.ObjectId(value._id);
    }
  }

  // If already string ObjectId
  if (typeof value === "string" && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }

  return null;
}

function normalizeVariant(v: any) {
  return {
    ...v,
    baseunitid: normalizeId(v.baseunitid),
    purchaseunitid: normalizeId(v.purchaseunitid),

    unitconversions: (v.unitconversions || []).map((uc: any) => ({
      ...uc,
      unitid: normalizeId(uc.unitid),
    })),

    unitprices: (v.unitprices || []).map((u: any) => ({
      ...u,
      unitid: normalizeId(u.unitid),
    })),
  };
}

function convertRef(obj: any) {
  if (!obj) return null;
  const { _id, ...rest } = obj;
  return { id: _id?.toString(), ...rest };
}

function mapVariantForResponse(v: any) {
  const variant: any = {
    ...v,
    id: v._id?.toString(),
    _id: v._id,
  };

  variant.baseunitid = convertRef(variant.baseunitid);
  variant.purchaseunitid = convertRef(variant.purchaseunitid);

  if (variant.unitconversions?.length) {
    variant.unitconversions = variant.unitconversions.map((u: any) => ({
      factor: u.factor,
      unitid: convertRef(u.unitid),
    }));
  }

  if (variant.serials?.length) {
    variant.serials = variant.serials.map((s: any) => ({
      ...s,
      id: s._id?.toString?.() ?? undefined,
    }));
  }

  if (variant.unitprices?.length) {
    variant.unitprices = variant.unitprices.map((up: any) => ({
      ...up,
      unitid: typeof up.unitid === "string" ? { id: up.unitid } : convertRef(up.unitid),
    }));
  }

  return variant;
}

export const productServiceResolvers = {
  Query: {
    getProductServices: async (_: any, { filter = {}, limit = 50, offset = 0 }: any) => {
      try {
        const query: any = {};
        query.status = typeof filter.status === "boolean" ? filter.status : true;

        // NOTE: "branchid" intentionally excluded here — a product's own branchid
        // only records the branch it was created in. We resolve branch visibility
        // separately below so transferred-in stock (which lives in
        // productbranchstocks, not on the product) also surfaces in that branch.
        const directKeys = [
          "adminid", "vendorid", "productcode", "productbarcode",
          "servicecode", "servicebarcode", "isservice", "isfeatured", "isshowinpos",
          "categoryid", "subcategoryid", "groupid", "modelid", "brandid", "sizeid"
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

        // Branch-aware visibility: a product shows in a branch if it was created
        // there (product.branchid) OR it has any stock record in that branch
        // (e.g. received via a stock transfer).
        if (filter.branchid && filter.branchid !== "") {
          const branchFilterId = new Types.ObjectId(filter.branchid);
          const stockProductIds = await ProductBranchStock.find({ branchid: branchFilterId })
            .distinct("productid");
          query.$or = [
            { branchid: branchFilterId },
            { _id: { $in: stockProductIds } },
          ];
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
          .populate({ path: "productvariants.unitprices.unitid", select: "id unitname" })
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

                  // ✅ Use unified mapping
                  const variantMapped = mapVariantForResponse(v);
                  return { ...variantMapped, ...stock };
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
        .populate("productvariants.unitprices.unitid", "id unitname")
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

            // ✅ Use unified mapping
            const variantMapped = mapVariantForResponse(v);
            return { ...variantMapped, ...stock };
          })
        );
      }

      response.stock = await getStockDetails(response.id, adminObjId, branchObjId);

      return response;
    }
  },

  Mutation: {
    addProductService: async (_: any, { input }: any) => {
      try {
        
        input.adminid = normalizeId(input.adminid);
        input.branchid = normalizeId(input.branchid);
        input.categoryid = normalizeId(input.categoryid);
        input.subcategoryid = normalizeId(input.subcategoryid);
        input.groupid = normalizeId(input.groupid);
        input.modelid = normalizeId(input.modelid);
        input.brandid = normalizeId(input.brandid);
        input.sizeid = normalizeId(input.sizeid);
        input.salesaccountid = normalizeId(input.salesaccountid);
        input.purchaseaccountid = normalizeId(input.purchaseaccountid);
        input.serviceaccountid = normalizeId(input.serviceaccountid);

        input.productvariants = (input.productvariants || []).map(normalizeVariant);

        const created = await ProductService.create(input);

        // Re-fetch the created product with all populates and as plain object (lean)
        const savedProductPopulated = await ProductService.findById(created._id)
          .populate({ path: "categoryid", select: "categoryname" })
          .populate({ path: "subcategoryid", select: "subcategoryname" })
          .populate({ path: "groupid", select: "productgroupname" })
          .populate({ path: "modelid", select: "modelname" })
          .populate({ path: "brandid", select: "brandname" })
          .populate({ path: "sizeid", select: "sizename" })

          .populate({ path: "productvariants.baseunitid", select: "unitname" })
          .populate({ path: "productvariants.purchaseunitid", select: "unitname" })
          .populate({ path: "productvariants.unitconversions.unitid", select: "unitname" })
          .populate({ path: "productvariants.unitprices.unitid", select: "unitname" })
          .populate({ path: "salesaccountid", select: "ledgername" })
          .populate({ path: "purchaseaccountid", select: "ledgername" })
          .populate({ path: "serviceaccountid", select: "ledgername" })
          .lean();

        if (!savedProductPopulated) {
          throw new Error("Failed to find created product");
        }

        const branches = input.adminid
          ? await Branch.find({ admin: input.adminid })
          : [];

        const savedProductForStock = await ProductService.findById(created._id);
        if (!savedProductForStock) {
          throw new Error("Failed to load product for stock creation");
        }

        for (const v of savedProductForStock.productvariants || []) {
          for (const b of branches) {
            const qty = b._id.equals(input.branchid) ? (v.openingstock ?? 0) : 0;

            await manageStock({
              adminId: input.adminid, 
              productId: savedProductForStock._id,
              branchId: b._id,
              variant: v,
              qty,
              unitId: v.baseunitid ? v.baseunitid : undefined,
              action: "SET",
              allowCreate: true,
            });
          }
        }

        const responseObj: any = {
          ...savedProductPopulated,
          id: savedProductPopulated._id?.toString(),
          _id: savedProductPopulated._id,
        };

        // convert top-level refs
        responseObj.categoryid = convertRef(responseObj.categoryid);
        responseObj.subcategoryid = convertRef(responseObj.subcategoryid);
        responseObj.groupid = convertRef(responseObj.groupid);
        responseObj.modelid = convertRef(responseObj.modelid);
        responseObj.brandid = convertRef(responseObj.brandid);
        responseObj.sizeid = convertRef(responseObj.sizeid);
        responseObj.salesaccountid = convertRef(responseObj.salesaccountid);
        responseObj.purchaseaccountid = convertRef(responseObj.purchaseaccountid);
        responseObj.serviceaccountid = convertRef(responseObj.serviceaccountid);

        // variants: map and attach stock (use getStockDetails)
        if (responseObj.productvariants?.length) {
          const adminIdForStock = input.adminid;
          const branchIdForStock = input.branchid;
          responseObj.productvariants = await Promise.all(
            responseObj.productvariants.map(async (v: any) => {
              const variantMapped = mapVariantForResponse(v);
              let stock = await getStockDetails(responseObj._id, adminIdForStock, branchIdForStock, v._id);
              if (!stock || stock.currentstock === 0) {
                stock = await getStockDetails(responseObj._id, adminIdForStock, branchIdForStock);
              }

              return { ...variantMapped, ...stock };
            })
          );
        }

        // Also attach overall stock
        responseObj.stock = await getStockDetails(responseObj._id, input.adminid, input.branchid);

        // Return the prepared object (no raw ObjectId/Buffer fields in populated refs)
        return responseObj;
      } catch (err: any) {
        console.error("❌ Error in addProductService:", err);
        // Re-throw so GraphQL sees the error message (but avoid returning a raw mongoose doc)
        throw err;
      }
    },

    updateProductService: async (_: any, { id, input }: any) => {
      try {
        const existing = await ProductService.findById(id);
        if (!existing) throw new Error("Product not found");

        // -----------------------------------------
        // ✅ FIX: Capture OLD SKUs (stable identifier)
        // -----------------------------------------
        const oldVariantSkus = existing?.productvariants?.map((v: any) => v.sku);

        const convertRefSafe = (obj: any) => {
          if (!obj) return { id: "", ledgername: "", modelname: "" };
          const { _id, ledgername, modelname, ...rest } = obj;
          return {
            id: _id?.toString() ?? "",
            ledgername: ledgername ?? "",
            modelname: modelname ?? "", // <-- ensure nullable
            ...rest,
          };
        };

        // Normalize object id fields
        [
          "adminid", "branchid", "categoryid", "subcategoryid",
          "groupid", "modelid", "brandid", "sizeid",
          "salesaccountid", "purchaseaccountid", "serviceaccountid"
        ].forEach((key) => {
          input[key] = normalizeId(input[key]);
        });

        // ---------------------------
        // Normalize Variants
        // ---------------------------
        const normalizedVariants = (input.productvariants || []).map((v: any) => {
          const varId = v._id || v.id;

          return {
            ...v,
            _id:
              varId && Types.ObjectId.isValid(varId)
                ? new Types.ObjectId(varId)
                : new Types.ObjectId(),

            baseunitid: normalizeId(v.baseunitid),
            purchaseunitid: normalizeId(v.purchaseunitid),

            unitconversions: (v.unitconversions || []).map((u: any) => ({
              unitid: normalizeId(u.unitid),
              factor: u.factor,
            })),

            serials: (v.serials || []).map((s: any) => ({
              ...s,
              _id:
                s._id && Types.ObjectId.isValid(s._id)
                  ? new Types.ObjectId(s._id)
                  : new Types.ObjectId(),
            })),

            unitprices: (v.unitprices || []).map((up: any) => ({
              ...up,
              unitid: normalizeId(up.unitid),
            })),
          };
        });

        // ---------------------------
        // Update Product
        // ---------------------------
        existing.set({
          ...input,
          productvariants: normalizedVariants,
        });

        const saved = await existing.save();

        const adminId = input.adminid;
        const mainBranchId = input.branchid;

        const branches = await Branch.find({ admin: adminId });

        const fresh = await ProductService.findById(saved._id);

        // ---------------------------
        // Stock Handling (FIXED)
        // ---------------------------
        for (const v of fresh?.productvariants || []) {
          const isExisting = oldVariantSkus?.includes(v?.sku);

          if (isExisting) {
            // --------------------------------
            // Existing Variant → Only update main branch
            // --------------------------------
            await manageStock({
              adminId,
              productId: saved._id,
              branchId: mainBranchId,
              variant: v,
              qty: v.currentstock ?? 0,
              unitId: v.baseunitid,
              action: "SET",
              allowCreate: false,
            });

          } else {
            // --------------------------------
            // NEW VARIANT → Create in ALL branches
            // --------------------------------
            for (const b of branches) {
              const qty = b._id.equals(mainBranchId) ? (v.currentstock ?? 0) : 0;

              await manageStock({
                adminId,
                productId: saved._id,
                branchId: b._id,
                variant: v,
                qty,
                unitId: v.baseunitid,
                action: "SET",
                allowCreate: true,
              });
            }
          }
        }

        // ---------------------------
        // Populate For Response
        // ---------------------------
        const populated = await ProductService.findById(saved._id)
          .populate({ path: "categoryid", select: "categoryname" })
          .populate({ path: "subcategoryid", select: "subcategoryname" })
          .populate({ path: "groupid", select: "productgroupname" })
          .populate({ path: "modelid", select: "modelname" })
          .populate({ path: "brandid", select: "brandname" })
          .populate({ path: "sizeid", select: "sizename" })
          .populate({ path: "productvariants.baseunitid", select: "unitname" })
          .populate({ path: "productvariants.purchaseunitid", select: "unitname" })
          .populate({ path: "productvariants.unitconversions.unitid", select: "unitname" })
          .populate({ path: "productvariants.unitprices.unitid", select: "unitname" })
          .populate({ path: "salesaccountid", select: "ledgername" })
          .populate({ path: "purchaseaccountid", select: "ledgername" })
          .populate({ path: "serviceaccountid", select: "ledgername" })
          .lean();

        const res: any = {
          ...populated,
          id: populated?._id?.toString(),
        };

        // Normalize refs
        res.modelid = convertRefSafe(res.modelid);
        res.salesaccountid = convertRefSafe(res.salesaccountid);
        res.purchaseaccountid = convertRefSafe(res.purchaseaccountid);
        res.serviceaccountid = convertRefSafe(res.serviceaccountid);
        res.categoryid = convertRefSafe(res.categoryid);
        res.subcategoryid = convertRefSafe(res.subcategoryid);
        res.groupid = convertRefSafe(res.groupid);
        res.brandid = convertRefSafe(res.brandid);
        res.sizeid = convertRefSafe(res.sizeid);

        // Attach stock values to each variant
        res.productvariants = await Promise.all(
          (res.productvariants || []).map(async (v: any) => {
            const mapped = mapVariantForResponse(v);
            let stock = await getStockDetails(saved._id, adminId, mainBranchId, v._id);

            if (!stock || stock?.currentstock === 0) {
              stock = await getStockDetails(saved._id, adminId, mainBranchId);
            }

            return { ...mapped, ...stock };
          })
        );

        res.stock = await getStockDetails(saved._id, adminId, mainBranchId);

        return res;

      } catch (err) {
        console.error("❌ updateProductService error:", err);
        throw err;
      }
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
