// Tally-style retail POS: Staff/Branch/Admin can take orders or generate invoices.

import { useEffect, useMemo, useRef, useState } from "react";
import HomeLayout from "../../layouts/home";
import {
  Search,
  ShoppingCart,
  ScanBarcode,
  Plus,
  Minus,
  X as XIcon,
  Package,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";

import { useCategoriesQuery } from "../../graphql/hooks/categories";
import { useSubCategoriesQuery } from "../../graphql/hooks/subcategories";
import { useBrandsQuery } from "../../graphql/hooks/brands";
import { useModelsQuery } from "../../graphql/hooks/models";
import { useSizesQuery } from "../../graphql/hooks/sizes";
import { useProductGroupsQuery } from "../../graphql/hooks/productgroups";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useSalesInvoiceMutations, useSalesInvoicesQuery } from "../../graphql/hooks/salesinvoice";
import { getLastPartyDocRows, todayYMD } from "../../utils/helper";
import { useSalesOrderMutations, useSalesOrdersQuery } from "../../graphql/hooks/salesorder";
import { usePriceResolvers } from "../../graphql/hooks/pricelists";
import { useAccountsQuery } from "../../graphql/hooks/accounts";
import { useBranchesQuery } from "../../graphql/hooks/branches";
import PosAddCustomer from "../../components/posaddcustomer";
import FormField from "../../components/formfiled";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  getBaseQuantity,
  getCartItemBaseQty,
  getNextBillNumber,
} from "../../utils/helper";
import { showMessage } from "../../redux/slices/message";
import { partyLabel } from "../../utils/partylabel";
import { isCustomerParty } from "../../utils/partytype";
import { BRANCH_REQUIRED } from "../../utils/branch";
import { isOfflineSaved, OFFLINE_SAVED_MESSAGE } from "../../offline/billing";
import { useOfflineNumber, useOfflineStock } from "../../offline/billing";

// A walk-in (cash) customer account: no credit is left on it.
const isWalkIn = (p: any) => !p || /walk[\s-]?in|cash\s*(customer|sale)/i.test(String(p.name || p.accountname || ""));

/* Helpers */
function getPriceFromUnitPrice(u: any) {
  return u?.offerprice ?? u?.salesrate ?? u?.mrp ?? 0;
}

function mapProductServiceList(list: any[] = []) {
  return list.map((p) => {
    const variantsRaw = p.productvariants || [];

    const variants = variantsRaw.map((v: any) => {
      const unitPrices = v.unitprices || [];

      const units = unitPrices.map((u: any) => ({
        id: u.unitid?.id ?? u.unitid,
        name: u.unitid?.unitname ?? u.unitname,
        quantity: u.quantity ?? 1,
        mrp: u.mrp ?? 0,
        salesrate: u.salesrate ?? null,
        offerprice: u.offerprice ?? null,
        price: getPriceFromUnitPrice(u),
        discount: u.discount ?? 0,
      }));

      const conversions = (v.unitconversions || []).map((c: any) => ({
        unitId: c.unitid?.id,
        unitName: c.unitid?.unitname,
        factor: c.factor,
      }));

      return {
        variantId: v.id,
        name: v.name,
        sku: v.sku,
        gst: v.gst ?? 0,
        currentstock: v.currentstock ?? 0,
        units,
        conversions,
        purchaserate: v.purchaserate ?? null,
        baseunitid: v.baseunitid?.id ?? null,
        purchaseunitid: v.purchaseunitid?.id ?? null,
        unitprices: v.unitprices ?? [],
      };
    });

    return {
      id: p.id,
      name: p.name,
      image: p.imageurl || "",
      categoryId: p.categoryid?.id || "",
      categoryName: p.categoryid?.categoryname || "",
      subcategoryId: p.subcategoryid?.id || "",
      subcategoryName: p.subcategoryid?.subcategoryname || "",
      barndId: p.brandid?.id || "",
      brandName: p.brandid?.brandname || "",
      sizeId: p.sizeid?.id || "",
      sizeName: p.sizeid?.sizename || "",
      modalId: p.modelid?.id || "",
      modelName: p.modelid?.modelname || "",
      productGroupId: p.groupid?.id || "",
      status: p.status ?? true,
      variants,
      units: variants[0]?.units || [],
      price: variants[0]?.units?.[0]?.price ?? 0,
      mrp: variants[0]?.units?.[0]?.mrp ?? 0,
      gst: variants[0]?.gst ?? 0,
      salesaccountid: p.salesaccountid?.id ?? p.salesaccountid ?? null,
      purchaseaccountid: p.purchaseaccountid?.id ?? p.purchaseaccountid ?? null,
      serviceaccountid: p.serviceaccountid?.id ?? p.serviceaccountid ?? null,
    };
  });
}

export default function POSDashboard() {
  const dispatch = useAppDispatch();

  /* Fetch master data */
  const { data: catData } = useCategoriesQuery();
  const categoryList = catData?.getCategories || [];

  const { data: subData } = useSubCategoriesQuery();
  const subCategoryList = subData?.getSubCategories || [];

  const { data: brandData } = useBrandsQuery();
  const brandList = brandData?.getBrands || [];

  // Models & ProductGroups still queried (kept for future filters / data freshness)
  useModelsQuery();
  useProductGroupsQuery();
  useSizesQuery();

  const { data: psData, refetch: refetchProducts } = useProductServicesQuery();
  const productServiceList = psData?.getProductServices ?? [];

  /* UI state */
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);

  const [cart, setCart] = useState<any[]>([]);
  const [heldCarts, setHeldCarts] = useState<any[][]>([]);
  const [selectedUnits, setSelectedUnits] = useState<any>({});
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [isOrderMode, setIsOrderMode] = useState(true);
  const [barcode, setBarcode] = useState("");
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [billNumber, setBillNumber] = useState("000001");

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement | null>(null);
  // List suits keyboard/scanner counters, grid suits touch; each device keeps its own choice.
  const [view, setViewState] = useState<"list" | "grid">(() => {
    try { return localStorage.getItem("pos:view") === "grid" ? "grid" : "list"; } catch { return "list"; }
  });
  const setView = (v: "list" | "grid") => {
    setViewState(v);
    try { localStorage.setItem("pos:view", v); } catch { /* storage blocked */ }
  };
  // Item row picked with the arrow keys (Enter adds it) and save in progress.
  const [activeRow, setActiveRow] = useState(0);
  const [saving, setSaving] = useState(false);

  const { resolvePrice, offlinePrice } = usePriceResolvers();

  /* Customer / accounts */
  const { data: accountData, refetch: refetchAccounts } = useAccountsQuery();
  const accounts = accountData?.getAccounts || [];
  const customerOptions = accounts.filter((a: any) => isCustomerParty(a.type));

  /* Auth context */
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const creatorInfo = useMemo(() => {
    if (type === "admin" && admin)
      return { id: admin.id, name: admin.name, type: "admin" };
    if (type === "branch" && branch)
      return {
        id: branch.id,
        name: branch.branchname || branch.name || "Branch",
        type: "branch",
      };
    if (type === "staff" && staff)
      return { id: staff.id, name: staff.name, type: "staff" };
    return { id: "", name: "Unknown", type: "unknown" };
  }, [type, admin, branch, staff]);

  const selectedBranchId = useAppSelector(
    (state) => state.selectedBranch.branchId
  );
  const storedBranchId = localStorage.getItem("branchid") || "";
  const storedAdminId = localStorage.getItem("adminid") || "";

  // Fetch branches to auto-detect when staff has no branch assigned
  const { data: branchesData } = useBranchesQuery();
  // firstBranchId is only a fallback for staff with no branch; admin uses the chosen branch.
  const firstBranchId = branchesData?.getBranches?.[0]?.id || "";

  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
      ? (branch?.admin?.id || admin?.id || storedAdminId)
      : type === "staff"
      ? (staff?.admin?.id || admin?.id || storedAdminId)
      : (admin?.id || storedAdminId);
  const branchId =
    type === "admin"
      ? selectedBranchId
      : type === "branch"
      ? (branch?.id || selectedBranchId || storedBranchId || firstBranchId)
      : type === "staff"
      ? (staff?.branchid?.id || selectedBranchId || storedBranchId || firstBranchId)
      : (selectedBranchId || storedBranchId);

  // Offline mode adds unsynced stock moves; otherwise the list as fetched.
  const stockedProductList = useOfflineStock(productServiceList, branchId);
  const PRODUCTS = useMemo(
    () => mapProductServiceList(stockedProductList),
    [stockedProductList]
  );

  const { addSalesInvoiceMutation } = useSalesInvoiceMutations();
  const { addSalesOrderMutation } = useSalesOrderMutations();

  // Fetch invoices & orders from server so we compute the real next number
  const { data: invoicesData, refetch: refetchInvoices } = useSalesInvoicesQuery();
  const { data: ordersData, refetch: refetchOrders } = useSalesOrdersQuery();
  const serverInvoices = invoicesData?.getSalesInvoices ?? [];
  const serverOrders = ordersData?.getSalesOrders ?? [];

  // Selected customer's last 5 bills/orders — dropdown history (mode-aware)
  const partyDocHistory = useMemo(
    () =>
      getLastPartyDocRows(
        isOrderMode ? serverOrders : serverInvoices,
        selectedParty?.id,
        undefined,
        isOrderMode ? "SO" : "INV"
      ),
    [isOrderMode, serverOrders, serverInvoices, selectedParty?.id]
  );

  // Staff is mainly an order-taker, not a billing person — default to ORDER mode
  useEffect(() => {
    if (type === "staff") setIsOrderMode(true);
  }, [type]);

  // Offline mode without network: next number of this device's own series.
  const { number: offlineNo, noDevice } = useOfflineNumber(isOrderMode ? "salesorder" : "salesinvoice");

  // Derive bill number from the actual server data based on current mode
  useEffect(() => {
    if (offlineNo || noDevice) {
      setBillNumber(offlineNo || "—");
      return;
    }
    const list = isOrderMode ? serverOrders : serverInvoices;
    setBillNumber(getNextBillNumber(list));
  }, [isOrderMode, serverInvoices, serverOrders, offlineNo, noDevice]);

  /* Keyboard: F2 search, F3 barcode, F4 customer, Alt+N new party, F8 hold, F9 recall, F10 clear, F12 pay, arrows + Enter on the item list */
  const keys = useRef<any>({});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      const el = e.target as HTMLElement;
      const inOther = /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName || "") && el !== searchRef.current;
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "F3") { e.preventDefault(); barcodeRef.current?.focus(); }
      else if (e.key === "F4") { e.preventDefault(); k.openCustomer(); }
      else if (e.key === "F8") { e.preventDefault(); k.holdCart(); }
      else if (e.key === "F9") { e.preventDefault(); k.recallCart(); }
      else if (e.key === "F10") { e.preventDefault(); k.clearCart(); }
      else if (e.key === "F12") { e.preventDefault(); k.openPay(); }
      // ⌥N on a Mac is a dead key ("˜"); match the key position and drop the mark it may leave.
      else if (e.altKey && (e.code === "KeyN" || e.key === "˜")) { e.preventDefault(); e.stopPropagation(); (el as HTMLInputElement)?.blur?.(); k.newParty(); }
      else if (e.key === "Escape") setPaymentOpen(false);
      else if (!k.busy && !inOther && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); k.moveRow(e.key === "ArrowDown" ? 1 : -1); }
      else if (!k.busy && el === searchRef.current && e.key === "Enter") { e.preventDefault(); k.addActive(); }
    };
    // Capture phase: runs before the focused box handles the key.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  /* Filtered subcategories */
  const subcategoriesForActive = useMemo(() => {
    if (!activeCategory) return subCategoryList;
    return subCategoryList.filter(
      (s: any) => s.category?.id === activeCategory
    );
  }, [activeCategory, subCategoryList]);

  /* Filtered products */
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (!p.status) return false;
      if (activeCategory && p.categoryId !== activeCategory) return false;
      if (activeSubcategory && p.subcategoryId !== activeSubcategory) return false;
      if (activeBrand && p.barndId !== activeBrand) return false;

      if (q) {
        const nameMatch = p.name.toLowerCase().includes(q);
        const brandMatch = (p.brandName || "").toLowerCase().includes(q);
        const skuMatch = p.variants?.some((v: any) =>
          (v.sku || "").toLowerCase().includes(q)
        );
        if (!nameMatch && !brandMatch && !skuMatch) return false;
      }
      return true;
    });
  }, [PRODUCTS, search, activeCategory, activeSubcategory, activeBrand]);

  /* Add to cart */
  const addToCart = (
    product: any,
    variantId: string | null = null,
    unitId: string | null = null
  ) => {
    const chosenVariant =
      product.variants.find(
        (v: any) =>
          v.variantId ===
          (variantId ?? selectedUnits[product.id]?.variantId)
      ) || product.variants[0];
    if (!chosenVariant) return;

    if (chosenVariant.currentstock <= 0) {
      dispatch(showMessage({ message: "Out of stock", type: "error" }));
      return;
    }

    const chosenUnit =
      chosenVariant.units.find(
        (u: any) => u.id === (unitId ?? selectedUnits[product.id]?.unitId)
      ) || chosenVariant.units[0];
    if (!chosenUnit) return;

    const cartId = `${product.id}_${chosenVariant.variantId}_${chosenUnit.id}`;

    const resolveAndAdd = async () => {
      // Product's own price, used when no price list applies.
      const basePrice =
        chosenUnit.offerprice ??
        chosenUnit.salesrate ??
        chosenUnit.price ??
        chosenUnit.mrp ??
        0;
      const baseDiscount = chosenUnit.discount ?? 0;
      let sellPrice = basePrice;
      let discount = baseDiscount;

      if (selectedParty) {
        try {
          const resolved = await resolvePrice({
            productid: product.id,
            variantid: chosenVariant.variantId,
            unitid: chosenUnit.id,
            accountid: selectedParty.id,
            // channel is an object; the resolver expects its id.
            channelid: selectedParty.channel?.id ?? selectedParty.channel ?? null,
            region: selectedParty.region ?? null,
          });
          if (resolved && resolved.rate != null) {
            sellPrice = resolved.rate;
            discount = Number(resolved.discount) || 0;
          }
        } catch (e) {
          console.error("POS Price resolution error:", e);
        }
      }

      setCart((prev) => {
        const usedBaseQty = prev
          .filter((c) => c.variantId === chosenVariant.variantId)
          .reduce(
            (sum, c) => sum + getCartItemBaseQty(c, chosenVariant),
            0
          );

        const newItemBaseQty = getBaseQuantity(1, chosenUnit.id, {
          unitconversions: chosenVariant.conversions.map((c: any) => ({
            unitid: c.unitId,
            factor: c.factor,
          })),
        });

        if (usedBaseQty + newItemBaseQty > chosenVariant.currentstock) {
          dispatch(
            showMessage({
              message: `Stock exceeded! Available: ${chosenVariant.currentstock}`,
              type: "error",
            })
          );
          return prev;
        }

        const existing = prev.find((c) => c.cartId === cartId);
        if (existing) {
          return prev.map((c) =>
            c.cartId === cartId ? { ...c, qty: c.qty + 1 } : c
          );
        }

        return [
          {
            cartId,
            productId: product.id,
            variantId: chosenVariant.variantId,
            variantName: chosenVariant.name,
            name: product.name,
            brandName: product.brandName,
            sizeName: product.sizeName,
            modelName: product.modelName,
            unitId: chosenUnit.id,
            unitName: chosenUnit.name,
            unitqty: chosenUnit.quantity ?? 1,
            price: sellPrice,
            basePrice,
            baseDiscount,
            mrp: chosenUnit.mrp,
            gst: chosenVariant.gst ?? 0,
            qty: 1,
            discount: discount,
            stockAvailable: chosenVariant.currentstock,
            salesaccountid: product.salesaccountid ?? null,
            purchaseaccountid: product.purchaseaccountid ?? null,
            serviceaccountid: product.serviceaccountid ?? null,
          },
          ...prev,
        ];
      });
    };

    resolveAndAdd();
  };

  // Re-price the cart from the customer's price list; walk-in uses base price.
  useEffect(() => {
    if (cart.length === 0) return;
    let cancelled = false;

    (async () => {
      const channelid = selectedParty?.channel?.id ?? selectedParty?.channel ?? null;
      const region = selectedParty?.region ?? null;

      const updated = await Promise.all(
        cart.map(async (c) => {
          const base = c.basePrice ?? c.price;
          const baseDisc = c.baseDiscount ?? 0;
          if (!selectedParty?.id) {
            return { ...c, price: base, discount: baseDisc };
          }
          try {
            const resolved = await resolvePrice({
              productid: c.productId,
              variantid: c.variantId,
              unitid: c.unitId,
              accountid: selectedParty.id,
              channelid,
              region,
            });
            if (resolved && resolved.rate != null) {
              return {
                ...c,
                price: resolved.rate,
                discount: Number(resolved.discount) || 0,
              };
            }
          } catch (e) {
            console.error("POS re-price error:", e);
          }
          return { ...c, price: base, discount: baseDisc }; // no assignment → base
        })
      );

      if (!cancelled) setCart(updated);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParty?.id]);

  /* Barcode submit */
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    let foundProd: any = null;
    let foundVarId: string | null = null;
    for (const p of PRODUCTS) {
      const variant = p.variants.find((v: any) => v.sku === barcode.trim());
      if (variant) {
        foundProd = p;
        foundVarId = variant.variantId;
        break;
      }
    }
    if (foundProd) {
      addToCart(foundProd, foundVarId);
      setBarcode("");
      dispatch(
        showMessage({
          message: `${foundProd.name} added to cart`,
          type: "success",
        })
      );
    } else {
      dispatch(showMessage({ message: "Product not found", type: "error" }));
      setBarcode("");
    }
  };

  /* Qty / remove */
  const updateQty = (cartId: string, qty: number) => {
    if (!(qty > 0)) {
      setCart((prev) => prev.filter((c) => c.cartId !== cartId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => {
        if (c.cartId !== cartId) return c;
        const product = PRODUCTS.find((p) => p.id === c.productId);
        const variant = product?.variants.find(
          (v: any) => v.variantId === c.variantId
        );
        if (!variant) return c;

        const newBaseQty = getCartItemBaseQty({ ...c, qty }, variant);
        const otherBaseQty = prev
          .filter(
            (x) => x.cartId !== cartId && x.variantId === c.variantId
          )
          .reduce((s, x) => s + getCartItemBaseQty(x, variant), 0);
        if (newBaseQty + otherBaseQty > variant.currentstock) {
          dispatch(
            showMessage({
              message: `Stock exceeded! Available: ${variant.currentstock}`,
              type: "error",
            })
          );
          return c;
        }
        return { ...c, qty };
      })
    );
  };

  const onSelectVariant = (productId: string, variantId: string) => {
    const product = PRODUCTS.find((p) => p.id === productId);
    const variant = product?.variants.find(
      (v: any) => v.variantId === variantId
    );
    const unitId = variant?.units?.[0]?.id;
    setSelectedUnits((prev: any) => ({
      ...prev,
      [productId]: { variantId, unitId },
    }));
  };

  const onSelectUnit = (productId: string, unitId: string) => {
    const prevSel = selectedUnits[productId] ?? ({} as any);
    setSelectedUnits((prev: any) => ({
      ...prev,
      [productId]: { variantId: prevSel.variantId, unitId },
    }));
  };

  /* Hold / Recall / Clear */
  const holdCart = () => {
    if (cart.length === 0) {
      dispatch(showMessage({ message: "Cart is empty", type: "error" }));
      return;
    }
    setHeldCarts((prev) => [...prev, cart]);
    setCart([]);
    dispatch(showMessage({ message: "Cart on hold", type: "success" }));
  };

  const recallCart = () => {
    if (heldCarts.length === 0) {
      dispatch(showMessage({ message: "No held cart", type: "error" }));
      return;
    }
    const last = heldCarts[heldCarts.length - 1];
    setCart((prev) => [...prev, ...last]);
    setHeldCarts((prev) => prev.slice(0, -1));
    dispatch(showMessage({ message: "Cart recalled", type: "success" }));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm("Clear all items from cart?")) setCart([]);
  };

  /* Totals */
  const subtotal = cart.reduce(
    (s, i) => s + (i.price ?? 0) * (i.qty ?? 0),
    0
  );
  const totaldiscount = cart.reduce(
    (s, i) => s + (i.discount ?? 0) * (i.qty ?? 0),
    0
  );
  const totalgst = cart.reduce((s, i) => {
    const lineNet = ((i.price ?? 0) - (i.discount ?? 0)) * (i.qty ?? 0);
    return s + (lineNet * (i.gst ?? 0)) / 100;
  }, 0);
  const total = subtotal - totaldiscount + totalgst;
  const totalItemQty = cart.reduce((s, i) => s + i.qty, 0);

  const getUnitId = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object" && "id" in value) return value.id ?? null;
    return null;
  };

  /* Submit / Save */
  // parts: what was paid, by mode (empty for an order); the rest of the bill stays on credit.
  const handlePaymentComplete = async (parts: { mode: string; amount: number }[]) => {
    // Customer is chosen in the cart; the drawer returns payment details only.
    if (!selectedParty?.id) {
      dispatch(
        showMessage({
          message: "Please pick a customer in the cart before completing payment.",
          type: "error",
        })
      );
      return;
    }

    // Missing branch usually means "All Branches" is selected; say so.
    if (!branchId) {
      dispatch(showMessage({ message: BRANCH_REQUIRED, type: "error" }));
      return;
    }
    if (!adminId) {
      dispatch(
        showMessage({
          message: "Session error: Admin ID is missing. Please re-login.",
          type: "error",
        })
      );
      return;
    }

    const input = {
      branchid: branchId,
      adminid: adminId,
      createdby_id: creatorInfo.id,
      createdby_name: creatorInfo.name,
      createdby_type: creatorInfo.type,
      paymenttype: isOrderMode ? "cash" : parts[0]?.mode || "credit",
      ...(isOrderMode ? {} : { received: Number(Math.min(parts.reduce((s, p) => s + p.amount, 0), total).toFixed(2)) }),
      ...(!isOrderMode && parts.length > 1 ? { paymentsplit: parts } : {}),
      partyacc: selectedParty.id,
      taxorsupplytype: "taxInvoice",
      billdate: todayYMD(),
      billtype: "taxInvoice",
      notes: "",
      subtotal: Number(subtotal.toFixed(2)),
      totaldiscount: Number(totaldiscount.toFixed(2)),
      totalgst: Number(totalgst.toFixed(2)),
      totalamount: Number(total.toFixed(2)),
      isservice: false,
      status: true,
      // Offline mode without network only: the device number shown above.
      ...(offlineNo ? { billnumber: offlineNo } : {}),
      productservice: cart.map((i) => {
        const lineGross = (i.price ?? 0) * (i.qty ?? 0);
        const lineDiscountTotal = (i.discount ?? 0) * (i.qty ?? 0);
        const lineNet = lineGross - lineDiscountTotal;
        const lineGst = (lineNet * (i.gst ?? 0)) / 100;
        const lineAmountInclusive = lineNet + lineGst;
        return {
          productserviceid: i.productId,
          variantid: i.variantId,
          salesunitid: i.unitId,
          unitqty: i.unitqty ?? 1,
          qty: i.qty,
          gst: i.gst,
          rate: i.price,
          discount: i.discount ?? 0,
          amount: Number(lineAmountInclusive.toFixed(2)),
          salesaccountid: getUnitId(i.salesaccountid) ?? null,
          purchaseaccountid: getUnitId(i.purchaseaccountid) ?? null,
          serviceaccountid: getUnitId(i.serviceaccountid) ?? null,
        };
      }),
    };

    setSaving(true);
    try {
      let savedOffline = false;
      if (isOrderMode) {
        const orderInput = { ...input, ordertype: "retail" };
        const res = await addSalesOrderMutation({ variables: { input: orderInput } });
        savedOffline = isOfflineSaved(res?.data?.addSalesOrder);
        dispatch(
          showMessage({
            message: savedOffline ? OFFLINE_SAVED_MESSAGE : "Sales Order saved successfully",
            type: "success",
          })
        );
      } else {
        const invoiceInput = { ...input, invoicetype: "retail" };
        const res = await addSalesInvoiceMutation({ variables: { input: invoiceInput } });
        savedOffline = isOfflineSaved(res?.data?.addSalesInvoice);
        dispatch(
          showMessage({
            message: savedOffline ? OFFLINE_SAVED_MESSAGE : "Invoice generated successfully",
            type: "success",
          })
        );
      }
      // Queued offline: the server refetches would only fail, so they wait for sync.
      if (!savedOffline) {
        await refetchProducts();
        // Refetch so the next bill/order number updates
        if (isOrderMode) await refetchOrders();
        else await refetchInvoices();
      }
    } catch (error: any) {
      console.error("Error:", error);
      dispatch(showMessage({ message: "An error occurred", type: "error" }));
    } finally {
      setSaving(false);
      setCart([]);
      setSelectedParty(walkInAccount || null);
      setPaymentOpen(false);
      barcodeRef.current?.focus();
    }
  };

  // A walk-in / cash customer account is picked by default, so a counter sale needs no customer search.
  const walkInAccount = customerOptions.find((c: any) => isWalkIn(c) && c.name);
  useEffect(() => {
    if (!selectedParty && walkInAccount) setSelectedParty(walkInAccount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkInAccount?.id]);

  const openPay = () => {
    if (cart.length === 0 || saving) return;
    if (!selectedParty?.id) {
      dispatch(showMessage({ message: "Pick a customer (F4) or create a Walk-in customer account.", type: "error" }));
      return;
    }
    if (isOrderMode) handlePaymentComplete([]);
    else setPaymentOpen(true);
  };

  // Line rate / per-unit discount typed in the voucher.
  const setLine = (cartId: string, patch: any) => setCart((prev) => prev.map((c) => (c.cartId === cartId ? { ...c, ...patch } : c)));

  /* Customer pick */
  const onPickCustomer = (id: string) => {
    const acc = customerOptions.find((c: any) => c.id === id);
    setSelectedParty(acc || null);
  };

  /* Render */
  const fmt = (n: any) =>
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const ymd = todayYMD().split("-");
  const displayDate = ymd.length === 3 ? `${ymd[2]}-${ymd[1]}-${ymd[0]}` : todayYMD();

  // Stock tiers: healthy first, low stock next, out of stock at the very bottom.
  const stockTier = (p: any) => {
    const s = p.variants?.[0]?.currentstock ?? 0;
    return s <= 0 ? 2 : s < 10 ? 1 : 0;
  };
  const sortedProducts = [...filteredProducts].sort((a, b) => stockTier(a) - stockTier(b));
  const rowIndex = Math.min(activeRow, Math.max(sortedProducts.length - 1, 0));
  const addRow = (p: any) => {
    if (!p || (p.variants?.[0]?.currentstock ?? 0) <= 0) return;
    const sel = selectedUnits[p.id] ?? {};
    addToCart(p, sel.variantId ?? null, sel.unitId ?? null);
  };
  const itemOf = (p: any) => {
    const sel = selectedUnits[p.id] ?? {
      variantId: p.variants?.[0]?.variantId,
      unitId: p.variants?.[0]?.units?.[0]?.id,
    };
    const selectedVariant = p.variants.find((v: any) => v.variantId === sel.variantId) || p.variants[0];
    const currentUnit = selectedVariant?.units?.find((u: any) => u.id === sel.unitId) || selectedVariant?.units?.[0];
    const stock = selectedVariant?.currentstock ?? 0;
    return { sel, selectedVariant, currentUnit, stock, outOfStock: stock <= 0, lowStock: stock > 0 && stock < 10 };
  };
  keys.current = {
    holdCart, recallCart, clearCart, openPay,
    newParty: () => {
      setBarcode((b) => b.replace(/˜$/, ""));
      setSearch((q) => q.replace(/˜$/, ""));
      setAddCustomerOpen(true);
    },
    // Focus the customer box and open its list (the select opens on ArrowDown).
    openCustomer: () => {
      const input = customerRef.current?.querySelector("input") as HTMLInputElement | null;
      if (!input) return;
      input.focus();
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", keyCode: 40, bubbles: true }));
    },
    busy: paymentOpen,
    moveRow: (d: number) => {
      const next = Math.min(Math.max(rowIndex + d, 0), Math.max(sortedProducts.length - 1, 0));
      setActiveRow(next);
      (listRef.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
    },
    addActive: () => addRow(sortedProducts[rowIndex]),
  };

  const tabBase =
    "shrink-0 px-3 h-8 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap";
  const tabOn = "!border-[#4f46e5] !text-[#4f46e5] !bg-transparent";
  const tabOff = "!border-transparent !text-slate-600 hover:!text-slate-900 !bg-transparent";
  const chipBase =
    "shrink-0 px-2.5 h-6 text-[11px] font-semibold rounded border transition cursor-pointer whitespace-nowrap";
  const chipOn = "!bg-[#4f46e5] !text-white !border-[#4f46e5]";
  const chipOff = "!bg-white !text-slate-700 !border-slate-300 hover:!bg-slate-100";

  return (
    <HomeLayout>
      <div className="flex flex-col min-h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)] bg-slate-100 font-sans text-[13px] text-slate-800 tabular-nums">
        {/* ===== HEADER: mode, barcode, search, voucher no ===== */}
        <div className="bg-white border-b border-slate-300 px-3 py-1.5 flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 shrink-0">
            <ShoppingCart size={16} className="text-[#4f46e5]" /> POS
          </div>
          <div className="flex items-center border border-slate-300 rounded overflow-hidden shrink-0">
            <button
              onClick={() => setIsOrderMode(true)}
              className={`px-3 h-8 text-[11px] font-bold tracking-wide cursor-pointer ${isOrderMode ? "!bg-[#4f46e5] !text-white" : "!bg-white !text-slate-600 hover:!bg-slate-100"}`}
            >
              ORDER
            </button>
            {type !== "staff" && (
              <button
                onClick={() => setIsOrderMode(false)}
                className={`px-3 h-8 text-[11px] font-bold tracking-wide cursor-pointer ${!isOrderMode ? "!bg-[#4f46e5] !text-white" : "!bg-white !text-slate-600 hover:!bg-slate-100"}`}
              >
                INVOICE
              </button>
            )}
          </div>
          <form
            onSubmit={handleBarcodeSubmit}
            className="flex items-center border border-slate-300 rounded px-2 h-8 bg-white focus-within:border-[#4f46e5] focus-within:ring-1 focus-within:ring-[#4f46e5]"
          >
            <ScanBarcode size={14} className="text-slate-500 mr-1.5 flex-shrink-0" />
            <input
              ref={barcodeRef}
              autoFocus
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Barcode / SKU (F3)"
              className="bg-transparent outline-none text-[13px] w-40 font-mono text-slate-900 placeholder:text-slate-400"
            />
          </form>
          <div className="flex items-center border border-slate-300 rounded px-2 h-8 bg-white flex-1 min-w-[220px] focus-within:border-[#4f46e5] focus-within:ring-1 focus-within:ring-[#4f46e5]">
            <Search size={14} className="text-slate-500 mr-1.5 flex-shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveRow(0); }}
              placeholder="Search item, brand or SKU (F2) · ↑↓ to pick · Enter to add"
              className="bg-transparent outline-none text-[13px] w-full text-slate-900 placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="!bg-transparent text-slate-400 hover:text-slate-600 cursor-pointer">
                <XIcon size={14} />
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs shrink-0">
            <div>
              <span className="text-slate-500 mr-1.5">{isOrderMode ? "Order No." : "Bill No."}</span>
              <span className="font-mono font-bold">{billNumber}</span>
              {noDevice && <span className="ml-1.5 text-amber-700">(given on sync)</span>}
            </div>
            <div className="hidden md:block">
              <span className="text-slate-500 mr-1.5">Date</span>
              <span className="font-mono font-bold">{displayDate}</span>
            </div>
            <div className="hidden xl:block">
              <span className="text-slate-500 mr-1.5">User</span>
              <span className="font-semibold">{creatorInfo.name}</span>
            </div>
          </div>
        </div>

        {/* ===== FILTERS: category tabs, subcategory & brand chips ===== */}
        <div className="bg-white border-b border-slate-300 shrink-0">
          <div className="px-2 flex gap-1 overflow-x-auto hide-scrollbar border-b border-slate-200">
            <button
              onClick={() => {
                setActiveCategory("");
                setActiveSubcategory(null);
              }}
              className={`${tabBase} ${!activeCategory ? tabOn : tabOff}`}
            >
              All Categories
            </button>
            {categoryList.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setActiveSubcategory(null);
                }}
                className={`${tabBase} ${activeCategory === cat.id ? tabOn : tabOff}`}
              >
                {cat.categoryname}
              </button>
            ))}
          </div>

          {(subcategoriesForActive.length > 0 || brandList.length > 0) && (
            <div className="px-3 py-1.5 flex items-center gap-1.5 bg-slate-50">
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar min-w-0 flex-1">
                {subcategoriesForActive.length > 0 && (
                  <>
                    <span className="text-[11px] text-slate-500 font-semibold self-center mr-1">Sub:</span>
                    <button
                      onClick={() => setActiveSubcategory(null)}
                      className={`${chipBase} ${activeSubcategory === null ? chipOn : chipOff}`}
                    >
                      All
                    </button>
                    {subcategoriesForActive.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSubcategory(s.id)}
                        className={`${chipBase} ${activeSubcategory === s.id ? chipOn : chipOff}`}
                      >
                        {s.subcategoryname}
                      </button>
                    ))}
                  </>
                )}
              </div>
              {brandList.length > 0 && (
                <select
                  value={activeBrand || ""}
                  onChange={(e) => setActiveBrand(e.target.value || null)}
                  className="h-6 shrink-0 rounded border border-slate-300 bg-white px-1.5 text-[12px] text-slate-700"
                >
                  <option value="">All brands</option>
                  {brandList.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.brandname}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* ===== MAIN: item ledger (left) + voucher (right) ===== */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 p-2">
          {/* ITEM SELECTION TABLE */}
          <div className="flex-1 min-w-0 min-h-[320px] lg:min-h-0 bg-white border border-slate-300 flex flex-col">
            <div className="px-3 h-8 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="font-semibold text-slate-700 flex items-center gap-2">
                <Package size={14} />
                Item Selection
                <span className="text-slate-500 font-normal">({sortedProducts.length} items)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500 hidden md:block">
                  {view === "grid" ? "Tap a tile to add" : "Click a row, or ↑↓ and Enter"}
                </span>
                <div className="flex rounded border border-slate-300 overflow-hidden">
                  {([["list", ListIcon, "List view"], ["grid", LayoutGrid, "Grid view"]] as const).map(([v, Icon, label]) => (
                    <button
                      key={v}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={view === v}
                      onClick={() => setView(v)}
                      className={`h-6 px-2 flex items-center gap-1 text-[11px] font-semibold cursor-pointer ${view === v ? "!bg-indigo-600 !text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
                    >
                      <Icon size={13} />
                      <span className="hidden sm:inline">{v === "list" ? "List" : "Grid"}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {view === "grid" ? (
            <div className="flex-1 overflow-auto p-1.5">
              {sortedProducts.length === 0 ? (
                <div className="text-center py-16 text-slate-400">No items found. Clear filters or refine your search.</div>
              ) : (
              <div ref={(el) => { listRef.current = el; }} className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-1.5">
                {sortedProducts.map((p, idx) => {
                  const { sel, selectedVariant, currentUnit, stock, outOfStock, lowStock } = itemOf(p);
                  const price = currentUnit?.price ?? 0;
                  const mrp = currentUnit?.mrp ?? 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => { setActiveRow(idx); if (!outOfStock) addToCart(p, sel.variantId, sel.unitId); }}
                      className={`relative flex flex-col bg-white border rounded select-none ${
                        idx === rowIndex ? "border-indigo-500 ring-1 ring-indigo-300" : "border-slate-300"
                      } ${outOfStock ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-indigo-400 active:bg-indigo-50"}`}
                    >
                      <div className="relative h-16 bg-slate-50 border-b border-slate-200 flex items-center justify-center overflow-hidden rounded-t">
                        <Package size={22} className="text-slate-300" />
                        {p.image && (
                          // Covers the icon; hidden if the file is missing so the icon shows.
                          <img src={p.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 m-auto max-h-full max-w-full object-contain bg-slate-50" />
                        )}
                      </div>
                      <span className={`absolute top-0.5 left-0.5 px-1 rounded text-[10px] font-bold font-mono bg-white/90 border ${
                        outOfStock ? "text-red-600 border-red-200" : lowStock ? "text-amber-600 border-amber-200" : "text-emerald-700 border-emerald-200"
                      }`}>
                        {outOfStock ? 0 : stock}
                      </span>
                      <div className="px-1.5 py-1 flex flex-col gap-0.5 flex-1">
                        <div className="font-semibold text-slate-800 text-[12px] leading-tight line-clamp-2 min-h-[2.1em]" title={p.name}>{p.name}</div>
                        <div className="flex items-center gap-1 text-[10.5px] text-slate-500 min-w-0">
                          <span className="font-mono shrink-0">{selectedVariant?.sku || "—"}</span>
                          <span className="truncate">{[p.brandName, p.sizeName].filter(Boolean).join(" · ")}</span>
                        </div>
                        <div className="flex items-baseline gap-1 font-mono">
                          <span className="font-bold text-slate-900 text-[12.5px]">₹{fmt(price)}</span>
                          {mrp > price && <span className="text-[10px] text-slate-400 line-through">{fmt(mrp)}</span>}
                        </div>
                        {p.variants.length > 1 && (
                          <select
                            className="h-6 w-full rounded border border-slate-300 bg-white px-1 py-0 text-[11px] leading-none"
                            value={sel.variantId}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onSelectVariant(p.id, e.target.value)}
                          >
                            {p.variants.map((v: any) => (
                              <option key={v.variantId} value={v.variantId}>{v.name}</option>
                            ))}
                          </select>
                        )}
                        {selectedVariant?.units?.length > 1 ? (
                          <select
                            className="h-6 w-full rounded border border-slate-300 bg-white px-1 py-0 text-[11px] leading-none"
                            value={sel.unitId}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onSelectUnit(p.id, e.target.value)}
                          >
                            {selectedVariant.units.map((u: any) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-[10.5px] text-slate-500 truncate">{currentUnit?.name || "\u00a0"}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
            ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[12.5px] border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 text-[10.5px] uppercase tracking-normal">
                  <tr className="border-b border-slate-300">
                    <th className="text-left px-2 py-1.5 font-semibold">Code / SKU</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Item</th>
                    <th className="text-left px-2 py-1.5 font-semibold hidden md:table-cell">Brand / Size</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Variant</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Unit</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Stock</th>
                    <th className="text-right px-2 py-1.5 font-semibold hidden sm:table-cell">MRP (₹)</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Rate (₹)</th>
                    <th className="px-2 py-1.5 w-16"></th>
                  </tr>
                </thead>
                <tbody ref={(el) => { listRef.current = el; }}>
                  {sortedProducts.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-slate-400">
                        No items found. Clear filters or refine your search.
                      </td>
                    </tr>
                  )}

                  {sortedProducts.map((p, idx) => {
                    const { sel, selectedVariant, currentUnit, stock, outOfStock, lowStock } = itemOf(p);

                    return (
                      <tr
                        key={p.id}
                        onClick={() => { setActiveRow(idx); if (!outOfStock) addToCart(p, sel.variantId, sel.unitId); }}
                        className={`border-b border-slate-200 ${
                          idx === rowIndex ? "!bg-indigo-50 outline outline-1 -outline-offset-1 outline-indigo-300" : idx % 2 ? "bg-slate-50" : "bg-white"
                        } ${
                          outOfStock
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer hover:bg-indigo-50"
                        }`}
                      >
                        <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500">
                          {selectedVariant?.sku || "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="font-semibold text-slate-800 leading-tight line-clamp-1">{p.name}</div>
                        </td>
                        <td className="px-2 py-1.5 text-slate-600 hidden md:table-cell whitespace-nowrap">
                          {[p.brandName, p.sizeName].filter(Boolean).join(" · ") || "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          {p.variants.length > 1 ? (
                            <select
                              className="h-6 w-full max-w-[150px] truncate rounded border border-slate-300 bg-white px-1 py-0 text-[12px] leading-none"
                              value={sel.variantId}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onSelectVariant(p.id, e.target.value)}
                            >
                              {p.variants.map((v: any) => (
                                <option key={v.variantId} value={v.variantId}>
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="block max-w-[150px] truncate whitespace-nowrap text-slate-600" title={selectedVariant?.name || ""}>{selectedVariant?.name || "—"}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {selectedVariant?.units?.length > 1 ? (
                            <select
                              className="h-6 w-full max-w-[150px] truncate rounded border border-slate-300 bg-white px-1 py-0 text-[12px] leading-none"
                              value={sel.unitId}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onSelectUnit(p.id, e.target.value)}
                            >
                              {selectedVariant.units.map((u: any) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="block max-w-[150px] truncate whitespace-nowrap text-slate-600">{currentUnit?.name || "—"}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {outOfStock ? (
                            <span className="text-red-600 font-bold">0</span>
                          ) : (
                            <span className={lowStock ? "text-amber-600 font-bold" : "text-emerald-700 font-semibold"}>
                              {stock}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-500 hidden sm:table-cell">
                          {currentUnit?.mrp ? fmt(currentUnit.mrp) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-900">
                          {fmt(currentUnit?.price)}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            disabled={outOfStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(p, sel.variantId, sel.unitId);
                            }}
                            className="px-2.5 h-6 text-[11px] font-bold rounded !bg-[#4f46e5] hover:!bg-[#4338ca] disabled:!bg-slate-300 !text-white cursor-pointer disabled:cursor-not-allowed"
                          >
                            ADD
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* VOUCHER (CART) */}
          <div className="lg:w-[460px] xl:w-[500px] shrink-0 bg-white border border-slate-300 flex flex-col min-h-[420px] lg:min-h-0">
            {/* Party */}
            <div ref={customerRef} className="p-2 border-b border-slate-300 bg-slate-50 shrink-0">
              <FormField
                label="Party A/c (Customer) · F4"
                name="customer"
                type="select"
                value={selectedParty?.id || ""}
                onChange={(e: any) => onPickCustomer(e.target.value)}
                options={customerOptions.map((c: any) => ({
                  value: c.id,
                  label: partyLabel(c, "•"),
                }))}
                searchable
                addable
                onAddNew={() => setAddCustomerOpen(true)}
                placeholder="Walk-in customer"
                historyTitle={
                  selectedParty?.id
                    ? `Last 5 ${isOrderMode ? "Orders" : "Bills"} of this Customer`
                    : `Customer ${isOrderMode ? "Order" : "Bill"} History`
                }
                historyHeaders={[
                  isOrderMode ? "Order No" : "Bill No",
                  "Date",
                  "Qty",
                  "Disc (₹)",
                  "Total (₹)",
                ]}
                historyRows={partyDocHistory}
                historyEmptyText={
                  selectedParty?.id
                    ? `No previous ${isOrderMode ? "orders" : "bills"} for this customer.`
                    : "Select a customer first to see their history."
                }
              />
            </div>

            {/* Voucher header strip */}
            <div className="px-3 h-8 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="font-semibold text-slate-700 flex items-center gap-2">
                <ShoppingCart size={14} />
                Voucher Items
                <span className="text-slate-500 font-normal">
                  ({cart.length} line{cart.length !== 1 ? "s" : ""} · {totalItemQty} qty)
                </span>
              </div>
            </div>

            {/* Voucher lines */}
            <div className="flex-1 min-h-[140px] overflow-auto">
              {cart.length === 0 ? (
                <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-slate-400">
                  <ShoppingCart size={28} className="text-slate-300" />
                  <div className="text-xs mt-2 font-semibold">No items in voucher</div>
                  <div className="text-[11px] mt-0.5">Select an item from the ledger or scan a barcode</div>
                </div>
              ) : (
                <table className="w-full text-[12.5px] border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 text-[10.5px] uppercase tracking-normal">
                    <tr className="border-b border-slate-300">
                      <th className="text-left px-2 py-1.5 font-semibold w-8">#</th>
                      <th className="text-left px-2 py-1.5 font-semibold">Particulars</th>
                      <th className="text-center px-2 py-1.5 font-semibold w-[104px]">Qty</th>
                      <th className="text-right px-2 py-1.5 font-semibold">Rate</th>
                      <th className="text-right px-2 py-1.5 font-semibold">Disc</th>
                      <th className="text-right px-2 py-1.5 font-semibold">Amount</th>
                      <th className="w-7"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((it, i) => {
                      const lineNet = ((it.price ?? 0) - (it.discount ?? 0)) * (it.qty ?? 0);
                      const lineGst = (lineNet * (it.gst ?? 0)) / 100;
                      const lineTotal = lineNet + lineGst;
                      return (
                        <tr key={it.cartId} className="border-b border-slate-200 align-middle hover:bg-slate-50">
                          <td className="px-2 py-1.5 font-mono text-slate-500">{i + 1}</td>
                          <td className="px-2 py-1.5">
                            <div className="font-semibold text-slate-800 leading-tight truncate max-w-[180px]" title={it.name}>{it.name}</div>
                            <div className="text-[11px] text-slate-500 leading-tight truncate max-w-[180px]" title={[it.variantName, it.unitName].filter(Boolean).join(" · ")}>
                              {[it.variantName, it.unitName].filter(Boolean).join(" · ") || "—"}
                              {it.gst > 0 && <span> · GST {it.gst}%</span>}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                onClick={() => updateQty(it.cartId, it.qty - 1)}
                                className="w-6 h-6 border border-slate-300 rounded !bg-white hover:!bg-slate-100 !text-slate-700 flex items-center justify-center cursor-pointer"
                              >
                                <Minus size={11} />
                              </button>
                              <input
                                type="number"
                                value={it.qty}
                                min={0}
                                step="any"
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  if (v > 0) updateQty(it.cartId, v);
                                }}
                                className="w-12 h-6 text-center font-mono border border-slate-300 rounded text-[12px] font-semibold !bg-white"
                              />
                              <button
                                onClick={() => updateQty(it.cartId, it.qty + 1)}
                                className="w-6 h-6 border border-slate-300 rounded !bg-white hover:!bg-slate-100 !text-slate-700 flex items-center justify-center cursor-pointer"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          </td>
                          <td className="px-1 py-1.5 text-right">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={it.price ?? 0}
                              onChange={(e) => setLine(it.cartId, { price: Math.max(Number(e.target.value) || 0, 0) })}
                              className="w-[72px] h-6 text-right font-mono border border-slate-200 rounded px-1 text-[12px] !bg-white focus:border-[#4f46e5] outline-none"
                            />
                          </td>
                          <td className="px-1 py-1.5 text-right">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={it.discount ?? 0}
                              onChange={(e) => setLine(it.cartId, { discount: Math.min(Math.max(Number(e.target.value) || 0, 0), it.price ?? 0) })}
                              className="w-[60px] h-6 text-right font-mono border border-slate-200 rounded px-1 text-[12px] text-amber-700 !bg-white focus:border-[#4f46e5] outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-900">
                            {fmt(lineTotal)}
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button
                              onClick={() => updateQty(it.cartId, 0)}
                              title="Remove line"
                              className="!bg-transparent text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <XIcon size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Totals block */}
            <div className="border-t border-slate-300 bg-slate-50 px-3 py-2 shrink-0 font-mono text-[12.5px]">
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Items / Qty</span>
                <span>{cart.length} / {totalItemQty}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Sub Total</span>
                <span>₹ {fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Less: Discount</span>
                <span className="text-amber-700">− ₹ {fmt(totaldiscount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Add: GST</span>
                <span>₹ {fmt(totalgst)}</span>
              </div>
              <div className="flex justify-between items-baseline mt-1.5 pt-1.5 border-t-2 border-double border-slate-800 text-slate-900">
                <span className="font-sans text-sm font-bold uppercase tracking-wide">Total</span>
                <span className="text-lg font-bold">₹ {fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== ACTION BAR ===== */}
        <div className="bg-white text-slate-800 border-t border-slate-300 px-3 h-12 flex items-center gap-2 shrink-0 overflow-x-auto hide-scrollbar">
          {[
            { label: "+ New Party", on: () => setAddCustomerOpen(true), k: "Alt+N" },
            { label: "Hold", on: holdCart, k: "F8" },
            { label: `Recall${heldCarts.length > 0 ? ` (${heldCarts.length})` : ""}`, on: recallCart, k: "F9" },
            { label: "Clear", on: clearCart, k: "F10" },
          ].map((b) => (
            <button
              key={b.label}
              onClick={b.on}
              className="flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold rounded border !border-slate-300 !bg-white hover:!bg-slate-100 !text-slate-700 cursor-pointer whitespace-nowrap"
            >
              {b.label} {b.k && <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-mono text-[10px] text-slate-500">{b.k}</kbd>}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-3">
            {offlinePrice && (
              <span className="text-[11px] font-medium text-amber-700" title="Price list not available offline; the product's own rate is used.">
                Offline price
              </span>
            )}
            <div className="hidden md:block text-right leading-tight">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Payable</div>
              <div className="font-mono font-bold text-base">₹ {fmt(total)}</div>
            </div>
            <button
              disabled={cart.length === 0 || !selectedParty?.id || saving}
              onClick={openPay}
              className="flex items-center gap-2 px-5 h-9 text-[13px] font-bold rounded !bg-[#4f46e5] !text-white hover:!bg-[#4338ca] disabled:!bg-slate-200 disabled:!text-slate-400 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              {saving ? "Saving..." : isOrderMode ? "Save Order" : "Proceed to Payment"}
              <span className="text-[10px] font-medium opacity-70">F12</span>
            </button>
          </div>
        </div>

        {paymentOpen && (
          <PosPayment
            total={Number(total.toFixed(2))}
            walkIn={isWalkIn(selectedParty)}
            saving={saving}
            onClose={() => setPaymentOpen(false)}
            onDone={(parts) => handlePaymentComplete(parts)}
          />
        )}

        {/* Add customer modal */}
        <PosAddCustomer
          variant="pos"
          open={addCustomerOpen}
          onClose={() => setAddCustomerOpen(false)}
          onCreated={async (newId: string) => {
            await refetchAccounts();
            const fresh = (accountData?.getAccounts || []).find((a: any) => a.id === newId);
            if (fresh) setSelectedParty(fresh);
          }}
          mode="customer"
        />
      </div>
    </HomeLayout>
  );
}

const PAY_MODES = [
  { mode: "cash", label: "Cash" },
  { mode: "upi", label: "UPI" },
  { mode: "card", label: "Card" },
  { mode: "bank", label: "Bank" },
] as const;

// Payment: cash given (with change), UPI, card and bank in any mix; what is left stays on credit.
function PosPayment({ total, walkIn, saving, onClose, onDone }: { total: number; walkIn: boolean; saving: boolean; onClose: () => void; onDone: (parts: { mode: string; amount: number }[]) => void }) {
  const [amounts, setAmounts] = useState<Record<string, string>>({ cash: String(total) });
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.select(); }, []);
  const num = (m: string) => Math.max(Number(amounts[m] || 0), 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const others = PAY_MODES.filter((p) => p.mode !== "cash").reduce((s, p) => s + num(p.mode), 0);
  const cashApplied = Math.max(Math.min(num("cash"), total - others), 0);
  const change = Math.max(num("cash") - cashApplied, 0);
  const paid = Math.min(cashApplied + others, total);
  const balance = r2(Math.max(total - paid, 0));
  const over = others > total + 0.001;
  const parts = PAY_MODES.map((p) => ({ mode: p.mode, amount: r2(p.mode === "cash" ? cashApplied : num(p.mode)) })).filter((p) => p.amount > 0);
  const invalid = over || (balance > 0 && walkIn);
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rest = (m: string) => {
    const without = PAY_MODES.filter((p) => p.mode !== m).reduce((s, p) => s + (p.mode === "cash" ? Math.min(num("cash"), total) : num(p.mode)), 0);
    setAmounts((a) => ({ ...a, [m]: String(r2(Math.max(total - without, 0))) }));
  };
  const quick = [...new Set([Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 2000) * 2000])].filter((v) => v > total).slice(0, 3);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-3" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (!invalid && !saving) onDone(parts); }}
        className="w-full max-w-md rounded border border-slate-300 bg-white text-[13px] text-slate-800 shadow-lg"
      >
        <div className="flex h-10 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 font-semibold">
          Payment
          <button type="button" onClick={onClose} className="!bg-transparent text-slate-400 hover:text-slate-600 cursor-pointer"><XIcon size={16} /></button>
        </div>
        <div className="space-y-2 p-3">
          <div className="flex items-baseline justify-between border-b-2 border-double border-slate-800 pb-1.5">
            <span className="font-semibold uppercase">Bill total</span>
            <span className="font-mono text-lg font-bold">₹ {fmt(total)}</span>
          </div>
          {PAY_MODES.map((p, i) => (
            <div key={p.mode} className="flex items-center gap-2">
              <span className="w-12 text-slate-600">{p.label}</span>
              <input
                ref={i === 0 ? first : undefined}
                type="number"
                min={0}
                step="any"
                value={amounts[p.mode] ?? ""}
                onChange={(e) => setAmounts((a) => ({ ...a, [p.mode]: e.target.value }))}
                placeholder="0.00"
                className="h-8 flex-1 rounded border border-slate-300 px-2 text-right font-mono outline-none focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5]"
              />
              <button type="button" onClick={() => rest(p.mode)} className="h-8 rounded border border-slate-300 !bg-white px-2 text-[12px] font-medium hover:!bg-slate-100 cursor-pointer">
                Rest
              </button>
            </div>
          ))}
          {quick.length > 0 && (
            <div className="flex items-center gap-1.5 pl-14">
              {quick.map((v) => (
                <button key={v} type="button" onClick={() => setAmounts((a) => ({ ...a, cash: String(v) }))} className="h-7 rounded border border-slate-300 !bg-white px-2 text-[12px] font-mono hover:!bg-slate-100 cursor-pointer">
                  ₹{v.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-0.5 rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12.5px]">
            <div className="flex justify-between"><span className="font-sans text-slate-600">Received</span><span>₹ {fmt(paid)}</span></div>
            <div className="flex justify-between"><span className="font-sans text-slate-600">Change to give</span><span className="font-bold text-emerald-700">₹ {fmt(change)}</span></div>
            <div className="flex justify-between"><span className="font-sans text-slate-600">On credit</span><span className={balance > 0 ? "font-bold text-amber-700" : ""}>₹ {fmt(balance)}</span></div>
          </div>
          {over && <div className="text-[12px] text-red-600">UPI, card and bank together are more than the bill.</div>}
          {!over && balance > 0 && walkIn && <div className="text-[12px] text-red-600">Pick a customer to leave a balance on credit.</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-3 py-2">
          <button type="button" onClick={onClose} className="h-8 rounded border border-slate-300 !bg-white px-3 font-semibold hover:!bg-slate-100 cursor-pointer">Cancel</button>
          <button type="submit" disabled={invalid || saving} className="h-8 rounded !bg-[#4f46e5] px-4 font-bold !text-white hover:!bg-[#4338ca] disabled:!bg-slate-200 disabled:!text-slate-400 cursor-pointer">
            {saving ? "Saving..." : balance > 0 ? "Save (part credit)" : "Save Invoice"} <span className="text-[10px] font-medium opacity-70">Enter</span>
          </button>
        </div>
      </form>
    </div>
  );
}
