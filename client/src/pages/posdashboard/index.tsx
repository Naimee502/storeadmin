// Dmart-style retail POS Dashboard
// - Staff/Branch/Admin can take orders or generate invoices
// - Compact category bar, big product tiles, sticky cart, payment drawer

import { useEffect, useMemo, useRef, useState } from "react";
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
  Package,
} from "lucide-react";

import { useCategoriesQuery } from "../../graphql/hooks/categories";
import { useSubCategoriesQuery } from "../../graphql/hooks/subcategories";
import { useBrandsQuery } from "../../graphql/hooks/brands";
import { useModelsQuery } from "../../graphql/hooks/models";
import { useSizesQuery } from "../../graphql/hooks/sizes";
import { useProductGroupsQuery } from "../../graphql/hooks/productgroups";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useSalesInvoiceMutations, useSalesInvoicesQuery } from "../../graphql/hooks/salesinvoice";
import { useSalesOrderMutations, useSalesOrdersQuery } from "../../graphql/hooks/salesorder";
import { usePriceResolvers } from "../../graphql/hooks/pricelists";
import { useAccountsQuery } from "../../graphql/hooks/accounts";
import { useBranchesQuery } from "../../graphql/hooks/branches";
import PaymentDrawer from "../../components/paymentdrawer";
import PosAddCustomer from "../../components/posaddcustomer";
import FormField from "../../components/formfiled";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  getBaseQuantity,
  getCartItemBaseQty,
  getNextBillNumber,
} from "../../utils/helper";
import { showMessage } from "../../redux/slices/message";

/* ---------------- Helpers ---------------- */
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

  /* ---------- Fetch master data ---------- */
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
  const PRODUCTS = useMemo(
    () => mapProductServiceList(productServiceList),
    [productServiceList]
  );

  /* ---------- UI state ---------- */
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

  const { resolvePrice } = usePriceResolvers();

  /* ---------- Customer / accounts ---------- */
  const { data: accountData, refetch: refetchAccounts } = useAccountsQuery();
  const accounts = accountData?.getAccounts || [];
  const customerOptions = accounts.filter((a: any) => a.type === "customer");

  /* ---------- Auth context ---------- */
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
      ? (selectedBranchId || firstBranchId)
      : type === "branch"
      ? (branch?.id || selectedBranchId || storedBranchId || firstBranchId)
      : type === "staff"
      ? (staff?.branchid?.id || selectedBranchId || storedBranchId || firstBranchId)
      : (selectedBranchId || storedBranchId || firstBranchId);

  const { addSalesInvoiceMutation } = useSalesInvoiceMutations();
  const { addSalesOrderMutation } = useSalesOrderMutations();

  // Fetch invoices & orders from server so we compute the real next number
  const { data: invoicesData, refetch: refetchInvoices } = useSalesInvoicesQuery();
  const { data: ordersData, refetch: refetchOrders } = useSalesOrdersQuery();
  const serverInvoices = invoicesData?.getSalesInvoices ?? [];
  const serverOrders = ordersData?.getSalesOrders ?? [];

  // Staff is mainly an order-taker, not a billing person — default to ORDER mode
  useEffect(() => {
    if (type === "staff") setIsOrderMode(true);
  }, [type]);

  // Derive bill number from the actual server data based on current mode
  useEffect(() => {
    const list = isOrderMode ? serverOrders : serverInvoices;
    setBillNumber(getNextBillNumber(list));
  }, [isOrderMode, serverInvoices, serverOrders]);

  /* ---------- Keyboard shortcuts: F2 search, F3 barcode ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        barcodeRef.current?.focus();
      } else if (e.key === "Escape") {
        setPaymentOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- Filtered subcategories ---------- */
  const subcategoriesForActive = useMemo(() => {
    if (!activeCategory) return subCategoryList;
    return subCategoryList.filter(
      (s: any) => s.category?.id === activeCategory
    );
  }, [activeCategory, subCategoryList]);

  /* ---------- Filtered products ---------- */
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

  /* ---------- Add to cart ---------- */
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
      let sellPrice =
        chosenUnit.offerprice ??
        chosenUnit.salesrate ??
        chosenUnit.price ??
        chosenUnit.mrp ??
        0;
      let discount = chosenUnit.discount ?? 0;

      if (selectedParty) {
        try {
          const resolved = await resolvePrice({
            productid: product.id,
            variantid: chosenVariant.variantId,
            unitid: chosenUnit.id,
            accountid: selectedParty.id,
            channelid: selectedParty.channel,
            region: selectedParty.region,
          });
          if (resolved) {
            sellPrice = resolved.rate;
            discount = resolved.discount;
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

  /* ---------- Barcode submit ---------- */
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

  /* ---------- Qty / remove ---------- */
  const updateQty = (cartId: string, qty: number) => {
    if (qty < 1) {
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

  /* ---------- Hold / Recall / Clear ---------- */
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

  /* ---------- Totals ---------- */
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

  /* ---------- Submit / Save ---------- */
  const handlePaymentComplete = async ({ paymentType }: any) => {
    // Customer is selected in the cart (selectedParty), NOT in the drawer.
    // The drawer only returns paymentType / paidAmount / balance now to
    // avoid the duplicate-dropdown bug.
    if (!selectedParty?.id) {
      dispatch(
        showMessage({
          message: "Please pick a customer in the cart before completing payment.",
          type: "error",
        })
      );
      return;
    }

    if (!adminId || !branchId) {
      dispatch(
        showMessage({
          message: "Session error: Admin or Branch ID is missing. Please re-login.",
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
      paymenttype: paymentType,
      partyacc: selectedParty.id,
      taxorsupplytype: "taxInvoice",
      billdate: new Date().toISOString().slice(0, 10),
      billtype: "taxInvoice",
      notes: "",
      subtotal: Number(subtotal.toFixed(2)),
      totaldiscount: Number(totaldiscount.toFixed(2)),
      totalgst: Number(totalgst.toFixed(2)),
      totalamount: Number(total.toFixed(2)),
      isservice: false,
      status: true,
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

    try {
      if (isOrderMode) {
        const orderInput = { ...input, ordertype: "retail" };
        await addSalesOrderMutation({ variables: { input: orderInput } });
        dispatch(
          showMessage({
            message: "Sales Order saved successfully",
            type: "success",
          })
        );
      } else {
        const invoiceInput = { ...input, invoicetype: "retail" };
        await addSalesInvoiceMutation({ variables: { input: invoiceInput } });
        dispatch(
          showMessage({
            message: "Invoice generated successfully",
            type: "success",
          })
        );
      }
      await refetchProducts();
      // Refetch so the next bill/order number updates
      if (isOrderMode) await refetchOrders();
      else await refetchInvoices();
    } catch (error: any) {
      console.error("Error:", error);
      dispatch(showMessage({ message: "An error occurred", type: "error" }));
    } finally {
      setCart([]);
      setSelectedParty(null);
      setPaymentOpen(false);
    }
  };

  /* ---------- Customer pick ---------- */
  const onPickCustomer = (id: string) => {
    const acc = customerOptions.find((c: any) => c.id === id);
    setSelectedParty(acc || null);
  };

  /* ---------- Render ---------- */
  return (
    <HomeLayout>
      <div className="bg-slate-100 min-h-[calc(100vh-64px)]">
        {/* ===== TOP BAR ===== */}
        {/* ===== TOP BAR ===== */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-20 text-slate-800 shadow-sm">
          <div className="px-4 py-3 flex flex-wrap items-center gap-3">
            {/* Brand / Title */}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <ShoppingCart size={20} />
              </div>
              <div>
                <div className="text-base md:text-lg font-extrabold text-slate-900 tracking-wide leading-tight">
                  Retail POS
                </div>
                <div className="text-xs text-slate-500 font-semibold leading-tight">
                  {creatorInfo.type.toUpperCase()} • {creatorInfo.name}
                </div>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-1 rounded-lg ml-2">
              <button
                onClick={() => setIsOrderMode(true)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                  isOrderMode
                    ? "!bg-slate-900 !text-white shadow-sm"
                    : "!bg-transparent !text-slate-600 hover:!bg-white"
                }`}
              >
                ORDER
              </button>
              {type !== "staff" && (
                <button
                  onClick={() => setIsOrderMode(false)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                    !isOrderMode
                      ? "!bg-slate-900 !text-white shadow-sm"
                      : "!bg-transparent !text-slate-600 hover:!bg-white"
                  }`}
                >
                  INVOICE
                </button>
              )}
            </div>

            {/* Barcode */}
            <form
              onSubmit={handleBarcodeSubmit}
              className="flex items-center bg-slate-50 border border-slate-300 px-3 py-2 rounded-lg text-slate-900 focus-within:border-blue-600 transition shadow-inner"
            >
              <ScanBarcode size={16} className="text-slate-500 mr-2 flex-shrink-0" />
              <input
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan barcode (F3)"
                className="bg-transparent outline-none text-sm w-36 md:w-44 font-mono text-slate-900 placeholder:text-slate-400"
              />
            </form>

            {/* Search */}
            <div className="flex items-center bg-slate-50 border border-slate-300 px-3 py-2 rounded-lg flex-1 min-w-[220px] text-slate-900 focus-within:border-blue-600 transition shadow-inner">
              <Search size={16} className="text-slate-500 mr-2 flex-shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name, brand, SKU (F2)"
                className="bg-transparent outline-none text-sm w-full text-slate-900 placeholder:text-slate-400"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            {/* Bill # info */}
            <div className="hidden lg:flex items-center text-xs text-slate-500 bg-slate-50 border border-slate-300 px-3 py-2 rounded-lg">
              <span className="font-semibold text-slate-700 mr-1.5">
                {isOrderMode ? "Order" : "Bill"} #
              </span>
              <span className="font-mono text-slate-900 font-bold">{billNumber}</span>
            </div>
          </div>

          {/* Category strip */}
          <div className="px-4 pb-2.5 flex gap-2 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => {
                setActiveCategory("");
                setActiveSubcategory(null);
              }}
              className={`shrink-0 px-3.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                !activeCategory
                  ? "!bg-slate-900 !text-white !border-slate-900 shadow-sm"
                  : "!bg-white !text-slate-700 hover:!bg-slate-50 !border-slate-300"
              }`}
            >
              All
            </button>
            {categoryList.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setActiveSubcategory(null);
                }}
                className={`shrink-0 px-3.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                  activeCategory === cat.id
                    ? "!bg-slate-900 !text-white !border-slate-900 shadow-sm"
                    : "!bg-white !text-slate-700 hover:!bg-slate-50 !border-slate-300"
                }`}
              >
                {cat.categoryname}
              </button>
            ))}
            <span className="w-px h-6 bg-slate-200 mx-1.5 my-auto" />
            {brandList.slice(0, 12).map((b: any) => (
              <button
                key={b.id}
                onClick={() =>
                  setActiveBrand(activeBrand === b.id ? null : b.id)
                }
                className={`shrink-0 px-3.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                  activeBrand === b.id
                    ? "!bg-slate-900 !text-white !border-slate-900 shadow-sm"
                    : "!bg-white !text-slate-700 hover:!bg-slate-50 !border-slate-300"
                }`}
              >
                {b.brandname}
              </button>
            ))}
          </div>

          {/* Subcategory strip — visible when there are any subcategories */}
          {subcategoriesForActive.length > 0 && (
            <div className="px-4 pb-2.5 flex gap-2 overflow-x-auto hide-scrollbar border-t border-slate-200 pt-2">
              <button
                onClick={() => setActiveSubcategory(null)}
                className={`shrink-0 px-3 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                  activeSubcategory === null
                    ? "!bg-slate-900 !text-white !border-slate-900 shadow-sm"
                    : "!bg-white !text-slate-700 hover:!bg-slate-50 !border-slate-300"
                }`}
              >
                All Sub
              </button>
              {subcategoriesForActive.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSubcategory(s.id)}
                  className={`shrink-0 px-3 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                    activeSubcategory === s.id
                      ? "!bg-slate-900 !text-white !border-slate-900 shadow-sm"
                      : "!bg-white !text-slate-700 hover:!bg-slate-50 !border-slate-300"
                  }`}
                >
                  {s.subcategoryname}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ===== MAIN AREA ===== */}
        <div className="px-3 md:px-4 py-3 flex flex-col lg:flex-row gap-3">
          {/* PRODUCTS */}
          <div className="flex-1 bg-white rounded-xl border shadow-sm">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Package size={16} />
                Products
                <span className="text-slate-400 font-normal text-xs">
                  ({filteredProducts.length})
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Click a tile to add. Tap +/- on the cart for qty.
              </div>
            </div>

            <div className="p-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 max-h-[calc(100vh-240px)] overflow-y-auto hide-scrollbar">
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400 text-sm">
                  No products found. Try clearing filters or search.
                </div>
              )}

              {filteredProducts.map((p) => {
                const defaultVariantId = p.variants?.[0]?.variantId;
                const defaultUnitId = p.variants?.[0]?.units?.[0]?.id;
                const sel =
                  selectedUnits[p.id] ?? {
                    variantId: defaultVariantId,
                    unitId: defaultUnitId,
                  };
                const selectedVariant =
                  p.variants.find((v: any) => v.variantId === sel.variantId) ||
                  p.variants[0];
                const currentUnit =
                  selectedVariant?.units?.find((u: any) => u.id === sel.unitId) ||
                  selectedVariant?.units?.[0];

                const stock = selectedVariant?.currentstock ?? 0;
                const outOfStock = stock <= 0;
                const lowStock = !outOfStock && stock < 10;

                return (
                  <div
                    key={p.id}
                    className={`group relative border rounded-lg bg-white hover:shadow-md transition cursor-pointer overflow-hidden ${
                      outOfStock ? "opacity-60" : ""
                    }`}
                    onClick={() => addToCart(p, sel.variantId, sel.unitId)}
                  >
                    {/* Stock badge */}
                    <div className="absolute top-1 left-1 z-10">
                      {outOfStock ? (
                        <span className="bg-red-100 text-red-700 text-[8px] font-bold px-1 py-0.5 rounded">
                          OUT
                        </span>
                      ) : lowStock ? (
                        <span className="bg-amber-100 text-amber-700 text-[8px] font-bold px-1 py-0.5 rounded">
                          {stock}
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 text-[8px] font-bold px-1 py-0.5 rounded">
                          {stock}
                        </span>
                      )}
                    </div>

                    {/* Quick ADD on hover (top-right) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(p, sel.variantId, sel.unitId);
                      }}
                      disabled={outOfStock}
                      title="Add to cart"
                      className="absolute top-1.5 right-1.5 z-10 w-7 h-7 !bg-slate-900 hover:!bg-slate-800 disabled:!bg-slate-300 !text-white rounded-full flex items-center justify-center shadow-md transition-all cursor-pointer flex-shrink-0"
                    >
                      <Plus size={14} />
                    </button>

                    {/* Image */}
                    <div className="h-16 bg-slate-50 flex items-center justify-center">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package size={20} className="text-slate-300" />
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-1.5">
                      <h3 className="text-[11px] font-semibold text-slate-800 line-clamp-2 leading-tight min-h-[26px]">
                        {p.name}
                      </h3>
                      <p className="text-[9px] text-slate-500 line-clamp-1 leading-tight">
                        {[p.brandName, p.sizeName].filter(Boolean).join(" • ") ||
                          "—"}
                      </p>

                      <div className="flex items-end justify-between mt-1 gap-1">
                        <div className="leading-tight min-w-0">
                          <div className="text-[12px] font-bold text-emerald-700 truncate">
                            ₹{Number(currentUnit?.price ?? 0).toFixed(2)}
                          </div>
                          {currentUnit?.mrp &&
                            currentUnit.mrp > currentUnit.price && (
                              <div className="text-[9px] line-through text-slate-400 leading-tight">
                                ₹{Number(currentUnit.mrp).toFixed(2)}
                              </div>
                            )}
                        </div>
                        {selectedVariant?.units?.length > 1 && (
                          <select
                            className="text-[9px] border rounded px-1 py-0.5 bg-white w-[80px]"
                            value={sel.unitId}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onSelectUnit(p.id, e.target.value)
                            }
                          >
                            {selectedVariant.units.map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {p.variants.length > 1 && (
                        <select
                          className="mt-1 text-[9px] border rounded px-1 py-0.5 w-full bg-slate-50"
                          value={sel.variantId}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onSelectVariant(p.id, e.target.value)
                          }
                        >
                          {p.variants.map((v: any) => (
                            <option key={v.variantId} value={v.variantId}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CART */}
          <div className="lg:w-[400px] bg-white rounded-xl border shadow-sm flex flex-col max-h-[calc(100vh-150px)] overflow-hidden">
            {/* Cart Header */}
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-blue-600" />
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Cart
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {cart.length} line{cart.length !== 1 ? "s" : ""} • {totalItemQty} qty
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  title="Hold Cart"
                  onClick={holdCart}
                  className="p-1.5 rounded hover:bg-slate-100 text-amber-600"
                >
                  <PauseCircle size={18} />
                </button>
                <button
                  title="Recall Held Cart"
                  onClick={recallCart}
                  className="p-1.5 rounded hover:bg-slate-100 text-blue-600 relative"
                >
                  <RotateCcw size={18} />
                  {heldCarts.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {heldCarts.length}
                    </span>
                  )}
                </button>
                <button
                  title="Clear Cart"
                  onClick={clearCart}
                  className="p-1.5 rounded hover:bg-slate-100 text-red-600"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Customer Pick — uses the standard FormField dropdown so it
                matches the rest of the system (search, "Add New" footer
                inside the dropdown menu, consistent styling). The drawer
                no longer has a customer picker, so this is the single
                source of truth for the buyer on the bill. */}
            <div className="p-3 border-b bg-slate-50">
              <FormField
                label="Customer"
                name="customer"
                type="select"
                value={selectedParty?.id || ""}
                onChange={(e: any) => onPickCustomer(e.target.value)}
                options={customerOptions.map((c: any) => ({
                  value: c.id,
                  label: `${c.name}${c.mobile ? ` • ${c.mobile}` : ""}`,
                }))}
                searchable
                addable
                onAddNew={() => setAddCustomerOpen(true)}
                placeholder="Walk-in customer"
              />
            </div>

            {/* Cart Lines */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 hide-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                  <ShoppingCart size={36} />
                  <div className="text-xs mt-2">Cart is empty</div>
                  <div className="text-[10px] mt-0.5 text-slate-400">
                    Click product or scan barcode to add
                  </div>
                </div>
              ) : (
                cart.map((it) => {
                  const lineNet =
                    ((it.price ?? 0) - (it.discount ?? 0)) * (it.qty ?? 0);
                  const lineGst =
                    (lineNet * (it.gst ?? 0)) / 100;
                  const lineTotal = lineNet + lineGst;
                  return (
                    <div
                      key={it.cartId}
                      className="border rounded-lg p-2 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-slate-800 line-clamp-1">
                            {it.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {[it.variantName, it.unitName]
                              .filter(Boolean)
                              .join(" • ") || "—"}
                          </div>
                          <div className="text-[11px] text-slate-700 mt-0.5">
                            ₹{Number(it.price).toFixed(2)}{" "}
                            {it.discount > 0 && (
                              <span className="text-amber-600 text-[10px]">
                                (-₹{Number(it.discount).toFixed(2)})
                              </span>
                            )}
                            {it.gst > 0 && (
                              <span className="text-slate-400 text-[10px]">
                                {" "}• GST {it.gst}%
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => updateQty(it.cartId, 0)}
                          className="text-slate-400 hover:text-red-600"
                          title="Remove"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQty(it.cartId, it.qty - 1)}
                            className="w-7 h-7 rounded border !bg-white hover:!bg-slate-100 !text-slate-700 flex items-center justify-center"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            value={it.qty}
                            min={1}
                            onChange={(e) =>
                              updateQty(
                                it.cartId,
                                Math.max(1, Number(e.target.value || 1))
                              )
                            }
                            className="w-12 h-7 text-center border rounded text-sm font-semibold !bg-white"
                          />
                          <button
                            onClick={() => updateQty(it.cartId, it.qty + 1)}
                            className="w-7 h-7 rounded border !bg-white hover:!bg-slate-100 !text-slate-700 flex items-center justify-center"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <div className="text-sm font-bold text-emerald-700">
                          ₹{lineTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Totals & action */}
            <div className="border-t p-3 bg-slate-50 rounded-b-xl">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Discount</span>
                <span className="text-amber-700">
                  −₹{totaldiscount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>GST</span>
                <span>₹{totalgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg mt-1 text-slate-900">
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
              <button
                disabled={cart.length === 0}
                className="w-full mt-3 !bg-slate-900 disabled:!bg-slate-300 hover:!bg-slate-800 !text-white py-3 rounded-lg font-bold shadow-md !border-0 transition-all cursor-pointer text-sm"
                onClick={() => {
                  if (cart.length === 0) {
                    dispatch(
                      showMessage({
                        message: "Add at least one item",
                        type: "error",
                      })
                    );
                    return;
                  }
                  setPaymentOpen(true);
                }}
              >
                {isOrderMode ? "Place Order" : "Proceed to Payment"} • ₹
                {total.toFixed(2)}
              </button>
            </div>
          </div>
        </div>

        {/* Payment Drawer */}
        <PaymentDrawer
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          total={total}
          onComplete={handlePaymentComplete}
        />

        {/* Add customer modal */}
        <PosAddCustomer
          open={addCustomerOpen}
          onClose={() => setAddCustomerOpen(false)}
          onCreated={async (newId: string) => {
            await refetchAccounts();
            const fresh = (accountData?.getAccounts || []).find(
              (a: any) => a.id === newId
            );
            if (fresh) setSelectedParty(fresh);
          }}
          mode="customer"
        />
      </div>
    </HomeLayout>
  );
}
