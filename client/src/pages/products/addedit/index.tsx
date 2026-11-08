import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import HomeLayout from "../../../layouts/home";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import FormPage from "../../../components/formpage";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { selectIsFormFieldEnabled } from "../../../redux/slices/permissions";
import {
  useProductServiceByIDQuery,
  useProductServiceMutations,
} from "../../../graphql/hooks/products";
import { useImageUpload } from "../../../graphql/hooks/uploads";
import { useCategoriesQuery } from "../../../graphql/hooks/categories";
import { useBrandsQuery } from "../../../graphql/hooks/brands";
import { useProductGroupsQuery } from "../../../graphql/hooks/productgroups";
import { useModelsQuery } from "../../../graphql/hooks/models";
import { useSizesQuery } from "../../../graphql/hooks/sizes";
import { useUnitsQuery } from "../../../graphql/hooks/units";
import { useSubCategoriesQuery } from "../../../graphql/hooks/subcategories";
import { v4 as uuidv4 } from 'uuid';
import { ServiceVariants } from "../../../components/servicevariants";
import { ProductVariants } from "../../../components/productvariants";
import { belowCostError } from "../../../utils/rates";
import { validateProduct, type ValidationIssue, type ValidationResult } from "../../../utils/products/validateproduct";
import { useAccountLedgersQuery } from "../../../graphql/hooks/accountledgers";
import Modal from "../../../components/modal";
import { normalizeToYMD } from "../../../utils/helper";

const AddEditProductService = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { admin, branch, type } = useAppSelector((state) => state.auth);
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminId = admin?.id;

  const isAddVariantEnabled = useAppSelector(state => selectIsFormFieldEnabled(state, "products", "add_product_variant"));
  const productFormPermissions = useAppSelector(state => state.permissions.permissions?.formPermissions?.products || {});
  const isFieldEnabled = (fieldId: string) => {
    return productFormPermissions[fieldId] !== false;
  };

  const { data: categoryData, refetch: refetchCategories } = useCategoriesQuery();
  const { data: subCategoryDate, refetch: refetchSubCategories } = useSubCategoriesQuery();
  const { data: brandData, refetch: refetchBrands } = useBrandsQuery();
  const { data: groupData, refetch: refetchGroups } = useProductGroupsQuery();
  const { data: modelData, refetch: refetchModels } = useModelsQuery();
  const { data: sizeData, refetch: refetchSizes } = useSizesQuery();
  const { data: unitData, refetch: refetchUnits } = useUnitsQuery();
  const { data: ledgerData, refetch: refetchLedgers } = useAccountLedgersQuery();

  const [quickAdd, setQuickAdd] = useState<{ isOpen: boolean, type: string, label: string, fieldPath?: string, parentId?: string }>({
    isOpen: false,
    type: "",
    label: "",
    fieldPath: "",
    parentId: ""
  });

  // Tally-style: auto-resolve standard account ledgers by name pattern
  const ledgers = useMemo(() => ledgerData?.getAccountLedgers || [], [ledgerData]);

  const autoSalesAccountId = useMemo(() => {
    const exact = ledgers.find((l: any) =>
      /^sales\s*(account)?$/i.test(l.ledgername?.trim())
    );
    if (exact) return exact.id;
    return ledgers.find((l: any) =>
      /\bsales\b/i.test(l.ledgername) && !/purchase|expense|return/i.test(l.ledgername)
    )?.id || "";
  }, [ledgers]);

  const autoPurchaseAccountId = useMemo(() => {
    const exact = ledgers.find((l: any) =>
      /^purchase\s*(account)?$/i.test(l.ledgername?.trim())
    );
    if (exact) return exact.id;
    return ledgers.find((l: any) =>
      /\bpurchase\b/i.test(l.ledgername) && !/sales|return/i.test(l.ledgername)
    )?.id || "";
  }, [ledgers]);

  const autoServiceAccountId = useMemo(() => {
    const exact = ledgers.find((l: any) =>
      /^service\s*(sales|account|income)?$/i.test(l.ledgername?.trim())
    );
    if (exact) return exact.id;
    return ledgers.find((l: any) =>
      /\bservice\b/i.test(l.ledgername) && !/purchase|expense/i.test(l.ledgername)
    )?.id || "";
  }, [ledgers]);

  const { data: productData } = useProductServiceByIDQuery(id || "");
  const { addProductServiceMutation, updateProductServiceMutation } = useProductServiceMutations();
  const { uploadImageMutation, deleteImages } = useImageUpload();
  // Gallery items: saved URLs or picked Files (uploaded on Save); imageurl mirrors item 0.
  const [galleryImages, setGalleryImages] = useState<{ url: string; file?: File }[]>([]);

  // Images the product had on open; ones missing after Save are deleted from the server.
  const originalImageUrls = useRef<string[]>([]);

  // Uploaded in this save attempt, so a failed save can delete them.
  const justUploadedUrls = useRef<string[]>([]);

  const [errors, setErrors] = useState<any>({});
  const [isFormValid, setIsFormValid] = useState(false);

  const [formData, setFormData] = useState<any>({
  adminid: adminId,
  branchid: branchId,
  isservice: false,
  isserialised: false,
  name: "",
  description: "",
  imageurl: "",
  imagename: "",
  categoryid: "",
  subcategoryid: "",
  groupid: "",
  modelid: "",
  brandid: "",
  sizeid: "",
  seo: {
    metatitle: "",
    metadescription: "",
    keywords: [],
    slug: "",
  },
  productvariants: [
    {
      name: "",
      sku: "",
      productcode: "",
      batchnumber: "",
      manufacturedate: "",
      expirydate: "",
      baseunitid: "",
      purchaseunitid: "",
      purchaserate: "",
      unitconversions: [
        {
          unitid: "",
          factor: "",
        },
      ],
      gst: "",
      hsncode: "",
      openingstock: "",
      openingstockamount: "",
      currentstock: "",
      currentstockamount: "",
      closingstock: "",
      closingstockamount: "",
      minimumstock: "",
      reorderlevel: "",
      racklocation: "",
      serials: [
        {
          imei: "",
          serialnumber: "",
          lotnumber: "",
          status: "available",
          addedon: new Date(),
          soldon: null,
          returnedon: null,
          remarks: "",
        },
      ],
      unitprices: [
        {
          quantity: 1,
          unitid: "",
          mrp: "",
          salesrate: "",
          discount: "",
          discounttype: "fixed",
          offerprice: "",
        },
      ],
      productlikecount: 0,
    },
  ],
  servicevariants: [
    {
      name: "",
      servicecode: "",
      servicebarcode: "",
      servicerate: "",
      uom: "",
      duration: {
        amount: "",
        unit: "hours",
      },
      requiresappointment: true,
      availabilityslots: [
        {
          day: "mon",
          from: "",
          to: "",
        },
      ],
      locationType: "onsite",
      isRecurring: false,
      recurrence: {
        interval: "monthly",
        count: "",
      },
      servicelikecount: 0,
      remarks: "",
    },
  ],
  salesaccountid: "",
  purchaseaccountid: "",
  serviceaccountid: "",
  status: true,
  });

  useEffect(() => {
  if (isEdit && productData?.getProductServiceById) {
    const p = JSON.parse(JSON.stringify(productData.getProductServiceById));

    setFormData({
      id: p.id ?? "",
      adminid: p.adminid ?? adminId ?? "",
      branchid: p.branchid ?? branchId ?? "",
      isservice: p.isservice ?? false,
      isserialised: p.isserialised ?? false,
      name: p.name ?? "",
      description: p.description ?? "",
      imageurl: p.imageurl ?? "",
      imagename: p.imagename ?? "",
      categoryid: p.categoryid?.id ?? "",
      subcategoryid: p.subcategoryid?.id ?? "",
      groupid: p.groupid?.id ?? "",
      modelid: p.modelid?.id ?? "",
      brandid: p.brandid?.id ?? "",
      sizeid: p.sizeid?.id ?? "",
      seo: {
        metatitle: p.seo?.metatitle ?? "",
        metadescription: p.seo?.metadescription ?? "",
        keywords: p.seo?.keywords ?? [],
        slug: p.seo?.slug ?? "",
      },
      productvariants: (p.productvariants || []).length
        ? p.productvariants.map((variant: any) => ({
            ...variant,
            baseunitid: variant.baseunitid?.id ?? "",
            purchaseunitid: variant.purchaseunitid?.id ?? "",
            purchaserate: safeNumber(variant.purchaserate),
            manufacturedate: formatDateForInput(variant.manufacturedate),
            expirydate: formatDateForInput(variant.expirydate),
            gst: safeNumber(variant.gst),
            openingstock: safeNumber(variant.openingstock),
            openingstockamount: safeNumber(variant.openingstockamount),
            currentstock: safeNumber(variant.currentstock),
            currentstockamount: safeNumber(variant.currentstockamount),
            closingstock: safeNumber(variant.closingstock),
            closingstockamount: safeNumber(variant.closingstockamount),
            minimumstock: safeNumber(variant.minimumstock),
            reorderlevel: safeNumber(variant.reorderlevel),
            unitconversions: variant.unitconversions?.length
              ? variant.unitconversions.map((uc: any) => ({
                  ...uc,
                  "unitid": uc.unitid?.id ?? "",
                  factor: safeNumber(uc.factor),
                }))
              : [{ unitid: "", factor: "" }],
            serials: variant.serials?.length
              ? variant.serials
              : [
                  {
                    imei: "",
                    serialnumber: "",
                    lotnumber: "",
                    status: "available",
                    addedon: new Date(),
                    soldon: null,
                    returnedon: null,
                    remarks: "",
                  },
                ],
            unitprices: variant.unitprices?.length
              ? variant.unitprices.map((up: any) => ({
                  ...up,
                  quantity: safeNumber(up.quantity),
                  unitid: up.unitid?.id ?? up.unitid ?? "",
                  mrp: safeNumber(up.mrp),
                  salesrate: safeNumber(up.salesrate),
                  purchaserate: safeNumber(up.purchaserate),
                  discount: safeNumber(up.discount),
                  offerprice: safeNumber(up.offerprice),
                }))
              : [
                  {
                    quantity: 1,
                    unitid: "",
                    mrp: "",
                    salesrate: "",
                    purchaserate: "",
                    discount: "",
                    discounttype: "fixed",
                    offerprice: "",
                  },
                ],
            productlikecount: variant.productlikecount ?? 0,
          }))
        : [
            {
              name: "",
              sku: "",
              productcode: "",
              batchnumber: "",
              manufacturedate: "",
              expirydate: "",
              baseunitid: "",
              purchaseunitid: "",
              purchaserate: "",
              unitconversions: [{ unitid: "", factor: "" }],
              gst: "",
              hsncode: "",
              openingstock: "",
              openingstockamount: "",
              currentstock: "",
              currentstockamount: "",
              closingstock: "",
              closingstockamount: "",
              minimumstock: "",
              reorderlevel: "",
              racklocation: "",
              serials: [
                {
                  imei: "",
                  serialnumber: "",
                  lotnumber: "",
                  status: "available",
                  addedon: new Date(),
                  soldon: null,
                  returnedon: null,
                  remarks: "",
                },
              ],
              unitprices: [
                {
                  quantity: "",
                  unitid: "",
                  mrp: "",
                  salesrate: "",
                  purchaserate: "",
                  discount: "",
                  discounttype: "fixed",
                  offerprice: "",
                },
              ],
              productlikecount: 0,
            },
          ],
      servicevariants: (p.servicevariants || []).length
        ? p.servicevariants.map((service: any) => ({
            ...service,
            servicerate: safeNumber(service.servicerate),
            duration: {
              amount: safeNumber(service.duration?.amount),
              unit: service.duration?.unit ?? "hours",
            },
            availabilityslots: service.availabilityslots?.length
              ? service.availabilityslots
              : [{ day: "mon", from: "", to: "" }],
            recurrence: {
              interval: service.recurrence?.interval ?? "monthly",
              count: safeNumber(service.recurrence?.count),
            },
          }))
        : [
            {
              name: "",
              servicecode: "",
              servicebarcode: "",
              servicerate: "",
              uom: "hour",
              duration: { amount: "", unit: "hours" },
              requiresappointment: true,
              availabilityslots: [{ day: "mon", from: "", to: "" }],
              locationType: "onsite",
              isRecurring: false,
              recurrence: { interval: "monthly", count: "" },
              servicelikecount: 0,
              remarks: "",
            },
          ],
      salesaccountid: p.salesaccountid?.id ?? "",
      purchaseaccountid: p.purchaseaccountid?.id ?? "",
      serviceaccountid: p.serviceaccountid?.id ?? "",
      status: p.status ?? true,
    });

    const existingUrls: string[] = Array.isArray(p.imageurls) && p.imageurls.length
      ? p.imageurls
      : (p.imageurl ? [p.imageurl] : []);
    setGalleryImages(existingUrls.map((url: string) => ({ url })));
    originalImageUrls.current = existingUrls;
  }
  }, [productData]);

  // Auto-set account ledgers for new products when ledger data loads
  useEffect(() => {
    if (isEdit) return;
    setFormData((prev) => ({
      ...prev,
      salesaccountid:   prev.salesaccountid   || autoSalesAccountId,
      purchaseaccountid: prev.purchaseaccountid || autoPurchaseAccountId,
      serviceaccountid: prev.serviceaccountid  || autoServiceAccountId,
    }));
  }, [autoSalesAccountId, autoPurchaseAccountId, autoServiceAccountId, isEdit]);

  useEffect(() => {
    const valid = isEmptyDeep(errors);
    setIsFormValid(valid);
  }, [errors]);

  // Live "sales rate below purchase rate" check, compared per base unit.
  const belowCostErrors = useMemo(() => {
    const out: Record<number, Record<number, string>> = {};
    if (formData.isservice) return out;
    (formData.productvariants || []).forEach((variant: any, vIdx: number) => {
      (variant.unitprices || []).forEach((up: any, upIdx: number) => {
        const msg = belowCostError(variant, up.unitid, up.salesrate);
        if (msg) {
          if (!out[vIdx]) out[vIdx] = {};
          out[vIdx][upIdx] = msg;
        }
      });
    });
    return out;
    // Depends on whole formData: handleChange mutates nested variants in place.
  }, [formData]);

  const hasBelowCostError = Object.keys(belowCostErrors).length > 0;

  // Stock amounts are derived (stock x purchase rate), so recompute when stock or rate changes.
  useEffect(() => {
    if (formData.isservice) return;

    // Mirrors server getPurchaseRate(): value stock per base unit when units convert.
    const baseRateOf = (v: any) => {
      const rate = Number(v?.purchaserate) || 0;
      const purchaseUnitId = v?.purchaseunitid ? String(v.purchaseunitid) : "";
      const baseUnitId = v?.baseunitid ? String(v.baseunitid) : "";
      if (!purchaseUnitId || !baseUnitId) return rate;
      const conv = (v?.unitconversions || []).find(
        (u: any) => u?.unitid && String(u.unitid) === purchaseUnitId
      );
      const factor = Number(conv?.factor) || 0;
      return factor > 0 ? rate / factor : rate;
    };

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const PAIRS: [string, string][] = [
      ["openingstock", "openingstockamount"],
      ["currentstock", "currentstockamount"],
      ["closingstock", "closingstockamount"],
    ];

    setFormData((prev: any) => {
      if (prev?.isservice) return prev;

      let changed = false;
      const variants = (prev.productvariants || []).map((v: any) => {
        const rate = baseRateOf(v);
        let next = v;

        PAIRS.forEach(([qtyKey, amtKey]) => {
          const raw = v?.[qtyKey];
          // Blank stock means not entered; leave the amount blank, not 0.
          if (raw === "" || raw === null || raw === undefined) return;
          const amount = round2((Number(raw) || 0) * rate);
          if (Number(next?.[amtKey]) === amount) return;
          next = { ...next, [amtKey]: amount };
        });

        if (next !== v) changed = true;
        return next;
      });

      // Return the same object when unchanged so the effect can't loop.
      if (!changed) return prev;
      return { ...prev, productvariants: variants };
    });
  }, [formData]);

  // Stock and its value can't be negative; checked live like the rate rule.
  const NON_NEGATIVE_FIELDS: Record<string, string> = {
    openingstock: "Opening Stock",
    currentstock: "Current Stock",
    closingstock: "Closing Stock",
    openingstockamount: "Opening Stock Amount",
    currentstockamount: "Current Stock Amount",
    closingstockamount: "Closing Stock Amount",
    minimumstock: "Minimum Stock",
    reorderlevel: "Reorder Level",
  };

  const negativeStockErrors = useMemo(() => {
    const out: Record<number, Record<string, string>> = {};
    if (formData.isservice) return out;
    (formData.productvariants || []).forEach((variant: any, vIdx: number) => {
      Object.entries(NON_NEGATIVE_FIELDS).forEach(([field, label]) => {
        const raw = variant?.[field];
        if (raw === "" || raw === null || raw === undefined) return;
        if (Number(raw) < 0) {
          if (!out[vIdx]) out[vIdx] = {};
          out[vIdx][field] = `${label} cannot be negative.`;
        }
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const hasNegativeStockError = Object.keys(negativeStockErrors).length > 0;
  const hasBlockingError = hasBelowCostError || hasNegativeStockError;

  // Merge live errors (below-cost rate, negative stock) into the variant errors.
  const variantErrorsWithRate = useMemo(() => {
    if (!hasBlockingError) return errors;
    const merged: any = { ...errors };
    const variants: any[] = Array.isArray(merged.productvariants)
      ? merged.productvariants.map((v: any) => ({ ...v }))
      : [];
    Object.entries(belowCostErrors).forEach(([vIdx, ups]) => {
      const i = Number(vIdx);
      if (!variants[i]) variants[i] = {};
      const existing = Array.isArray(variants[i].unitprices) ? [...variants[i].unitprices] : [];
      Object.entries(ups).forEach(([upIdx, msg]) => {
        const j = Number(upIdx);
        existing[j] = { ...(existing[j] || {}), salesrate: msg };
      });
      variants[i].unitprices = existing;
    });
    Object.entries(negativeStockErrors).forEach(([vIdx, fields]) => {
      const i = Number(vIdx);
      if (!variants[i]) variants[i] = {};
      Object.entries(fields).forEach(([field, msg]) => {
        variants[i][field] = msg;
      });
    });
    merged.productvariants = variants;
    return merged;
  }, [errors, belowCostErrors, negativeStockErrors, hasBlockingError]);

  const isEmptyDeep = (obj: any): boolean => {
    if (obj == null) return true;
    if (Array.isArray(obj)) return obj.every(isEmptyDeep);
    if (typeof obj === "object") return Object.values(obj).every(isEmptyDeep);
    return false;
  };

  const safeNumber = (value: any) => {
    if (value === undefined || value === null || value === "") return "";
    const num = Number(value);
    if (isNaN(num)) return value;
    return Math.round(num * 10000) / 10000;
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    handleChange({
      target: { name, value: checked, type: "checkbox", checked }
    } as any);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    const keys = name.split(".");

    // Update formData
    setFormData((prev) => {
      const updated = { ...prev };
      let curr: any = updated;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const nextKey = keys[i + 1];
        const isArrayIndex = nextKey !== undefined && /^\d+$/.test(nextKey);

        if (i === keys.length - 1) {
          curr[key] = val;
        } else {
          if (curr[key] === undefined) curr[key] = isArrayIndex ? [] : {};
          if (isArrayIndex) {
            const index = parseInt(nextKey, 10);
            if (!curr[key][index]) curr[key][index] = {};
            curr = curr[key][index];
            i++;
          } else {
            curr = curr[key];
          }
        }
      }
      if (name.includes("productvariants") && name.includes("unitprices")) {
        const parts = name.split(".");
        // Path: productvariants.vIdx.unitprices.upIdx.field
        if (parts.length === 5) {
          const vIdx = parseInt(parts[1], 10);
          const upIdx = parseInt(parts[3], 10);
          const field = parts[4];

          if (["salesrate", "discount", "discounttype"].includes(field)) {
            const up = updated.productvariants[vIdx].unitprices[upIdx];
            const rate = Number(up.salesrate) || 0;
            const disc = Number(up.discount) || 0;
            const dType = up.discounttype || "fixed";

            if (dType === "percentage") {
              up.offerprice = Math.round(rate - (rate * disc / 100));
            } else {
              up.offerprice = Math.round(rate - disc);
            }
          }
        }
      }

      return updated;
    });

    // Clear the corresponding error in errors
    setErrors((prevErrors) => {
      const updatedErrors = { ...prevErrors };
      let currError: any = updatedErrors;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const nextKey = keys[i + 1];
        const isArrayIndex = nextKey !== undefined && /^\d+$/.test(nextKey);

        if (i === keys.length - 1) {
          if (currError && currError[key] !== undefined) delete currError[key];
        } else {
          if (currError[key] === undefined) break;
          if (isArrayIndex) {
            const index = parseInt(nextKey, 10);
            if (!currError[key][index]) break;
            currError = currError[key][index];
            i++;
          } else {
            currError = currError[key];
          }
        }
      }
      return updatedErrors;
    });
  };

  // Handlers for nested updates
  const addProductVariant = () => {
    setFormData(prev => {
      const newVariant = prev.productvariants.length
        ? JSON.parse(JSON.stringify(prev.productvariants[prev.productvariants.length - 1]))
        : { name: "", sku: "", productcode: "", baseunitid: "", unitconversions: [], unitprices: [], serials: [] };
      delete newVariant.id;
      delete newVariant._id;
      newVariant.tempid = uuidv4();
      return { ...prev, productvariants: [...prev.productvariants, newVariant] };
    });
  };

  const removeProductVariant = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      productvariants: prev.productvariants.filter((_, index) => index !== indexToRemove),
    }));
  };

  const addServiceVariant = () => {
    setFormData(prev => {
      const newVariant = prev.servicevariants.length
        ? JSON.parse(JSON.stringify(prev.servicevariants[prev.servicevariants.length - 1]))
        : { name: "", servicerate: 0, requiresappointment: false, isRecurring: false, duration: { amount: 0, unit: "minutes" }, recurrence: { interval: "", count: 0 }, availabilityslots: [] };
      delete newVariant.id;
      delete newVariant._id;
      newVariant.tempid = uuidv4();
      return { ...prev, servicevariants: [...prev.servicevariants, newVariant] };
    });
  };

  const removeServiceVariant = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      servicevariants: prev.servicevariants.filter((_, index) => index !== indexToRemove),
    }));
  };

  // Add/Remove for nested arrays
  const addUnitConversion = (variantIndex: number) => {
    setFormData(prev => {
      const variants = prev.productvariants.map((variant, i) =>
        i === variantIndex
          ? {
            ...variant,
            unitconversions: [
              ...(variant.unitconversions || []),
              { unitid: "", factor: 1 },
            ],
          }
          : variant
      );
      return { ...prev, productvariants: variants };
    });
  };

  const removeUnitConversion = (variantIndex: number, convIndex: number) => {
    setFormData(prev => {
      const variants = [...prev.productvariants];
      variants[variantIndex].unitconversions = variants[variantIndex].unitconversions.filter((_, i) => i !== convIndex);
      return { ...prev, productvariants: variants };
    });
  };

  const addUnitPrice = (variantIndex: number) => {
    setFormData(prev => {
      const variants = prev.productvariants.map((variant, i) =>
        i === variantIndex
          ? {
              ...variant,
              unitprices: [
                ...(variant.unitprices || []),
                {
                  quantity: 1,
                  unitid: "",
                  mrp: 0,
                  salesrate: 0,
                  discount: 0,
                  discounttype: "fixed",
                  offerprice: 0,
                },
              ],
            }
          : variant
      );
      return { ...prev, productvariants: variants };
    });
  };

  const removeUnitPrice = (variantIndex: number, unitPriceIndex: number) => {
    setFormData(prev => {
      const variants = [...prev.productvariants];
      variants[variantIndex].unitprices =
        variants[variantIndex].unitprices.filter((_, i) => i !== unitPriceIndex);
      return { ...prev, productvariants: variants };
    });
  };

  const addServiceSlot = (variantIndex: number) => {
    setFormData(prev => {
      const variants = prev.servicevariants.map((variant, i) =>
        i === variantIndex
          ? {
            ...variant,
            availabilityslots: [
              ...(variant.availabilityslots || []),
              { day: [], from: "", to: "" }, // use empty array for multiselect day
            ],
          }
          : variant
      );
      return { ...prev, servicevariants: variants };
    });
  };

  const removeServiceSlot = (variantIndex: number, slotIndex: number) => {
    setFormData(prev => {
      const variants = [...prev.servicevariants];
      variants[variantIndex].availabilityslots = variants[variantIndex].availabilityslots.filter((_, i) => i !== slotIndex);
      return { ...prev, servicevariants: variants };
    });
  };

  const addSerial = (variantIndex: number) => {
    setFormData(prev => {
      const variants = prev.productvariants.map((variant, i) =>
        i === variantIndex
          ? {
            ...variant,
            serials: [
              ...(variant.serials || []),
              {
                imei: "",
                serialnumber: "",
                lotnumber: "",
                status: "available",
                addedon: new Date(),
                soldon: null,
                returnedon: null,
                remarks: "",
              },
            ],
          }
          : variant
      );
      return { ...prev, productvariants: variants };
    });
  };

  const removeSerial = (variantIndex: number, serialIndex: number) => {
    setFormData(prev => {
      const variants = [...prev.productvariants];
      variants[variantIndex].serials = variants[variantIndex].serials.filter((_, i) => i !== serialIndex);
      return { ...prev, productvariants: variants };
    });
  };

  const formatDateForInput = (date: string | Date | null | undefined) =>
    normalizeToYMD(date as any) || "";

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // Append picked files as blob previews; upload on Save.
    setGalleryImages((prev) => [...prev, ...files.map((file) => ({ url: URL.createObjectURL(file), file }))]);
    e.target.value = ""; // allow picking the same file(s) again later
  };

  const removeGalleryImage = (idx: number) => {
    setGalleryImages((prev) => {
      const going = prev[idx];
      // Release the blob preview's memory.
      if (going?.file && going.url.startsWith("blob:")) URL.revokeObjectURL(going.url);
      return prev.filter((_, i) => i !== idx);
    });
    // Saved image is deleted on Save, not now, so cancel leaves the product unchanged.
  };

  const uploadGalleryImages = async (): Promise<string[]> => {
    const uploaded: string[] = [];

    const urls = await Promise.all(
      galleryImages.map(async (img) => {
        if (!img.file) return img.url;
        const { data } = await uploadImageMutation({ variables: { file: img.file } });
        const url = data?.uploadImage?.url || img.url;
        if (data?.uploadImage?.url) uploaded.push(data.uploadImage.url);
        return url;
      })
    );

    // Remembered so a failed save can take its own uploads back off the disk.
    justUploadedUrls.current = uploaded;
    return urls;
  };

  /** Shared validation (utils/products/validateproduct) used by form, importer and server. */
  const validateForm = (): ValidationResult => {
    const result = validateProduct(formData, productFormPermissions);
    setErrors(result.errors);
    return result;
  };

  /** Human-readable label for where an issue is, e.g. " (Variant 2, row 1)". */
  const issueLocation = (issue: ValidationIssue) => {
    if (issue.variantIndex === undefined) return "";
    const where = issue.scope === "unitprice"
      ? "Unit Price"
      : issue.scope === "unitconversion"
        ? "Unit Conversion"
        : "";
    const row = issue.rowIndex === undefined ? "" : ` ${where} ${issue.rowIndex + 1}`;
    return ` (Variant ${issue.variantIndex + 1}${row})`;
  };

  /** Name the problems in the toast and jump to the first one. */
  const describeIssues = (issues: ValidationIssue[]) => {
    if (!issues.length) return "Please fix the errors before submitting.";
    const lines = issues.map((i) => `${i.message}${issueLocation(i)}`);
    const shown = lines.slice(0, 4).join(" • ");
    return lines.length > 4 ? `${shown} • and ${lines.length - 4} more` : shown;
  };

  /** Fields render id={name}, matching the issue's path, so we can find them by id. */
  const focusField = (path?: string) => {
    if (!path) return;
    const el = document.getElementById(path);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Give the scroll a moment, otherwise focus() yanks the page back.
    window.setTimeout(() => (el as HTMLElement).focus?.({ preventScroll: true }), 300);
  };

  /** Writes "productvariants.0.unitprices.1.salesrate" into the errors tree. */
  const setErrorAtPath = (tree: any, path: string, message: string) => {
    const keys = path.split(".");
    let curr: any = tree;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const nextIsIndex = /^\d+$/.test(keys[i + 1]);
      if (curr[key] === undefined || curr[key] === null) curr[key] = nextIsIndex ? [] : {};
      curr = curr[key];
    }
    curr[keys[keys.length - 1]] = message;
  };

  const generatePayload = async (isUpdate = false): Promise<any> => {
    const uploadedUrls = await uploadGalleryImages();

    const parseDate = (val: any, fallback: Date | null = null) => {
      if (!val) return fallback;
      const d = new Date(val);
      return isNaN(d.getTime()) ? fallback : d;
    };

    const roundNum = (val: any) => {
      const n = Number(val) || 0;
      return Math.round(n * 10000) / 10000;
    };

    const payload = {
      ...formData,
      ...(isUpdate ? {} : { id: formData.id || undefined }),
      categoryid: formData.categoryid?.trim() || undefined,
      subcategoryid: formData.subcategoryid?.trim() || undefined,
      groupid: formData.groupid?.trim() || undefined,
      modelid: formData.modelid?.trim() || undefined,
      brandid: formData.brandid?.trim() || undefined,
      sizeid: formData.sizeid?.trim() || undefined,

      salesaccountid: formData.salesaccountid?.trim() || undefined,
      purchaseaccountid: formData.purchaseaccountid?.trim() || undefined,
      serviceaccountid: formData.serviceaccountid?.trim() || undefined,

      imageurl: uploadedUrls[0] || "",
      imagename: galleryImages[0]?.file ? galleryImages[0].file.name : formData.imagename,
      imageurls: uploadedUrls,

      seo: {
        ...formData.seo,
        keywords: Array.isArray(formData.seo?.keywords)
          ? formData.seo.keywords
          : formData.seo?.keywords?.split(",").map(k => k.trim()).filter(Boolean) || [],
      },

      isservice: !!formData.isservice,
      isserialised: !!formData.isserialised,

      productvariants: formData.isservice ? [] : (formData.productvariants || []).map(v => ({
        id: v.id || undefined,
        name: v.name?.trim() || "",
        sku: v.sku?.trim() || "",
        productcode: v.productcode?.trim() || "",
        batchnumber: v.batchnumber?.trim() || "",
        manufacturedate: parseDate(v.manufacturedate)?.toISOString() || null,
        expirydate: parseDate(v.expirydate)?.toISOString() || null,
        baseunitid: v.baseunitid?.trim() || undefined,
        purchaseunitid: v.purchaseunitid?.trim() || undefined,
        purchaserate: roundNum(v.purchaserate),
        gst: roundNum(v.gst),
        hsncode: v.hsncode?.trim() || "",
        openingstock: roundNum(v.openingstock),
        openingstockamount: roundNum(v.openingstockamount),
        currentstock: roundNum(v.currentstock),
        currentstockamount: roundNum(v.currentstockamount),
        closingstock: roundNum(v.closingstock),
        closingstockamount: roundNum(v.closingstockamount),
        minimumstock: roundNum(v.minimumstock),
        reorderlevel: roundNum(v.reorderlevel),
        racklocation: v.racklocation?.trim() || "",
        serials: (v.serials || []).map(s => ({
          ...s,
          addedon: parseDate(s.addedon)?.toISOString() || null,
          soldon: parseDate(s.soldon)?.toISOString() || null,
          returnedon: parseDate(s.returnedon)?.toISOString() || null,
        })),
        unitconversions: (v.unitconversions?.length ? v.unitconversions : [{ unitid: undefined, factor: 1 }])
          .map(u => ({ unitid: u.unitid?.trim() || undefined, factor: Number(u.factor) || 1 })),
        unitprices: (v.unitprices?.length ? v.unitprices : [{ quantity: 1, unitid: undefined, mrp: 0, salesrate: 0, purchaserate: 0, discount: 0, discounttype: "fixed", offerprice: 0 }])
          .map(up => ({
            quantity: roundNum(up.quantity) || 1,
            unitid: up.unitid?.trim() || undefined,
            mrp: roundNum(up.mrp),
            salesrate: roundNum(up.salesrate),
            discount: roundNum(up.discount),
            discounttype: up.discounttype?.trim() || "fixed",
            offerprice: roundNum(up.offerprice),
            productbarcode: up.productbarcode?.trim() || "",
          })),
        productlikecount: roundNum(v.productlikecount),
      })),

      servicevariants: formData.isservice ? (formData.servicevariants || []).map(s => ({
        _id: s._id || undefined,
        name: s.name?.trim() || "",
        servicerate: Number(s.servicerate) || 0,
        requiresappointment: !!s.requiresappointment,
        isRecurring: !!s.isRecurring,
        duration: {
          amount: Number(s.duration?.amount) || 1,
          unit: s.duration?.unit || "hours",
        },
        recurrence: {
          interval: s.recurrence?.interval || "monthly",
          count: Number(s.recurrence?.count) || 1,
        },
        availabilityslots: (s.availabilityslots || []).flatMap(slot => {
          const days = Array.isArray(slot.day) ? slot.day : [slot.day || "mon"];
          return days.map(d => ({
            day: d,
            from: slot.from || "",
            to: slot.to || "",
          }));
        })
      })) : [],
      status: !!formData.status,
    };

    return deepClean(payload);
  };

  const deepClean = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(deepClean);
    if (obj && typeof obj === "object") {
      const result: any = {};
      for (const key in obj) {
        // Skip GraphQL-internal + frontend-only keys
        if (["__typename", "tempid"].includes(key)) continue;

        result[key] = deepClean(obj[key]);
      }
      return result;
    }
    return obj;
  };

  const handleSubmit = async () => {
    // Don't save an edit form before the product has loaded.
    if (isEdit && !productData) {
      dispatch(showMessage({ message: "Still loading this product — try again in a moment.", type: "error" }));
      return;
    }

    const { valid, issues } = validateForm();

    if (!valid) {
      dispatch(showMessage({ message: describeIssues(issues), type: "error" }));
      focusField(issues[0]?.path);
      return;
    }

    const payload = await generatePayload(isEdit);
    try {
      if (isEdit) {
        await updateProductServiceMutation({
          variables: { id, input: payload },
        });
        dispatch(showMessage({ message: "Updated successfully", type: "success" }));
      } else {
        await addProductServiceMutation({
          variables: { input: payload },
        });
        dispatch(showMessage({ message: "Added successfully", type: "success" }));
      }

      // Delete image files the saved product no longer references.
      const keptUrls: string[] = payload.imageurls || [];
      const droppedUrls = originalImageUrls.current.filter((url) => !keptUrls.includes(url));
      originalImageUrls.current = keptUrls;
      justUploadedUrls.current = [];
      void deleteImages(droppedUrls);

      navigate("/products");
    } catch (err: any) {
      console.error("❌ GraphQL Error:", err);

      // Failed save: remove the images uploaded for it.
      const orphans = justUploadedUrls.current;
      justUploadedUrls.current = [];
      void deleteImages(orphans);

      // Show server fieldErrors (BAD_USER_INPUT) under the matching fields.
      const gqlError = err?.graphQLErrors?.[0];
      const fieldErrors: { path: string; message: string }[] =
        gqlError?.extensions?.fieldErrors || [];

      if (fieldErrors.length) {
        const tree: any = {};
        fieldErrors.forEach((fe) => setErrorAtPath(tree, fe.path, fe.message));
        setErrors(tree);
        focusField(fieldErrors[0].path);
      }

      const message =
        (fieldErrors.length ? fieldErrors.map((f) => f.message).slice(0, 4).join(" • ") : "") ||
        gqlError?.message ||
        err?.networkError?.result?.errors?.[0]?.message ||
        err?.message ||
        (isEdit ? "Could not update the product." : "Could not add the product.");

      dispatch(showMessage({ message, type: "error" }));
    }
  };

  const openQuickAdd = (type: string, label: string, fieldPath?: string, parentId?: string) => {
    setQuickAdd({ isOpen: true, type, label, fieldPath, parentId });
  };

  const handleQuickAddSuccess = (newData: any) => {
    const { type, fieldPath } = quickAdd;
    // Refetch the appropriate data
    if (type === "category") refetchCategories();
    else if (type === "subcategory") refetchSubCategories();
    else if (type === "brand") refetchBrands();
    else if (type === "productgroup") refetchGroups();
    else if (type === "model") refetchModels();
    else if (type === "size") refetchSizes();
    else if (type === "unit") refetchUnits();
    else if (type === "account") refetchLedgers();

    // Automatically select the new item if fieldPath is provided
    if (fieldPath) {
      handleChange({
        target: { name: fieldPath, value: newData.id }
      } as any);
    }
  };

  const subcategoryOptions =
    formData.categoryid && subCategoryDate?.getSubCategories
      ? subCategoryDate.getSubCategories
        .filter((s) => s.category?.id === formData.categoryid)
        .map((s) => ({ value: s.id, label: s.subcategoryname }))
      : [];

  return (
    <HomeLayout>
      <FormPage
        breadcrumb="Products"
        title={isEdit ? "Edit Product" : "Add Product"}
        onSave={handleSubmit}
        onCancel={() => navigate('/products')}
        saveLabel={isEdit ? 'Update Product Service' : 'Add Product Service'}
        saveDisabled={hasBlockingError}
        saveTitle={
          hasBelowCostError
            ? "One or more sales rates are below the purchase rate."
            : hasNegativeStockError
              ? "Stock values cannot be negative."
              : undefined
        }
      >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* === GENERAL INFO === */}
        <div className="space-y-6">
          {(isFieldEnabled("name") || isFieldEnabled("imageurl") || isFieldEnabled("categoryid") || isFieldEnabled("subcategoryid") || isFieldEnabled("brandid") || isFieldEnabled("groupid") || isFieldEnabled("modelid") || isFieldEnabled("sizeid") || isFieldEnabled("description")) && (
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">General Details</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isFieldEnabled("name") && <FormField label="Name" name="name" placeholder="Enter product name" value={formData.name} onChange={handleChange}  error={errors.name}/>}
              {isFieldEnabled("imageurl") && <FormField label="Images" name="imageurl" type="file" accept="image/*" multiple onChange={handleImageChange} />}
              {isFieldEnabled("categoryid") && <FormField label="Category" name="categoryid" type="select" placeholder="Select category" options={categoryData?.getCategories.map(c => ({ value: c.id, label: c.categoryname })) || []} value={formData.categoryid} onChange={handleChange} searchable addable onAddNew={() => openQuickAdd("category", "Category", "categoryid")} error={errors.categoryid}/>}
              {isFieldEnabled("subcategoryid") && <FormField label="Sub Category" name="subcategoryid" type="select" placeholder="Select subcategory" options={subcategoryOptions} value={formData.subcategoryid} onChange={handleChange} searchable addable onAddNew={() => openQuickAdd("subcategory", "Sub Category", "subcategoryid", formData.categoryid)}/>}
              {isFieldEnabled("brandid") && <FormField label="Brand" name="brandid" type="select" placeholder="Select brand" options={brandData?.getBrands.map(b => ({ value: b.id, label: b.brandname })) || []} value={formData.brandid} onChange={handleChange} searchable addable onAddNew={() => openQuickAdd("brand", "Brand", "brandid")}/>}
              {isFieldEnabled("groupid") && <FormField label="Product Group" name="groupid" type="select" placeholder="Select group" options={groupData?.getProductGroups.map(g => ({ value: g.id, label: g.productgroupname })) || []} value={formData.groupid} onChange={handleChange} searchable addable onAddNew={() => openQuickAdd("productgroup", "Product Group", "groupid")}/>}
              {isFieldEnabled("modelid") && <FormField label="Model" name="modelid" type="select" placeholder="Select model" options={modelData?.getModels.map(m => ({ value: m.id, label: m.modelname })) || []} value={formData.modelid} onChange={handleChange} searchable addable onAddNew={() => openQuickAdd("model", "Model", "modelid")}/>}
              {isFieldEnabled("sizeid") && <FormField label="Size" name="sizeid" type="select" placeholder="Select size" options={sizeData?.getSizes.map(s => ({ value: s.id, label: s.sizename })) || []} value={formData.sizeid} onChange={handleChange} searchable addable onAddNew={() => openQuickAdd("size", "Size", "sizeid")}/>}

              {/* Gallery thumbnails; the first image is the product's cover. */}
              {galleryImages.length > 0 && (
                <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Image Preview ({galleryImages.length})</label>
                  <div className="flex flex-wrap gap-2">
                    {galleryImages.map((img, idx) => (
                      <div key={idx} className="relative h-16 w-16 shrink-0">
                        <img
                          src={img.url}
                          alt={`Product ${idx + 1}`}
                          className="h-16 w-16 rounded-lg border border-gray-200 object-contain"
                        />
                        {idx === 0 && (
                          <span className="absolute -top-1.5 -left-1.5 rounded bg-indigo-600 px-1 text-[9px] font-bold text-white">Main</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(idx)}
                          className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white hover:bg-red-700"
                          aria-label={`Remove image ${idx + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isFieldEnabled("description") && (
                <div className="md:col-span-2 lg:col-span-3">
                  <FormField label="Description" name="description" placeholder="Enter description" value={formData.description} onChange={handleChange} multiline />
                </div>
              )}
            </div>
          </fieldset>
          )}
        </div>

        {/* === SEO, OPTIONS, ACCOUNTS === */}
        <div className="space-y-6">
          {(isFieldEnabled("metatitle") || isFieldEnabled("metadescription") || isFieldEnabled("keywords") || isFieldEnabled("slug")) && (
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">SEO</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {isFieldEnabled("metatitle") && <FormField label="Meta Title" name="seo.metatitle" placeholder="Meta title for SEO" value={formData.seo.metatitle} onChange={handleChange} />}
              {isFieldEnabled("metadescription") && <FormField label="Meta Description" name="seo.metadescription" placeholder="Meta description for SEO" value={formData.seo.metadescription} onChange={handleChange} />}
              {isFieldEnabled("keywords") && <FormField label="Keywords" name="seo.keywords" placeholder="SEO keywords, comma separated" value={formData.seo.keywords} onChange={handleChange} />}
              {isFieldEnabled("slug") && <FormField label="Slug" name="seo.slug" placeholder="URL slug, e.g. /product-slug" value={formData.seo.slug} onChange={handleChange} />}
            </div>
          </fieldset>
          )}

          {(isFieldEnabled("status") || isFieldEnabled("isserialised")) && (
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Options</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
              {isFieldEnabled("status") && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm sm:text-base font-medium">Status</legend>
                  <FormSwitch
                    label=""
                    name="status"
                    checked={Boolean(formData.status)}
                    onChange={(checked) => handleSwitchChange("status", checked)}
                  />
                </fieldset>
              )}
              {isFieldEnabled("isserialised") && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm sm:text-base font-medium">Is Product Serialised</legend>
                  <FormSwitch
                    label=""
                    name="isserialised"
                    checked={Boolean(formData.isserialised)}
                    onChange={(checked) => handleSwitchChange("isserialised", checked)}
                  />
                </fieldset>
              )}
            </div>
          </fieldset>
          )}

          {(isFieldEnabled("salesaccount") || isFieldEnabled("purchaseaccount") || (formData.isservice && isFieldEnabled("serviceaccount"))) && (
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Accounts</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isFieldEnabled("salesaccount") && (
                <div>
                  <FormField
                    label="Sales Account"
                    name="salesaccountid"
                    type="select"
                    placeholder="Select sales account"
                    options={ledgers.map((a: any) => ({ value: a.id, label: a.ledgername }))}
                    value={formData.salesaccountid}
                    onChange={handleChange}
                    searchable
                    addable
                    onAddNew={() => openQuickAdd("account", "Sales Account", "salesaccountid")}
                    error={errors.salesaccountid}
                  />
                  {formData.salesaccountid && (
                    <p className="text-xs text-green-600 mt-0.5 pl-1">
                      Auto-selected: <strong>{ledgers.find((l: any) => l.id === formData.salesaccountid)?.ledgername}</strong> — change if needed
                    </p>
                  )}
                </div>
              )}

              {isFieldEnabled("purchaseaccount") && (
                <div>
                  <FormField
                    label="Purchase Account"
                    name="purchaseaccountid"
                    type="select"
                    placeholder="Select purchase account"
                    options={ledgers.map((a: any) => ({ value: a.id, label: a.ledgername }))}
                    value={formData.purchaseaccountid}
                    onChange={handleChange}
                    searchable
                    addable
                    onAddNew={() => openQuickAdd("account", "Purchase Account", "purchaseaccountid")}
                    error={errors.purchaseaccountid}
                  />
                  {formData.purchaseaccountid && (
                    <p className="text-xs text-green-600 mt-0.5 pl-1">
                      Auto-selected: <strong>{ledgers.find((l: any) => l.id === formData.purchaseaccountid)?.ledgername}</strong> — change if needed
                    </p>
                  )}
                </div>
              )}

              {formData.isservice && isFieldEnabled("serviceaccount") && (
                <div>
                  <FormField
                    label="Service Account"
                    name="serviceaccountid"
                    type="select"
                    placeholder="Select service account"
                    options={ledgers.map((a: any) => ({ value: a.id, label: a.ledgername }))}
                    value={formData.serviceaccountid}
                    onChange={handleChange}
                    searchable
                    addable
                    onAddNew={() => openQuickAdd("account", "Service Account", "serviceaccountid")}
                    error={errors.serviceaccountid}
                  />
                  {formData.serviceaccountid && (
                    <p className="text-xs text-green-600 mt-0.5 pl-1">
                      Auto-selected: <strong>{ledgers.find((l: any) => l.id === formData.serviceaccountid)?.ledgername}</strong> — change if needed
                    </p>
                  )}
                </div>
              )}
            </div>
          </fieldset>
          )}
        </div>
      </div>

      {/* === PRODUCT AND SERVICE === */}
      <div className="mt-3 space-y-6">
        {formData.isservice ? (
          <ServiceVariants
            formData={formData}
            handleChange={handleChange}
            addServiceVariant={addServiceVariant}
            removeServiceVariant={removeServiceVariant}
            addAvailabilitySlot={addServiceSlot}
            removeAvailabilitySlot={removeServiceSlot}
            isEdit={isEdit}
            navigate={navigate}
          />
        ) : (
          <ProductVariants
            formData={formData}
            handleChange={handleChange}
            addProductVariant={addProductVariant}
            removeProductVariant={removeProductVariant}
            unitData={unitData}
            addUnitConversion={addUnitConversion}
            removeUnitConversion={removeUnitConversion}
            addUnitPrice={addUnitPrice}
            removeUnitPrice={removeUnitPrice}
            addSerial={addSerial}
            removeSerial={removeSerial}
            isEdit={isEdit}
            isserialised={formData.isserialised}
            navigate={navigate}
            onQuickAdd={openQuickAdd}
            errors={variantErrorsWithRate}
            isAddVariantEnabled={isAddVariantEnabled}
          />
        )}
      </div>

      <Modal
        isOpen={quickAdd.isOpen}
        onClose={() => setQuickAdd(prev => ({ ...prev, isOpen: false }))}
        type={quickAdd.type as any}
        label={quickAdd.label}
        onSuccess={handleQuickAddSuccess}
        parentId={quickAdd.parentId}
        categories={categoryData?.getCategories || []}
      />
      </FormPage>
    </HomeLayout>

  );
};

export default AddEditProductService;

