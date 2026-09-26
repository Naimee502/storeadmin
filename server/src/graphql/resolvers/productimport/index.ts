import { Types } from "mongoose";
import { ProductService } from "../../../models/products";
import { Branch } from "../../../models/branches";
import { Category } from "../../../models/categories";
import { SubCategory } from "../../../models/subcategories";
import { Brand } from "../../../models/brands";
import { Model } from "../../../models/models";
import { Size } from "../../../models/size";
import { ProductGroup } from "../../../models/productgroups";
import { Unit } from "../../../models/units";
import { AccountLedger } from "../../../models/accountledgers";
import { Admin } from "../../../models/admin";
import { manageStock } from "../../../utils/stockmanager";
import { requireBackofficeTenant, TenantError } from "../../../utils/tenant";
import { validateProductInput } from "../../../utils/productvalidation";
import { ImportMasterPlanner, type ImageOffer } from "../../../utils/importmasters";

/** Which tab of the import workbook each kind of issue belongs to. */
const SHEET_FOR_SCOPE: Record<string, string> = {
  product: "Products",
  variant: "Variants",
  unitconversion: "UnitConversions",
  unitprice: "UnitPrices",
};

/** Same text the client uses, so the review list shows the problem once, with its row. */
const PRODUCT_CODE_DUPLICATE_IN_FILE = (code: string) =>
  `Product code ${code} is used more than once in this file.`;

/** Exact, case-insensitive match for a product code typed by the user. */
const exactCodeRegex = (code: string) =>
  new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

/** Hard ceiling per call, so this endpoint can't be used to hammer the database. */
const MAX_IMPORT_ROWS = 2000;

const toObjectId = (value: any): Types.ObjectId | null => {
  if (!value) return null;
  const raw = typeof value === "object" ? value.id ?? value._id : value;
  const str = String(raw ?? "");
  return Types.ObjectId.isValid(str) ? new Types.ObjectId(str) : null;
};

/**
 * Every reference id that arrives from a spreadsheet is checked against the
 * caller's own admin before it is written. Without this, someone can unhide
 * the ID column in the template, paste another business's category id, and
 * quietly attach their product to it.
 */
const OWNED_REF_MODELS: { model: any; label: string; paths: string[] }[] = [
  { model: Category, label: "Category", paths: ["categoryid"] },
  { model: SubCategory, label: "Sub Category", paths: ["subcategoryid"] },
  { model: Brand, label: "Brand", paths: ["brandid"] },
  { model: Model, label: "Model", paths: ["modelid"] },
  { model: Size, label: "Size", paths: ["sizeid"] },
  { model: ProductGroup, label: "Product Group", paths: ["groupid"] },
  { model: AccountLedger, label: "Account", paths: ["salesaccountid", "purchaseaccountid", "serviceaccountid"] },
];

const collectUnitIds = (product: any): string[] => {
  const ids: string[] = [];
  for (const variant of product?.productvariants || []) {
    if (variant?.baseunitid) ids.push(String(variant.baseunitid));
    if (variant?.purchaseunitid) ids.push(String(variant.purchaseunitid));
    for (const conv of variant?.unitconversions || []) {
      if (conv?.unitid) ids.push(String(conv.unitid));
    }
    for (const price of variant?.unitprices || []) {
      if (price?.unitid) ids.push(String(price.unitid));
    }
  }
  return ids;
};

/** Load the id sets this admin actually owns, once for the whole import. */
const loadOwnedIdSets = async (adminid: Types.ObjectId) => {
  const [categories, subcategories, brands, models, sizes, groups, units, ledgers] = await Promise.all([
    Category.find({ admin: adminid }).select("_id").lean(),
    SubCategory.find({ admin: adminid }).select("_id").lean(),
    Brand.find({ admin: adminid }).select("_id").lean(),
    Model.find({ admin: adminid }).select("_id").lean(),
    Size.find({ admin: adminid }).select("_id").lean(),
    ProductGroup.find({ admin: adminid }).select("_id").lean(),
    Unit.find({ admin: adminid }).select("_id").lean(),
    AccountLedger.find({ admin: adminid }).select("_id").lean(),
  ]);

  const setOf = (docs: any[]) => new Set(docs.map((d) => String(d._id)));

  return {
    Category: setOf(categories),
    SubCategory: setOf(subcategories),
    Brand: setOf(brands),
    Model: setOf(models),
    Size: setOf(sizes),
    ProductGroup: setOf(groups),
    Unit: setOf(units),
    AccountLedger: setOf(ledgers),
  } as Record<string, Set<string>>;
};

const REF_SET_KEYS: Record<string, string> = {
  Category: "Category",
  "Sub Category": "SubCategory",
  Brand: "Brand",
  Model: "Model",
  Size: "Size",
  "Product Group": "ProductGroup",
  Account: "AccountLedger",
};

/** Normalise a product payload's ids, dropping anything the tenant does not own. */
const normaliseProduct = (
  product: any,
  adminid: Types.ObjectId,
  branchid: Types.ObjectId,
  owned: Record<string, Set<string>>,
  issues: { field: string; message: string; sheet: string }[]
) => {
  const normalised: any = { ...product };

  // Tenant fields are stamped, never accepted from the payload.
  normalised.adminid = adminid;
  normalised.branchid = branchid;

  for (const { label, paths } of OWNED_REF_MODELS) {
    const setKey = REF_SET_KEYS[label];
    for (const path of paths) {
      const id = toObjectId(product?.[path]);
      if (!id) {
        normalised[path] = null;
        continue;
      }
      if (!owned[setKey]?.has(String(id))) {
        issues.push({
          field: path,
          message: `${label} does not belong to this business.`,
          sheet: "Products",
        });
        normalised[path] = null;
        continue;
      }
      normalised[path] = id;
    }
  }

  const badUnit = collectUnitIds(product).find((id) => !owned.Unit.has(id));
  if (badUnit) {
    issues.push({
      field: "unitid",
      message: "A unit in this row does not belong to this business.",
      sheet: "Variants",
    });
  }

  normalised.productvariants = (product?.productvariants || []).map((variant: any) => ({
    ...variant,
    baseunitid: toObjectId(variant?.baseunitid),
    purchaseunitid: toObjectId(variant?.purchaseunitid),
    unitconversions: (variant?.unitconversions || []).map((conv: any) => ({
      ...conv,
      unitid: toObjectId(conv?.unitid),
    })),
    unitprices: (variant?.unitprices || []).map((price: any) => ({
      ...price,
      unitid: toObjectId(price?.unitid),
    })),
  }));

  return normalised;
};

export const productImportResolvers = {
  Query: {
    /**
     * Every dropdown list the import template needs, in one round trip.
     * Generating the template used to mean nine separate master queries.
     */
    getProductImportMasters: async (_: any, __: any, context: any) => {
      const tenant = await requireBackofficeTenant(context);
      const adminid = tenant.adminid;

      const [categories, subcategories, brands, models, sizes, groups, units, ledgers] = await Promise.all([
        Category.find({ admin: adminid, status: true }).select("categoryname").sort({ categoryname: 1 }).lean(),
        SubCategory.find({ admin: adminid, status: true }).select("subcategoryname category").sort({ subcategoryname: 1 }).lean(),
        Brand.find({ admin: adminid, status: true }).select("brandname").sort({ brandname: 1 }).lean(),
        Model.find({ admin: adminid, status: true }).select("modelname").sort({ modelname: 1 }).lean(),
        Size.find({ admin: adminid, status: true }).select("sizename").sort({ sizename: 1 }).lean(),
        ProductGroup.find({ admin: adminid, status: true }).select("productgroupname").sort({ productgroupname: 1 }).lean(),
        Unit.find({ admin: adminid, status: true }).select("unitname").sort({ unitname: 1 }).lean(),
        AccountLedger.find({ admin: adminid }).select("ledgername").sort({ ledgername: 1 }).lean(),
      ]);

      const opt = (docs: any[], nameField: string, parentField?: string) =>
        docs.map((d: any) => ({
          id: String(d._id),
          name: String(d[nameField] ?? ""),
          parentid: parentField && d[parentField] ? String(d[parentField]) : null,
        }));

      return {
        adminid: String(adminid),
        branchid: tenant.branchid ? String(tenant.branchid) : null,
        categories: opt(categories, "categoryname"),
        subcategories: opt(subcategories, "subcategoryname", "category"),
        brands: opt(brands, "brandname"),
        models: opt(models, "modelname"),
        sizes: opt(sizes, "sizename"),
        groups: opt(groups, "productgroupname"),
        units: opt(units, "unitname"),
        ledgers: opt(ledgers, "ledgername"),
      };
    },
  },

  Mutation: {
    /**
     * Bulk import.
     *
     * Notes on why it is shaped this way:
     *  - adminid / branchid are absent from the input on purpose. They are
     *    stamped from the verified token on every product.
     *  - dryRun validates and resolves everything without writing. The review
     *    screen shows the SERVER's counts, not the client's guess.
     *  - products are saved sequentially, because the model's pre-save hook
     *    generates #PRD codes and barcodes by reading the current maximum.
     *    Running them in parallel produces duplicates.
     *  - stock fan-out is collected and applied after the documents exist.
     */
    importProductServices: async (_: any, { input }: any, context: any) => {
      const tenant = await requireBackofficeTenant(context);
      const adminid = tenant.adminid;
      const branchid = tenant.branchid;

      if (!branchid) {
        throw new TenantError("Select a branch before importing products.", "BAD_USER_INPUT");
      }

      const products: any[] = Array.isArray(input?.products) ? input.products : [];
      const refs: string[] = Array.isArray(input?.refs) ? input.refs : [];
      const masterNames: any[] = Array.isArray(input?.masters) ? input.masters : [];
      const mode = input?.mode === "UPSERT" ? "UPSERT" : "CREATE";
      const dryRun = !!input?.dryRun;
      const abortOnError = !!input?.abortOnError;

      if (!products.length) {
        return { total: 0, created: 0, updated: 0, skipped: 0, dryRun, newmasters: [], errors: [] };
      }
      if (products.length > MAX_IMPORT_ROWS) {
        throw new TenantError(
          `This import has ${products.length} products. The limit is ${MAX_IMPORT_ROWS} per file — split it and import again.`,
          "BAD_USER_INPUT"
        );
      }

      // Field permissions live on Admin.defaultPermissions (see the
      // permissions resolver), so a field switched off in Business Settings is
      // not demanded here either.
      const adminDoc: any = await Admin.findById(adminid).select("defaultPermissions").lean();
      const permissions: Record<string, boolean> =
        adminDoc?.defaultPermissions?.formPermissions?.products || {};

      const owned = await loadOwnedIdSets(adminid);
      // Every master of this business, inactive included, for find-or-create.
      const planner = await ImportMasterPlanner.load(adminid);

      const errors: any[] = [];
      // Product codes seen so far in this file, lower-cased.
      const seenCodes = new Set<string>();
      const ready: { product: any; ref: string; existingId?: string; offers: ImageOffer[] }[] = [];

      for (let i = 0; i < products.length; i++) {
        const ref = refs[i] || products[i]?.name || `Row ${i + 1}`;
        // `sheet` travels with the issue so the review table and the
        // corrected-file writer put it on the right tab. The server cannot
        // know the spreadsheet ROW — it only ever sees assembled products —
        // so it never guesses one; the client fills that in for the issues it
        // found itself.
        const rowIssues: { field: string; message: string; sheet: string }[] = [];

        const normalised = normaliseProduct(products[i], adminid, branchid, owned, rowIssues);

        // Names typed in the sheet with no id: match an existing master, or
        // plan a new one. Runs before validation so "Category is required"
        // sees the id a new Category is about to get.
        const offers = planner.resolve(normalised, masterNames[i], permissions, rowIssues);

        for (const issue of validateProductInput(normalised, permissions)) {
          rowIssues.push({
            field: issue.field,
            message: issue.message,
            sheet: SHEET_FOR_SCOPE[issue.scope],
          });
        }

        // Product codes typed on this product's variants. A blank one is left
        // blank so the model's pre-save hook assigns the next #PRD number; any
        // other code the user typed (ABC0001, #PRD0042...) is kept as-is.
        const variantCodes: string[] = (normalised.productvariants || []).map((variant: any) => {
          const code = String(variant?.productcode ?? "").trim();
          if (variant) {
            if (code) variant.productcode = code;
            else delete variant.productcode;
          }
          return code;
        });

        // Does this product already exist for this tenant? Matched on its first
        // code, case-insensitively — "abc0001" and "ABC0001" are the same code.
        const productCode = variantCodes.find(Boolean);
        let existingId: string | undefined;
        if (productCode) {
          const existing: any = await ProductService.findOne({
            adminid,
            branchid,
            "productvariants.productcode": exactCodeRegex(productCode),
          }).select("_id").lean();
          if (existing) existingId = String(existing._id);
        }

        if (existingId && mode === "CREATE") {
          rowIssues.push({
            field: "productcode",
            message: `Product code ${productCode} already exists. Switch to "Update existing" to overwrite it.`,
            sheet: "Variants",
          });
        }

        // Every code must be unique — within this file, and in this branch
        // unless it already belongs to the very product being updated.
        for (const code of variantCodes) {
          if (!code) continue;
          const key = code.toLowerCase();
          if (seenCodes.has(key)) {
            rowIssues.push({
              field: "productcode",
              message: PRODUCT_CODE_DUPLICATE_IN_FILE(code),
              sheet: "Variants",
            });
            continue;
          }
          seenCodes.add(key);
          if (code === productCode) continue; // checked just above

          const owner: any = await ProductService.findOne({
            adminid,
            branchid,
            "productvariants.productcode": exactCodeRegex(code),
          }).select("_id").lean();
          if (owner && String(owner._id) !== existingId) {
            rowIssues.push({
              field: "productcode",
              message: `Product code ${code} is already used by another product.`,
              sheet: "Variants",
            });
          }
        }

        if (rowIssues.length) {
          // The same problem can surface from two slots (an inactive unit used
          // as both Base and Purchase unit) — report it once.
          rowIssues
            .filter((issue, idx, all) =>
              all.findIndex((o) => o.sheet === issue.sheet && o.message === issue.message) === idx
            )
            .forEach((issue) =>
            errors.push({
              ref,
              sheet: issue.sheet,
              // `i` is the product's position in the payload, not a row in the
              // user's file. Reporting it as a row sent them to an unrelated
              // line and coloured the wrong cell in the corrected workbook.
              row: null,
              field: issue.field,
              message: issue.message,
            })
          );
          continue;
        }

        ready.push({ product: normalised, ref, existingId, offers });
      }

      const skipped = products.length - ready.length;

      if (dryRun) {
        return {
          total: products.length,
          created: ready.filter((r) => !r.existingId).length,
          updated: ready.filter((r) => !!r.existingId).length,
          skipped,
          dryRun: true,
          newmasters: planner.pendingFor(ready.map((r) => r.product)),
          errors,
        };
      }

      if (abortOnError && errors.length) {
        return { total: products.length, created: 0, updated: 0, skipped: products.length, dryRun: false, newmasters: [], errors };
      }

      // Create the new masters the saved products need — and only those, so a
      // product that failed validation never leaves a stray Category behind.
      const commit = await planner.commit(
        ready.map((r) => r.product),
        ready.flatMap((r) => r.offers)
      );
      for (let k = ready.length - 1; k >= 0; k--) {
        const failure = ImportMasterPlanner.applyCommit(ready[k].product, commit);
        if (failure) {
          errors.push({ ref: ready[k].ref, sheet: "Products", row: null, field: null, message: failure });
          ready.splice(k, 1);
        }
      }

      const branches = await Branch.find({ admin: adminid }).select("_id").lean();
      const savedIds: Types.ObjectId[] = [];
      let created = 0;
      let updated = 0;

      for (const item of ready) {
        try {
          if (item.existingId) {
            const doc: any = await ProductService.findOne({ _id: item.existingId, adminid });
            if (!doc) {
              errors.push({ ref: item.ref, sheet: null, row: null, field: null, message: "Product disappeared during import." });
              continue;
            }
            Object.assign(doc, item.product);
            doc.adminid = adminid;
            doc.branchid = branchid;
            await doc.save();
            savedIds.push(doc._id);
            updated++;
          } else {
            const doc: any = await ProductService.create(item.product);
            savedIds.push(doc._id);
            created++;
          }
        } catch (err: any) {
          errors.push({
            ref: item.ref,
            sheet: null,
            row: null,
            field: null,
            message: err?.message || "Could not save this product.",
          });
        }
      }

      // Stock fan-out, after the documents exist. Done here rather than inside
      // the loop so a 500-product import doesn't interleave thousands of
      // per-branch writes with the saves.
      for (const productId of savedIds) {
        const doc: any = await ProductService.findById(productId);
        if (!doc) continue;
        for (const variant of doc.productvariants || []) {
          for (const branch of branches) {
            const qty = String(branch._id) === String(branchid) ? variant.openingstock ?? 0 : 0;
            await manageStock({
              adminId: adminid,
              productId: doc._id,
              branchId: branch._id,
              variant,
              qty,
              unitId: variant.baseunitid ? variant.baseunitid : undefined,
              action: "SET",
              allowCreate: true,
            });
          }
        }
      }

      return {
        total: products.length,
        created,
        updated,
        skipped: products.length - (created + updated),
        dryRun: false,
        newmasters: commit.created,
        errors,
      };
    },
  },
};
