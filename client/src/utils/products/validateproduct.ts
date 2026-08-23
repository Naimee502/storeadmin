import { belowCostError } from "../rates";

/**
 * Product validation, in one place.
 *
 * This used to live inline in pages/products/addedit as validateForm(). It was
 * lifted out so the add/edit form, the spreadsheet importer and the server all
 * apply exactly the same rules — otherwise a product rejected by the form can
 * still walk in through an import, and the two sets of rules drift apart the
 * first time either is touched.
 *
 * The function is pure: it takes a product-shaped object and returns problems.
 * It does no React, no Redux and no network, so the importer and the server can
 * both call it.
 *
 * Two output shapes are produced from the same pass:
 *   - `errors`  — the nested object the add/edit form already renders from.
 *   - `issues`  — a flat list, which is what a row-by-row import report needs.
 */

export type FieldPermissions = Record<string, boolean | undefined>;

export interface ValidationIssue {
  /** Dotted path, e.g. "productvariants.0.unitprices.2.salesrate" */
  path: string;
  /** Bare field id, e.g. "salesrate" — matches the form permission ids. */
  field: string;
  message: string;
  /** Index of the variant this belongs to, when applicable. */
  variantIndex?: number;
  /** Index within unitconversions / unitprices, when applicable. */
  rowIndex?: number;
  /** Which part of the workbook this maps to. */
  scope: "product" | "variant" | "unitconversion" | "unitprice";
}

export interface ValidationResult {
  valid: boolean;
  errors: any;
  issues: ValidationIssue[];
}

/** Stock quantities and values that must never be negative. */
export const NON_NEGATIVE_FIELDS: Record<string, string> = {
  openingstock: "Opening stock",
  openingstockamount: "Opening stock amount",
  currentstock: "Current stock",
  currentstockamount: "Current stock amount",
  closingstock: "Closing stock",
  closingstockamount: "Closing stock amount",
  minimumstock: "Minimum stock",
  reorderlevel: "Reorder level",
};

export const isEmptyDeep = (obj: any): boolean => {
  if (obj === null || obj === undefined || obj === "") return true;
  if (Array.isArray(obj)) return obj.every(isEmptyDeep);
  if (typeof obj === "object") return Object.values(obj).every(isEmptyDeep);
  return false;
};

/**
 * A field only counts as required if it is actually switched on in Business
 * Settings → Form Permissions. Turning "Category" off in the form and then
 * having the importer demand it would be incoherent.
 */
const enabled = (permissions: FieldPermissions | undefined, fieldId: string) =>
  !permissions || permissions[fieldId] !== false;

export const validateProduct = (
  product: any,
  permissions?: FieldPermissions
): ValidationResult => {
  const errors: any = {};
  const issues: ValidationIssue[] = [];

  const on = (fieldId: string) => enabled(permissions, fieldId);

  const push = (
    issue: Omit<ValidationIssue, "scope"> & { scope: ValidationIssue["scope"] }
  ) => issues.push(issue);

  /* ------------------------- product level ------------------------- */

  if (on("name") && !String(product?.name ?? "").trim()) {
    errors.name = "Product name is required";
    push({ path: "name", field: "name", message: errors.name, scope: "product" });
  }

  if (on("categoryid") && !product?.categoryid) {
    errors.categoryid = "Category is required";
    push({ path: "categoryid", field: "categoryid", message: errors.categoryid, scope: "product" });
  }

  if (on("salesaccount") && !product?.salesaccountid) {
    errors.salesaccountid = "Sales account is required";
    push({ path: "salesaccountid", field: "salesaccount", message: errors.salesaccountid, scope: "product" });
  }

  if (on("purchaseaccount") && !product?.purchaseaccountid) {
    errors.purchaseaccountid = "Purchase account is required";
    push({ path: "purchaseaccountid", field: "purchaseaccount", message: errors.purchaseaccountid, scope: "product" });
  }

  /* ------------------------- variants ------------------------- */

  if (product?.isservice) {
    return { valid: isEmptyDeep(errors), errors, issues };
  }

  const variants: any[] = Array.isArray(product?.productvariants) ? product.productvariants : [];

  if (!variants.length) {
    errors.productvariants = "At least 1 product variant is required";
    push({
      path: "productvariants",
      field: "productvariants",
      message: errors.productvariants,
      scope: "product",
    });
    return { valid: false, errors, issues };
  }

  const variantErrorsArray: any[] = [];

  variants.forEach((variant: any, vIndex: number) => {
    const variantErrors: any = {};
    const at = (field: string, message: string, scope: ValidationIssue["scope"] = "variant", rowIndex?: number) =>
      push({
        path:
          rowIndex === undefined
            ? `productvariants.${vIndex}.${field}`
            : `productvariants.${vIndex}.${scope === "unitprice" ? "unitprices" : "unitconversions"}.${rowIndex}.${field}`,
        field,
        message,
        variantIndex: vIndex,
        rowIndex,
        scope,
      });

    if (on("baseunitid") && !variant?.baseunitid) {
      variantErrors.baseunitid = "Base unit is required";
      at("baseunitid", variantErrors.baseunitid);
    }

    if (on("purchaseunitid") && !variant?.purchaseunitid) {
      variantErrors.purchaseunitid = "Purchase unit is required";
      at("purchaseunitid", variantErrors.purchaseunitid);
    }

    if (on("purchaserate") && (!variant?.purchaserate || Number(variant.purchaserate) <= 0)) {
      variantErrors.purchaserate = "Purchase rate must be greater than 0";
      at("purchaserate", variantErrors.purchaserate);
    }

    Object.entries(NON_NEGATIVE_FIELDS).forEach(([field, label]) => {
      const raw = variant?.[field];
      if (raw === "" || raw === null || raw === undefined) return;
      if (Number.isNaN(Number(raw))) {
        variantErrors[field] = `${label} must be a number.`;
        at(field, variantErrors[field]);
        return;
      }
      if (Number(raw) < 0) {
        variantErrors[field] = `${label} cannot be negative.`;
        at(field, variantErrors[field]);
      }
    });

    /* ---- unit conversions ---- */
    const conversions: any[] = Array.isArray(variant?.unitconversions) ? variant.unitconversions : [];

    if (!conversions.length) {
      variantErrors.unitconversions = "At least 1 unit conversion is required";
      at("unitconversions", variantErrors.unitconversions);
    } else {
      const convErrorsArr: any[] = [];
      conversions.forEach((conv: any, cIndex: number) => {
        const convErrors: any = {};
        if (on("unitconversions_unitid") && !conv?.unitid) {
          convErrors.unitid = "Unit is required";
          at("unitid", convErrors.unitid, "unitconversion", cIndex);
        }
        if (on("factor") && (!conv?.factor || Number(conv.factor) <= 0)) {
          convErrors.factor = "Factor must be greater than 0";
          at("factor", convErrors.factor, "unitconversion", cIndex);
        }
        // Indexed, not pushed. The UI reads errors.productvariants[i]
        // .unitconversions[convIndex], so a compacted array would show row 3's
        // problem against row 1 and leave row 3 looking fine.
        if (Object.keys(convErrors).length) convErrorsArr[cIndex] = convErrors;
      });
      if (convErrorsArr.filter(Boolean).length) variantErrors.unitconversions = convErrorsArr;
    }

    /* ---- unit prices ---- */
    const prices: any[] = Array.isArray(variant?.unitprices) ? variant.unitprices : [];

    if (!prices.length) {
      variantErrors.unitprices = "At least 1 unit price is required";
      at("unitprices", variantErrors.unitprices);
    } else {
      const priceErrorsArr: any[] = [];
      prices.forEach((price: any, pIndex: number) => {
        const priceErrors: any = {};

        if (on("unitprices_unitid") && !price?.unitid) {
          priceErrors.unitid = "Unit is required";
          at("unitid", priceErrors.unitid, "unitprice", pIndex);
        }

        if (on("quantity") && (!price?.quantity || Number(price.quantity) <= 0)) {
          priceErrors.quantity = "Quantity must be greater than 0";
          at("quantity", priceErrors.quantity, "unitprice", pIndex);
        }

        if (on("salesrate")) {
          if (!price?.salesrate || Number(price.salesrate) <= 0) {
            priceErrors.salesrate = "Sales rate must be greater than 0";
            at("salesrate", priceErrors.salesrate, "unitprice", pIndex);
          } else {
            const belowCost = belowCostError(variant, price.unitid, price.salesrate);
            if (belowCost) {
              priceErrors.salesrate = belowCost;
              at("salesrate", belowCost, "unitprice", pIndex);
            }
          }
        }

        if (Object.keys(priceErrors).length) priceErrorsArr[pIndex] = priceErrors;
      });
      if (priceErrorsArr.filter(Boolean).length) variantErrors.unitprices = priceErrorsArr;
    }

    if (Object.keys(variantErrors).length) variantErrorsArray[vIndex] = variantErrors;
  });

  if (variantErrorsArray.filter(Boolean).length) {
    errors.productvariants = variantErrorsArray;
  }

  return { valid: isEmptyDeep(errors), errors, issues };
};
