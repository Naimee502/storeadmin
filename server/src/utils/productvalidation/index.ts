/**
 * Server-side product validation.
 *
 * Twin of client/src/utils/products/validateproduct.ts. The rules must stay
 * identical — if you change one, change the other. It is duplicated rather
 * than shared because there is no common package between client and server in
 * this repo yet; extracting one is the proper fix when a third consumer
 * appears.
 *
 * Why validate again here at all: the client checks are for speed and for a
 * useful error report, but they run on the caller's machine and can simply be
 * skipped. The import endpoint accepts an array from an untrusted source, so
 * this is the gate that actually holds.
 */

export interface ServerValidationIssue {
  field: string;
  message: string;
  variantIndex?: number;
  rowIndex?: number;
  scope: "product" | "variant" | "unitconversion" | "unitprice";
}

const idOf = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  return String(v.id ?? v._id ?? "");
};

const unitFactorOf = (variant: any, unitid: any): number | null => {
  const target = idOf(unitid);
  if (!target) return null;
  const conv = (variant?.unitconversions || []).find((c: any) => idOf(c.unitid) === target);
  const f = Number(conv?.factor);
  return f > 0 ? f : null;
};

const purchaseRatePerBaseUnit = (variant: any): number | null => {
  const rate = Number(variant?.purchaserate) || 0;
  if (rate <= 0) return null;
  const factor = unitFactorOf(variant, variant?.purchaseunitid);
  if (!factor) return null;
  return rate / factor;
};

const minAllowedSalesRate = (variant: any, unitid: any): number | null => {
  const perBase = purchaseRatePerBaseUnit(variant);
  if (perBase === null) return null;
  const factor = unitFactorOf(variant, unitid);
  if (!factor) return null;
  return perBase * factor;
};

const EPSILON = 0.005;

const NON_NEGATIVE_FIELDS: Record<string, string> = {
  openingstock: "Opening stock",
  openingstockamount: "Opening stock amount",
  currentstock: "Current stock",
  currentstockamount: "Current stock amount",
  closingstock: "Closing stock",
  closingstockamount: "Closing stock amount",
  minimumstock: "Minimum stock",
  reorderlevel: "Reorder level",
};

/**
 * @param product        the ProductServiceInput being imported
 * @param permissions    formPermissions.products, so a field switched off in
 *                       Business Settings is not demanded here either
 */
export const validateProductInput = (
  product: any,
  permissions: Record<string, boolean | undefined> = {}
): ServerValidationIssue[] => {
  const issues: ServerValidationIssue[] = [];
  const on = (fieldId: string) => permissions[fieldId] !== false;

  if (on("name") && !String(product?.name ?? "").trim()) {
    issues.push({ field: "name", message: "Product name is required", scope: "product" });
  }
  if (on("categoryid") && !product?.categoryid) {
    issues.push({ field: "categoryid", message: "Category is required", scope: "product" });
  }
  if (on("salesaccount") && !product?.salesaccountid) {
    issues.push({ field: "salesaccount", message: "Sales account is required", scope: "product" });
  }
  if (on("purchaseaccount") && !product?.purchaseaccountid) {
    issues.push({ field: "purchaseaccount", message: "Purchase account is required", scope: "product" });
  }

  if (product?.isservice) return issues;

  const variants: any[] = Array.isArray(product?.productvariants) ? product.productvariants : [];
  if (!variants.length) {
    issues.push({
      field: "productvariants",
      message: "At least 1 product variant is required",
      scope: "product",
    });
    return issues;
  }

  variants.forEach((variant: any, variantIndex: number) => {
    if (on("baseunitid") && !variant?.baseunitid) {
      issues.push({ field: "baseunitid", message: "Base unit is required", variantIndex, scope: "variant" });
    }
    if (on("purchaseunitid") && !variant?.purchaseunitid) {
      issues.push({ field: "purchaseunitid", message: "Purchase unit is required", variantIndex, scope: "variant" });
    }
    if (on("purchaserate") && (!variant?.purchaserate || Number(variant.purchaserate) <= 0)) {
      issues.push({
        field: "purchaserate",
        message: "Purchase rate must be greater than 0",
        variantIndex,
        scope: "variant",
      });
    }

    Object.entries(NON_NEGATIVE_FIELDS).forEach(([field, label]) => {
      const raw = variant?.[field];
      if (raw === "" || raw === null || raw === undefined) return;
      if (Number.isNaN(Number(raw))) {
        issues.push({ field, message: `${label} must be a number.`, variantIndex, scope: "variant" });
      } else if (Number(raw) < 0) {
        issues.push({ field, message: `${label} cannot be negative.`, variantIndex, scope: "variant" });
      }
    });

    const conversions: any[] = Array.isArray(variant?.unitconversions) ? variant.unitconversions : [];
    if (!conversions.length) {
      issues.push({
        field: "unitconversions",
        message: "At least 1 unit conversion is required",
        variantIndex,
        scope: "variant",
      });
    } else {
      conversions.forEach((conv: any, rowIndex: number) => {
        if (on("unitconversions_unitid") && !conv?.unitid) {
          issues.push({ field: "unitid", message: "Unit is required", variantIndex, rowIndex, scope: "unitconversion" });
        }
        if (on("factor") && (!conv?.factor || Number(conv.factor) <= 0)) {
          issues.push({
            field: "factor",
            message: "Factor must be greater than 0",
            variantIndex,
            rowIndex,
            scope: "unitconversion",
          });
        }
      });
    }

    const prices: any[] = Array.isArray(variant?.unitprices) ? variant.unitprices : [];
    if (!prices.length) {
      issues.push({
        field: "unitprices",
        message: "At least 1 unit price is required",
        variantIndex,
        scope: "variant",
      });
    } else {
      prices.forEach((price: any, rowIndex: number) => {
        if (on("unitprices_unitid") && !price?.unitid) {
          issues.push({ field: "unitid", message: "Unit is required", variantIndex, rowIndex, scope: "unitprice" });
        }
        if (on("quantity") && (!price?.quantity || Number(price.quantity) <= 0)) {
          issues.push({
            field: "quantity",
            message: "Quantity must be greater than 0",
            variantIndex,
            rowIndex,
            scope: "unitprice",
          });
        }
        if (on("salesrate")) {
          const entered = Number(price?.salesrate);
          if (!entered || entered <= 0) {
            issues.push({
              field: "salesrate",
              message: "Sales rate must be greater than 0",
              variantIndex,
              rowIndex,
              scope: "unitprice",
            });
          } else {
            const min = minAllowedSalesRate(variant, price.unitid);
            if (min !== null && entered + EPSILON < min) {
              issues.push({
                field: "salesrate",
                message: `Rate cannot be below purchase rate (₹${min.toFixed(2)}) for this unit.`,
                variantIndex,
                rowIndex,
                scope: "unitprice",
              });
            }
          }
        }
      });
    }
  });

  return issues;
};

/* ------------------------------------------------------------------ *
 * Reporting helpers
 *
 * A mutation that rejects a product needs to say which field was wrong, not
 * just that something was. These turn issues into paths that match the
 * add/edit form's field names ("productvariants.0.unitprices.1.salesrate"),
 * so the client can drop each message under the field it belongs to.
 * ------------------------------------------------------------------ */

export interface FieldError {
  /** Dotted path matching the add/edit form's field `name`. */
  path: string;
  /** Bare field id, for consumers that don't care about position. */
  field: string;
  message: string;
}

export const issuesToFieldErrors = (issues: ServerValidationIssue[]): FieldError[] =>
  issues.map((issue) => {
    // The permission ids for the account fields are shorter than the input
    // fields they guard, so they are spelled out rather than derived.
    const ACCOUNT_PATHS: Record<string, string> = {
      salesaccount: "salesaccountid",
      purchaseaccount: "purchaseaccountid",
      serviceaccount: "serviceaccountid",
    };

    let path = ACCOUNT_PATHS[issue.field] || issue.field;

    if (issue.variantIndex !== undefined) {
      const base = `productvariants.${issue.variantIndex}`;
      if (issue.rowIndex === undefined) {
        path = `${base}.${issue.field}`;
      } else {
        const group = issue.scope === "unitprice" ? "unitprices" : "unitconversions";
        path = `${base}.${group}.${issue.rowIndex}.${issue.field}`;
      }
    }

    return { path, field: issue.field, message: issue.message };
  });

/**
 * Thrown when a product mutation is handed something the rules reject.
 *
 * `extensions.code` is BAD_USER_INPUT so the client can tell "you sent
 * something wrong" apart from "the server broke", and `extensions.fieldErrors`
 * carries the per-field detail. Apollo copies `extensions` off the original
 * error, which is the same route TenantError already takes.
 */
export class ProductInputError extends Error {
  extensions: { code: string; fieldErrors: FieldError[] };

  constructor(issues: ServerValidationIssue[]) {
    const fieldErrors = issuesToFieldErrors(issues);
    super(fieldErrors.map((f) => f.message).join(" • ") || "Invalid product input.");
    this.name = "ProductInputError";
    this.extensions = { code: "BAD_USER_INPUT", fieldErrors };
  }
}
