// Tally-style retail POS: Staff/Branch/Admin can take orders or generate invoices.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import HomeLayout from "../../layouts/home";
import {
  Search,
  ShoppingCart,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  X as XIcon,
  PauseCircle,
  RotateCcw,
  ArrowLeft,
  Maximize2,
  Minimize2,
  UserPlus,
} from "lucide-react";

import { useCategoriesQuery } from "../../graphql/hooks/categories";
import { useSubCategoriesQuery } from "../../graphql/hooks/subcategories";
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
import OfflineHeaderStatus from "../../offline/OfflineHeaderStatus";

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
  const navigate = useNavigate();

  /* Fetch master data */
  const { data: catData } = useCategoriesQuery();
  const categoryList = catData?.getCategories || [];

  const { data: subData } = useSubCategoriesQuery();
  const subCategoryList = subData?.getSubCategories || [];


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

  const [cart, setCart] = useState<any[]>([]);
  const [heldCarts, setHeldCarts] = useState<any[][]>([]);
  const [selectedUnits] = useState<any>({});
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [isOrderMode, setIsOrderMode] = useState(true);
  const [barcode, setBarcode] = useState("");
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [billNumber, setBillNumber] = useState("000001");

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLDivElement>(null);
  // Bill line the keypad edits, keypad target and typed value.
  const [selected, setSelected] = useState<string | null>(null);
  const [padMode, setPadMode] = useState<"qty" | "disc" | "rate">("qty");
  const [padBuf, setPadBuf] = useState("");
  const [chooser, setChooser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [isFull, setIsFull] = useState(false);

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

  /* Keyboard: F2 search, F3 scan, F4 customer, F8 hold, F9 recall, F10 clear, F12 pay, +/- and Delete on the line */
  const keys = useRef<any>({});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName || "");
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "F3") { e.preventDefault(); barcodeRef.current?.focus(); }
      else if (e.key === "F4") { e.preventDefault(); (customerRef.current?.querySelector("input,button") as HTMLElement | null)?.click(); }
      else if (e.key === "F8") { e.preventDefault(); k.holdCart(); }
      else if (e.key === "F9") { e.preventDefault(); k.recallCart(); }
      else if (e.key === "F10") { e.preventDefault(); k.clearCart(); }
      else if (e.key === "F12") { e.preventDefault(); k.openPay(); }
      else if (e.key === "Escape") { setPaymentOpen(false); setChooser(null); }
      else if (k.busy) return;
      else if (!typing && k.sel && (e.key === "+" || e.key === "-")) { e.preventDefault(); k.updateQty(k.sel.cartId, k.sel.qty + (e.key === "+" ? 1 : -1)); }
      else if (!typing && k.sel && e.key === "Delete") { e.preventDefault(); k.updateQty(k.sel.cartId, 0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Browser full screen for the counter.
  useEffect(() => {
    const on = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFullScreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

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
  }, [PRODUCTS, search, activeCategory, activeSubcategory]);

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

        setSelected(cartId);
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
      setSelected(null);
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

  // A tap adds the product; a choice of variant or unit opens the chooser.
  const pickProduct = (p: any) => {
    const options = (p.variants || []).reduce((n: number, v: any) => n + Math.max(v.units?.length || 0, 1), 0);
    if (options > 1) setChooser(p);
    else addToCart(p);
  };

  const selLine = cart.find((c) => c.cartId === selected) || cart[0] || null;
  const padPress = (k: string) =>
    setPadBuf((b) => (k === "C" ? "" : k === "back" ? b.slice(0, -1) : k === "." && b.includes(".") ? b : (b + k).slice(0, 10)));
  // Enter on the keypad: quantity, per-unit discount or rate of the selected line.
  const applyPad = () => {
    if (!selLine || padBuf === "") return;
    const v = Number(padBuf);
    setPadBuf("");
    if (!Number.isFinite(v) || v < 0) return;
    if (padMode === "qty") return updateQty(selLine.cartId, v);
    setCart((prev) =>
      prev.map((c) =>
        c.cartId !== selLine.cartId ? c : padMode === "rate" ? { ...c, price: v } : { ...c, discount: Math.min(v, c.price ?? 0) }
      )
    );
  };

  const openPay = () => {
    if (cart.length === 0 || saving) return;
    if (!selectedParty?.id) {
      dispatch(showMessage({ message: "Pick a customer (F4) or create a Walk-in customer account.", type: "error" }));
      return;
    }
    if (isOrderMode) handlePaymentComplete([]);
    else setPaymentOpen(true);
  };
  keys.current = { holdCart, recallCart, clearCart, openPay, updateQty, sel: selLine, busy: paymentOpen || !!chooser };

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

  const chipBase = "shrink-0 px-3 h-9 rounded-full border text-[13px] font-medium cursor-pointer whitespace-nowrap";
  const chipOn = "!bg-indigo-600 !text-white !border-indigo-600";
  const chipOff = "!bg-white !text-slate-700 !border-slate-300 hover:!bg-slate-50";
  const key = "h-14 rounded-lg border border-slate-200 bg-white text-lg font-semibold text-slate-800 active:bg-slate-100 cursor-pointer select-none";

  return (
    <HomeLayout>
      <div className="fixed inset-0 z-[55] flex flex-col bg-slate-100 text-[13px] text-slate-800 tabular-nums">
        {/* Top bar */}
        <div className="flex h-14 shrink-0 items-center gap-3 bg-slate-900 px-3 text-white">
          <button onClick={() => navigate("/")} className="flex h-10 items-center gap-1.5 rounded-lg px-3 hover:bg-white/10 cursor-pointer" title="Back to admin">
            <ArrowLeft size={18} /> <span className="hidden sm:inline">Exit</span>
          </button>
          <div className="flex items-center gap-2 font-semibold">
            <ShoppingCart size={18} /> POS
          </div>
          <div className="flex overflow-hidden rounded-lg bg-white/10 p-0.5">
            <button onClick={() => setIsOrderMode(false)} disabled={type === "staff"} className={`h-9 rounded-md px-4 text-[13px] font-semibold cursor-pointer disabled:opacity-40 ${!isOrderMode ? "bg-white text-slate-900" : "text-white/80"}`}>
              Invoice
            </button>
            <button onClick={() => setIsOrderMode(true)} className={`h-9 rounded-md px-4 text-[13px] font-semibold cursor-pointer ${isOrderMode ? "bg-white text-slate-900" : "text-white/80"}`}>
              Order
            </button>
          </div>
          <div className="ml-auto hidden items-center gap-5 md:flex">
            <span>
              <span className="text-white/60">{isOrderMode ? "Order" : "Bill"} </span>
              <span className="font-mono font-semibold">{billNumber}</span>
              {noDevice && <span className="ml-1 text-amber-300">(on sync)</span>}
            </span>
            <span className="font-mono">{displayDate}</span>
            <span className="text-white/80">{creatorInfo.name}</span>
          </div>
          <OfflineHeaderStatus />
          <button onClick={toggleFullScreen} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer" title="Full screen">
            {isFull ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>

        {/* Scan, search, customer */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <form onSubmit={handleBarcodeSubmit} className="flex h-12 min-w-[240px] flex-1 items-center gap-2 rounded-lg border-2 border-indigo-600 bg-white px-3">
            <ScanBarcode size={20} className="text-indigo-600" />
            <input
              ref={barcodeRef}
              autoFocus
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan barcode / SKU (F3)"
              className="w-full bg-transparent font-mono text-[15px] outline-none placeholder:text-slate-400"
            />
          </form>
          <div className="flex h-12 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
            <Search size={18} className="text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && sortedProducts[0]) {
                  e.preventDefault();
                  pickProduct(sortedProducts[0]);
                  setSearch("");
                }
              }}
              placeholder="Search item, brand or SKU (F2), Enter adds the first"
              className="w-full bg-transparent text-[14px] outline-none placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 cursor-pointer">
                <XIcon size={16} />
              </button>
            )}
          </div>
          <div className="flex min-w-[280px] flex-1 items-center gap-2" ref={customerRef}>
            <div className="flex-1">
              <FormField
                label=""
                name="customer"
                type="select"
                value={selectedParty?.id || ""}
                onChange={(e: any) => onPickCustomer(e.target.value)}
                options={customerOptions.map((c: any) => ({ value: c.id, label: partyLabel(c, "•") }))}
                searchable
                addable
                onAddNew={() => setAddCustomerOpen(true)}
                placeholder="Customer (F4) - name or mobile"
                historyTitle={selectedParty?.id ? `Last 5 ${isOrderMode ? "Orders" : "Bills"} of this Customer` : `Customer ${isOrderMode ? "Order" : "Bill"} History`}
                historyHeaders={[isOrderMode ? "Order No" : "Bill No", "Date", "Qty", "Disc (₹)", "Total (₹)"]}
                historyRows={partyDocHistory}
                historyEmptyText={selectedParty?.id ? `No previous ${isOrderMode ? "orders" : "bills"} for this customer.` : "Select a customer first to see their history."}
              />
            </div>
            <button onClick={() => setAddCustomerOpen(true)} className="flex h-12 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 font-medium hover:bg-slate-50 cursor-pointer">
              <UserPlus size={18} /> New
            </button>
          </div>
        </div>

        {/* Bill + keypad/tiles */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[1fr_400px]">
          {/* Bill */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid shrink-0 grid-cols-[36px_1fr_150px_90px_80px_100px_44px] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold uppercase text-slate-500">
              <span>#</span>
              <span>Item</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Disc</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                  <ScanBarcode size={48} />
                  <div className="text-[15px] font-medium text-slate-500">Scan an item or tap a product</div>
                  <div className="text-[12px]">F2 search · F3 scan · F4 customer · F12 pay</div>
                </div>
              ) : (
                cart.map((i, idx) => {
                  const net = ((i.price ?? 0) - (i.discount ?? 0)) * (i.qty ?? 0);
                  const amt = net + (net * (i.gst ?? 0)) / 100;
                  const on = i.cartId === selected;
                  return (
                    <div
                      key={i.cartId}
                      onClick={() => setSelected(i.cartId)}
                      className={`grid min-h-[60px] grid-cols-[36px_1fr_150px_90px_80px_100px_44px] items-center gap-2 border-b border-slate-100 px-3 cursor-pointer ${on ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300" : "hover:bg-slate-50"}`}
                    >
                      <span className="text-slate-400">{cart.length - idx}</span>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-slate-900">{i.name}</div>
                        <div className="truncate text-[12px] text-slate-500">
                          {[i.variantName, i.unitName, i.brandName].filter(Boolean).join(" · ")}
                          {i.gst ? ` · GST ${i.gst}%` : ""}
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => updateQty(i.cartId, i.qty - 1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white active:bg-slate-100 cursor-pointer">
                          <Minus size={16} />
                        </button>
                        <span className="w-12 text-center text-[15px] font-bold">{i.qty}</span>
                        <button onClick={() => updateQty(i.cartId, i.qty + 1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white active:bg-slate-100 cursor-pointer">
                          <Plus size={16} />
                        </button>
                      </div>
                      <span className="text-right">{fmt(i.price)}</span>
                      <span className="text-right text-orange-600">{i.discount ? fmt(i.discount) : "-"}</span>
                      <span className="text-right text-[14px] font-semibold">{fmt(amt)}</span>
                      <button onClick={(e) => { e.stopPropagation(); updateQty(i.cartId, 0); }} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 cursor-pointer" title="Remove">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Keypad + quick tiles */}
          <div className="flex min-h-0 flex-col gap-2">
            <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-2">
              <div className="mb-2 flex items-center gap-2">
                {(["qty", "disc", "rate"] as const).map((m) => (
                  <button key={m} onClick={() => { setPadMode(m); setPadBuf(""); }} className={`h-10 flex-1 rounded-lg border text-[13px] font-semibold cursor-pointer ${padMode === m ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                    {m === "qty" ? "Qty" : m === "disc" ? "Disc ₹" : "Rate ₹"}
                  </button>
                ))}
              </div>
              <div className="mb-2 flex h-12 items-center justify-between rounded-lg bg-slate-900 px-3 text-white">
                <span className="truncate text-[12px] text-white/70">{selLine ? selLine.name : "Select a line"}</span>
                <span className="font-mono text-[22px] font-bold">{padBuf || (selLine ? String(padMode === "qty" ? selLine.qty : padMode === "disc" ? selLine.discount ?? 0 : selLine.price ?? 0) : "0")}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {["7", "8", "9"].map((d) => <button key={d} className={key} onClick={() => padPress(d)}>{d}</button>)}
                <button className={`${key} !text-[13px]`} onClick={() => padPress("C")}>Clear</button>
                {["4", "5", "6"].map((d) => <button key={d} className={key} onClick={() => padPress(d)}>{d}</button>)}
                <button className={`${key} !text-[13px] text-red-600`} onClick={() => selLine && updateQty(selLine.cartId, 0)}>Delete</button>
                {["1", "2", "3"].map((d) => <button key={d} className={key} onClick={() => padPress(d)}>{d}</button>)}
                <button className={`${key} row-span-2 !bg-indigo-600 !text-white !border-indigo-600 !text-[15px]`} onClick={applyPad}>Enter</button>
                <button className={key} onClick={() => padPress("0")}>0</button>
                <button className={key} onClick={() => padPress(".")}>.</button>
                <button className={key} onClick={() => padPress("back")}>⌫</button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-100 p-2">
                <button className={`${chipBase} ${!activeCategory ? chipOn : chipOff}`} onClick={() => { setActiveCategory(""); setActiveSubcategory(null); }}>All</button>
                {categoryList.map((c: any) => (
                  <button key={c.id} className={`${chipBase} ${activeCategory === c.id ? chipOn : chipOff}`} onClick={() => { setActiveCategory(c.id); setActiveSubcategory(null); }}>
                    {c.categoryname}
                  </button>
                ))}
              </div>
              {activeCategory && subcategoriesForActive.length > 0 && (
                <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-100 px-2 py-1.5">
                  <button className={`${chipBase} !h-8 ${!activeSubcategory ? chipOn : chipOff}`} onClick={() => setActiveSubcategory(null)}>All</button>
                  {subcategoriesForActive.map((c: any) => (
                    <button key={c.id} className={`${chipBase} !h-8 ${activeSubcategory === c.id ? chipOn : chipOff}`} onClick={() => setActiveSubcategory(c.id)}>
                      {c.subcategoryname}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-2 overflow-y-auto p-2">
                {sortedProducts.map((p) => {
                  const stock = p.variants?.reduce((s: number, v: any) => s + (v.currentstock ?? 0), 0) ?? 0;
                  const out = stock <= 0;
                  return (
                    <button key={p.id} disabled={out} onClick={() => pickProduct(p)} className="flex min-h-[88px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-2 text-left active:bg-indigo-50 disabled:opacity-40 cursor-pointer">
                      <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-900">{p.name}</span>
                      <span className="flex items-end justify-between">
                        <span className="text-[13px] font-bold text-indigo-700">₹{fmt(p.price)}</span>
                        <span className={`text-[11px] ${out ? "text-red-600" : stock < 10 ? "text-amber-600" : "text-slate-400"}`}>{out ? "Nil" : stock}</span>
                      </span>
                    </button>
                  );
                })}
                {sortedProducts.length === 0 && <div className="col-span-3 py-8 text-center text-slate-400">No products</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Totals and actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
          <button onClick={holdCart} className="flex h-12 items-center gap-1.5 rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-50 cursor-pointer">
            <PauseCircle size={18} /> Hold <span className="text-slate-400">F8</span>
          </button>
          <button onClick={recallCart} className="flex h-12 items-center gap-1.5 rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-50 cursor-pointer">
            <RotateCcw size={18} /> Recall{heldCarts.length ? ` (${heldCarts.length})` : ""} <span className="text-slate-400">F9</span>
          </button>
          <button onClick={clearCart} className="flex h-12 items-center gap-1.5 rounded-lg border border-slate-300 px-4 font-medium text-red-600 hover:bg-red-50 cursor-pointer">
            <Trash2 size={18} /> Clear <span className="text-slate-400">F10</span>
          </button>
          <div className="ml-auto flex items-center gap-5 text-[13px]">
            {offlinePrice && (
              <span className="text-[11px] font-medium text-amber-700" title="Price list not available offline; the product's own rate is used.">
                Offline price
              </span>
            )}
            <span><span className="text-slate-500">Items </span><b>{cart.length}</b></span>
            <span><span className="text-slate-500">Qty </span><b>{totalItemQty}</b></span>
            <span className="hidden sm:inline"><span className="text-slate-500">Disc </span><b className="text-orange-600">₹{fmt(totaldiscount)}</b></span>
            <span className="hidden sm:inline"><span className="text-slate-500">GST </span><b>₹{fmt(totalgst)}</b></span>
            <span className="text-[26px] font-bold text-slate-900">₹{fmt(total)}</span>
          </div>
          <button
            onClick={openPay}
            disabled={cart.length === 0 || saving}
            className="flex h-14 min-w-[200px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-[17px] font-bold text-white hover:bg-indigo-700 disabled:opacity-40 cursor-pointer"
          >
            {isOrderMode ? "Save Order" : "Pay"} <span className="text-[12px] font-medium text-white/70">F12</span>
          </button>
        </div>

        {chooser && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => setChooser(null)}>
            <div className="w-full max-w-lg rounded-xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[15px] font-semibold">{chooser.name}</div>
                <button onClick={() => setChooser(null)} className="cursor-pointer text-slate-400"><XIcon size={18} /></button>
              </div>
              <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto">
                {chooser.variants.flatMap((v: any) =>
                  v.units.map((u: any) => (
                    <button
                      key={`${v.variantId}_${u.id}`}
                      disabled={(v.currentstock ?? 0) <= 0}
                      onClick={() => { addToCart(chooser, v.variantId, u.id); setChooser(null); }}
                      className="flex min-h-[64px] flex-col items-start justify-center rounded-lg border border-slate-200 px-3 text-left active:bg-indigo-50 disabled:opacity-40 cursor-pointer"
                    >
                      <span className="font-semibold">{[v.name, u.name].filter(Boolean).join(" · ")}</span>
                      <span className="text-[12px] text-slate-500">₹{fmt(u.offerprice ?? u.salesrate ?? u.price ?? u.mrp)} · stock {v.currentstock ?? 0}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {paymentOpen && (
          <PosPayment total={Number(total.toFixed(2))} walkIn={isWalkIn(selectedParty)} saving={saving} onClose={() => setPaymentOpen(false)} onDone={(parts) => handlePaymentComplete(parts)} />
        )}

        {/* Add customer modal */}
        <PosAddCustomer
          variant="pos"
          open={addCustomerOpen}
          onClose={() => setAddCustomerOpen(false)}
          onCreated={async (newId: string) => {
            const res = await refetchAccounts();
            const fresh = (res?.data?.getAccounts || []).find((a: any) => a.id === newId);
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

// Payment screen: cash given (with change), UPI, card and bank in any mix; what is left is on credit.
function PosPayment({ total, walkIn, saving, onClose, onDone }: { total: number; walkIn: boolean; saving: boolean; onClose: () => void; onDone: (parts: { mode: string; amount: number }[]) => void }) {
  const [amounts, setAmounts] = useState<Record<string, string>>({ cash: String(total) });
  const [focus, setFocusRaw] = useState<string>("cash");
  // The first key after picking a mode replaces its amount instead of adding to it.
  const [fresh, setFresh] = useState(true);
  const setFocus = (m: string) => { setFocusRaw(m); setFresh(true); };
  const num = (m: string) => Math.max(Number(amounts[m] || 0), 0);
  const others = PAY_MODES.filter((p) => p.mode !== "cash").reduce((s, p) => s + num(p.mode), 0);
  const cashApplied = Math.max(Math.min(num("cash"), total - others), 0);
  const change = Math.max(num("cash") - cashApplied, 0);
  const paid = Math.min(cashApplied + others, total);
  const balance = Math.max(total - paid, 0);
  const over = others > total + 0.001;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const parts = PAY_MODES.map((p) => ({ mode: p.mode, amount: r2(p.mode === "cash" ? cashApplied : num(p.mode)) })).filter((p) => p.amount > 0);
  const invalid = over || (balance > 0.001 && walkIn);
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const press = (k: string) => {
    const replace = fresh && k !== "back" && k !== "C";
    setFresh(false);
    setAmounts((a) => {
      const cur = replace ? "" : a[focus] ?? "";
      if (k === "C") return { ...a, [focus]: "" };
      if (k === "back") return { ...a, [focus]: cur.slice(0, -1) };
      if (k === "." && cur.includes(".")) return a;
      if (cur.includes(".") && cur.split(".")[1].length >= 2) return a;
      return { ...a, [focus]: cur === "0" && k !== "." ? k : cur + k };
    });
  };
  const restInto = (m: string) => {
    const without = PAY_MODES.filter((p) => p.mode !== m).reduce((s, p) => s + (p.mode === "cash" ? Math.min(num("cash"), total) : num(p.mode)), 0);
    setAmounts((a) => ({ ...a, [m]: String(r2(Math.max(total - without, 0))) }));
    setFocusRaw(m);
    setFresh(true);
  };
  const quick = [...new Set([total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 2000) * 2000])].filter((v) => v > 0).slice(0, 4);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && !invalid && !saving) onDone(parts);
      else if (/^[0-9.]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const key = "h-14 rounded-lg border border-slate-200 bg-white text-lg font-semibold active:bg-slate-100 cursor-pointer select-none";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3">
      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 rounded-2xl bg-white p-4 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">Payment</span>
            <button onClick={onClose} className="cursor-pointer text-slate-400"><XIcon size={20} /></button>
          </div>
          <div className="rounded-xl bg-slate-900 p-3 text-white">
            <div className="text-[12px] text-white/60">Bill total</div>
            <div className="text-[30px] font-bold">₹{fmt(total)}</div>
          </div>
          {PAY_MODES.map((p) => (
            <div key={p.mode} onClick={() => setFocus(p.mode)} className={`flex h-14 items-center gap-3 rounded-xl border-2 px-3 cursor-pointer ${focus === p.mode ? "border-indigo-600 bg-indigo-50" : "border-slate-200"}`}>
              <span className="w-14 font-semibold">{p.label}</span>
              <span className="flex-1 text-right font-mono text-[20px] font-bold">{amounts[p.mode] ? `₹${amounts[p.mode]}` : <span className="text-slate-300">₹0</span>}</span>
              <button onClick={(e) => { e.stopPropagation(); restInto(p.mode); }} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-[12px] font-medium cursor-pointer">Rest</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {quick.map((v) => (
              <button key={v} onClick={() => { setAmounts((a) => ({ ...a, cash: String(v) })); setFocusRaw("cash"); setFresh(true); }} className="h-10 rounded-lg border border-slate-300 px-3 font-semibold cursor-pointer">
                Cash ₹{v.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
            <div><div className="text-[11px] text-slate-500">Paid</div><div className="font-bold">₹{fmt(paid)}</div></div>
            <div><div className="text-[11px] text-slate-500">Change to give</div><div className="font-bold text-emerald-600">₹{fmt(change)}</div></div>
            <div><div className="text-[11px] text-slate-500">On credit</div><div className={`font-bold ${balance > 0 ? "text-amber-600" : ""}`}>₹{fmt(balance)}</div></div>
          </div>
          {over && <div className="text-[12px] text-red-600">UPI, card and bank together are more than the bill.</div>}
          {!over && balance > 0.001 && walkIn && <div className="text-[12px] text-red-600">Pick a customer to leave a balance on credit.</div>}
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "back"].map((k) => (
              <button key={k} className={key} onClick={() => press(k)}>{k === "back" ? "⌫" : k}</button>
            ))}
          </div>
          <button className={`${key} !text-[14px]`} onClick={() => press("C")}>Clear</button>
          <button disabled={invalid || saving} onClick={() => onDone(parts)} className="mt-auto h-16 rounded-xl bg-indigo-600 text-[18px] font-bold text-white disabled:opacity-40 cursor-pointer">
            {saving ? "Saving..." : balance > 0 ? "Save (part credit)" : "Complete sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
