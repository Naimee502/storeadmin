// Full updated code replacing dummy data with mutation-driven fetched data
// NOTE: Replace mutation and query hook names as per your schema

import { useEffect, useMemo, useState } from "react";
import HomeLayout from "../../layouts/home";
import { Search, ShoppingCart } from "lucide-react";

import { useCategoriesQuery } from "../../graphql/hooks/categories";
import { useSubCategoriesQuery } from "../../graphql/hooks/subcategories";
import { useBrandsQuery } from "../../graphql/hooks/brands";
import { useModelsQuery } from "../../graphql/hooks/models";
import { useSizesQuery } from "../../graphql/hooks/sizes";
import { useProductGroupsQuery } from "../../graphql/hooks/productgroups";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useSalesInvoiceMutations } from "../../graphql/hooks/salesinvoice";
import { useSalesOrderMutations } from "../../graphql/hooks/salesorder";
import { usePriceResolvers } from "../../graphql/hooks/pricelists";
import { useAccountsQuery } from "../../graphql/hooks/accounts";
import PaymentDrawer from "../../components/paymentdrawer";
import FormField from "../../components/formfiled";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { getBaseQuantity, getCartItemBaseQty, getNextBillNumber } from "../../utils/helper";
import { showMessage } from "../../redux/slices/message";

/* ------------ Helper functions for mapping fetched product services -------------- */
function getPriceFromUnitPrice(u) {
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
  /* -------- Fetching ALL required data from GraphQL ---------- */
  const { data: catData } = useCategoriesQuery();
  const categoryList = catData?.getCategories || [];

  const { data: subData } = useSubCategoriesQuery();
  const subCategoryList = subData?.getSubCategories || [];

  const { data: brandData } = useBrandsQuery();
  const brandList = brandData?.getBrands || [];

  const { data: modelData } = useModelsQuery();
  const modelList = modelData?.getModels || [];

  const { data: sizeData } = useSizesQuery();
  const sizeList = sizeData?.getSizes || [];

  const { data: pgData } = useProductGroupsQuery();
  const productGroupList = pgData?.getProductGroups || [];

  const { data: psData } = useProductServicesQuery();
  const productServiceList = psData?.getProductServices ?? [];

  const PRODUCTS = useMemo(() => mapProductServiceList(productServiceList), [productServiceList]);

  /* ---------------- UI STATE ---------------- */
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  /* PAYMENT DRAWER STATE */
  const [cart, setCart] = useState([]);
  const [selectedUnits, setSelectedUnits] = useState({});
  const [billNumber, setBillNumber] = useState("000001");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [isOrderMode, setIsOrderMode] = useState(true); // ✅ Order vs Invoice Toggle
  const [barcode, setBarcode] = useState(""); // ✅ Barcode Input
  const { resolvePrice } = usePriceResolvers();

  const { data: accountData } = useAccountsQuery();
  const accounts = accountData?.getAccounts || [];
  const customerOptions = accounts
    .filter((a: any) => a.type === "customer")
    .map((a: any) => ({ value: a.id, label: `${a.name} - ${a.mobile}` }));

  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  
  const creatorInfo = useMemo(() => {
    if (type === 'admin' && admin) return { id: admin.id, name: admin.name, type: 'admin' };
    if (type === 'branch' && branch) return { id: branch.id, name: branch.branchname || branch.name || 'Branch', type: 'branch' };
    if (type === 'staff' && staff) return { id: staff.id, name: staff.name, type: 'staff' };
    return { id: '', name: 'Unknown', type: 'unknown' };
  }, [type, admin, branch, staff]);

  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const branchId = type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : selectedBranchId;
  const { addSalesInvoiceMutation } = useSalesInvoiceMutations();
  const { addSalesOrderMutation } = useSalesOrderMutations();
  const salesInvoices = useAppSelector((state) => state.salesinvoice.invoices);

  /* ---------- Generate Next Bill Number ---------- */
  useEffect(() => {
    const next = getNextBillNumber(salesInvoices);
    setBillNumber(next);
  }, [salesInvoices]);

  /* ---------- SUBCATEGORY FILTER ---------- */
  const subcategoriesForActive = useMemo(() => {
    if (!activeCategory) return subCategoryList;

    return subCategoryList.filter((s) => {
      const catId = s.category?.id;
      return catId === activeCategory;
    });
  }, [activeCategory, subCategoryList]);

  /* ------------ PRODUCT FILTER ---------------- */
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return PRODUCTS.filter((p) => {
      if (activeCategory && p.categoryId !== activeCategory) return false;
      if (activeSubcategory && p.subcategoryId !== activeSubcategory) return false;
      if (activeBrand && p.barndId !== activeBrand) return false;
      if (activeSize && p.sizeId !== activeSize) return false;
      if (activeModal && p.modalId !== activeModal) return false;
      if (activeGroup && p.productGroupId !== activeGroup) return false;

      if (q) {
        const nameMatch = p.name.toLowerCase().includes(q);
        const brandMatch = p.brandName.toLowerCase().includes(q);
        if (!nameMatch && !brandMatch) return false;
      }

      return true;
    });
  }, [PRODUCTS, search, activeCategory, activeSubcategory, activeBrand, activeSize, activeModal, activeGroup]);

  /* -------- Add To Cart ---------- */
  const addToCart = (product: any, variantId: string | null = null, unitId: string | null = null) => {
    console.log("Adding to cart:", JSON.stringify(product));
    const chosenVariant =
      product.variants.find((v: any) => v.variantId === (variantId ?? selectedUnits[product.id]?.variantId)) ||
      product.variants[0];

    if (!chosenVariant) return;

    if (chosenVariant.currentstock <= 0) {
      alert("Out of stock");
      return;
    }

    const chosenUnit =
      chosenVariant.units.find((u: any) => u.id === (unitId ?? selectedUnits[product.id]?.unitId)) ||
      chosenVariant.units[0];

    if (!chosenUnit) return;

    const cartId = `${product.id}_${chosenVariant.variantId}_${chosenUnit.id}`;

    // --- Price Resolution ---
    const resolveAndAdd = async () => {
      let sellPrice = chosenUnit.offerprice ?? chosenUnit.salesrate ?? chosenUnit.price ?? chosenUnit.mrp ?? 0;
      let discount = chosenUnit.discount ?? 0;

      if (selectedParty) {
        try {
          const resolved = await resolvePrice({
            productid: product.id,
            variantid: chosenVariant.variantId,
            unitid: chosenUnit.id,
            accountid: selectedParty.id,
            channelid: selectedParty.channel,
            region: selectedParty.region
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
      // 🔥 total base qty of SAME VARIANT already in cart
      const usedBaseQty = prev
        .filter((c) => c.variantId === chosenVariant.variantId)
        .reduce((sum, c) => {
          return sum + getCartItemBaseQty(c, chosenVariant);
        }, 0);

      const newItemBaseQty = getBaseQuantity(
        1,
        chosenUnit.id,
        {
          unitconversions: chosenVariant.conversions.map(c => ({
            unitid: c.unitId,
            factor: c.factor,
          })),
        }
      );

      if (usedBaseQty + newItemBaseQty > chosenVariant.currentstock) {
        alert(`Stock exceeded! Available: ${chosenVariant.currentstock}`);
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

  /* -------- Barcode Scanner Handler ---------- */
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    // Find product/variant by barcode (assuming SKU is barcode for now)
    let foundProd = null;
    let foundVarId = null;

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
      dispatch(showMessage({ message: `${foundProd.name} added to cart`, type: "success" }));
    } else {
      dispatch(showMessage({ message: "Product not found", type: "error" }));
      setBarcode("");
    }
  };

  const updateQty = (cartId, qty) => {
    if (qty < 1) {
      setCart((prev) => prev.filter((c) => c.cartId !== cartId));
      return;
    }

    setCart((prev) => {
      return prev.map((c) => {
        if (c.cartId !== cartId) return c;

        const product = PRODUCTS.find((p) => p.id === c.productId);
        const variant = product?.variants.find(v => v.variantId === c.variantId);
        if (!variant) return c;

        // base qty for this line
        const newBaseQty = getCartItemBaseQty({ ...c, qty }, variant);

        // base qty of OTHER lines
        const otherBaseQty = prev
          .filter(x => x.cartId !== cartId && x.variantId === c.variantId)
          .reduce((s, x) => s + getCartItemBaseQty(x, variant), 0);

        if (newBaseQty + otherBaseQty > variant.currentstock) {
          alert(`Stock exceeded! Available: ${variant.currentstock}`);
          return c;
        }

        return { ...c, qty };
      });
    });
  };

  const onSelectVariant = (productId, variantId) => {
    const product = PRODUCTS.find((p) => p.id === productId);
    const variant = product?.variants.find((v) => v.variantId === variantId);
    const unitId = variant?.units?.[0]?.id;
    setSelectedUnits((prev) => ({ ...prev, [productId]: { variantId, unitId } }));
  };

  const onSelectUnit = (productId, unitId) => {
    const prevSel = selectedUnits[productId] ?? {} as any;
    setSelectedUnits((prev) => ({ ...prev, [productId]: { variantId: prevSel.variantId, unitId } }));
  };

  /* -------------- Totals -------------- */
  const subtotal = cart.reduce((s, i) => s + (i.price ?? 0) * (i.qty ?? 0), 0);
  const totaldiscount = cart.reduce((s, i) => s + ((i.discount ?? 0) * (i.qty ?? 0)), 0);
  const totalgst = cart.reduce((s, i) => {
    const lineNet = ((i.price ?? 0) - (i.discount ?? 0)) * (i.qty ?? 0);
    return s + (lineNet * (i.gst ?? 0)) / 100;
  }, 0);

  // Final total = subtotal - totaldiscount + totalgst
  const total = subtotal - totaldiscount + totalgst;

  const getUnitId = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object" && "id" in value) return value.id ?? null;
    return null;
  };

  /* Handle completion */
  const handlePaymentComplete = async ({
    paymentType,
    customer,
  }) => {
     const input = {
      branchid: branchId,
      adminid: type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined,
      createdby_id: creatorInfo.id,
      createdby_name: creatorInfo.name,
      createdby_type: creatorInfo.type,
      paymenttype: paymentType,
      partyacc: customer,
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
        // SalesOrderInput needs 'ordertype' but NOT 'invoicetype'
        const orderInput = { ...input, ordertype: "retail" };
        await addSalesOrderMutation({ 
          variables: { 
            input: orderInput
          } 
        });
        dispatch(showMessage({ message: "Sales Order added successfully", type: "success" }));
      } else {
        // SalesInvoiceInput needs 'invoicetype'
        const invoiceInput = { ...input, invoicetype: "retail" };
        await addSalesInvoiceMutation({ 
          variables: { 
            input: invoiceInput 
          } 
        });
        dispatch(showMessage({ message: "Invoice added successfully", type: "success" }));
      }
    } catch (error: any) {
      console.error("Error:", error);
      dispatch(showMessage({ message: "An error occurred", type: "error" }));
    } finally {
      setCart([]);
      setPaymentOpen(false);
    }
  };

  return (
    <HomeLayout>
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-3">
            <ShoppingCart size={22} className="text-blue-600" />
            <span>POS {isOrderMode ? "Ordering" : "Billing"}</span>
          </h2>

          <div className="flex items-center ml-4 gap-2 bg-gray-100 p-1 rounded-lg border">
            <button 
              onClick={() => setIsOrderMode(false)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!isOrderMode ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >
              INVOICE
            </button>
            <button 
              onClick={() => setIsOrderMode(true)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${isOrderMode ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >
              ORDER
            </button>
          </div>

          <div className="flex items-center gap-4 ml-4">
            <form onSubmit={handleBarcodeSubmit} className="flex items-center bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg shadow-inner">
              <span className="text-[10px] font-bold text-blue-500 mr-2">BARCODE</span>
              <input
                autoFocus
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or Type SKU..."
                className="bg-transparent outline-none text-sm w-32 font-mono"
              />
            </form>
          </div>

          <div className="ml-auto hidden md:flex items-center gap-4">
            <div className="flex items-center bg-white border px-3 py-2 rounded-lg shadow-sm">
              <Search size={16} className="text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="ml-2 bg-transparent outline-none text-sm w-40"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          {/* LEFT SIDE */}
          <div className="w-full md:w-2/3 bg-white p-4 rounded-xl border shadow-sm h-[calc(100vh-150px)] overflow-hidden">
            <div className="h-full overflow-y-auto hide-scrollbar">
            {/* Category Filter */}
            <div className="flex gap-2 pb-2 w-full">
              <button
                className={`px-4 py-1.5 rounded-full text-xs font-medium border ${!activeCategory ? "bg-blue-600 text-blue-600 border-blue-600" : "bg-gray-100"}`}
                onClick={() => setActiveCategory("")}
              >All</button>

              {categoryList.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setActiveSubcategory(null); }}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border ${activeCategory === cat.id ? "bg-blue-600 text-blue-600 border-blue-600" : "bg-gray-100"}`}
                >{cat.categoryname}</button>
              ))}
            </div>

            {/* SubCategories */}
            <div className="mt-2 flex gap-2 pb-2 w-full">
              <button onClick={() => setActiveSubcategory(null)} className={`shrink-0 px-3 py-1.5 rounded text-xs border ${activeSubcategory === null ? "bg-blue-600 text-blue-600" : "bg-gray-100"}`}>All</button>
              {subcategoriesForActive.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSubcategory(s.id)}
                  className={`px-3 py-1.5 rounded text-xs border ${activeSubcategory === s.id ? "bg-blue-600 text-blue-600" : "bg-gray-100"}`}
                >{s.subcategoryname}</button>
              ))}
            </div>

            {/* Brand Filter */}
            <div className="mt-2 flex gap-2 pb-2 w-full">
              <button onClick={() => setActiveBrand(null)} className={`px-3 py-1 rounded text-xs border ${activeBrand === null ? "bg-blue-600 text-blue-600" : "bg-gray-100"}`}>All Brands</button>
              {brandList.map((b) => (
                <button key={b.id} onClick={() => setActiveBrand(b.id)} className={`px-3 py-1 rounded text-xs border ${activeBrand === b.id ? "bg-blue-600 text-blue-600" : "bg-gray-100"}`}>{b.brandname}</button>
              ))}
            </div>

            {/* Size Filter */}
            <div className="mt-2 flex gap-2 pb-2 w-full">
              <button onClick={() => setActiveSize(null)} className={`px-3 py-1 rounded text-xs border ${activeSize === null ? "bg-blue-600 text-blue-600" : "bg-gray-100"}`}>All Sizes</button>
              {sizeList.map((s) => (
                <button key={s.id} onClick={() => setActiveSize(s.id)} className={`px-3 py-1 rounded text-xs border ${activeSize === s.id ? "bg-blue-600 text-blue-600" : "bg-gray-100"}`}>{s.sizename}</button>
              ))}
            </div>

            {/* PRODUCT GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
              {filteredProducts.map((p) => {
                const defaultVariantId = p.variants?.[0]?.variantId;
                const defaultUnitId = p.variants?.[0]?.units?.[0]?.id;
                const sel = selectedUnits[p.id] ?? { variantId: defaultVariantId, unitId: defaultUnitId };
                const selectedVariant = p.variants.find((v) => v.variantId === sel.variantId) || p.variants[0];
                const currentUnit = selectedVariant?.units?.find((u) => u.id === sel.unitId) || selectedVariant.units[0];

                return (
                  <div key={p.id} className="border rounded-lg p-2 shadow-sm bg-white hover:shadow-md cursor-pointer" onClick={() => addToCart(p, sel.variantId, sel.unitId)}>
                    <div className="h-20 bg-gray-50 flex items-center justify-center rounded-md text-[10px] text-gray-400">No Image</div>
                    <h3 className="text-xs font-semibold mt-1.5 line-clamp-2 text-gray-900 leading-tight">{p.name}</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">{p.brandName} • {p.sizeName} • {p.modelName}</p>

                    {p.variants.length > 1 && (
                      <div className="mt-2">
                        <select className="text-[11px] border rounded px-2 py-1 w-full" value={sel.variantId} onClick={(e) => e.stopPropagation()} onChange={(e) => onSelectVariant(p.id, e.target.value)}>
                          {p.variants.map((v) => <option key={v.variantId} value={v.variantId}>{v.name}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div>
                        <div className="text-sm text-green-700 font-bold">₹{currentUnit.price}</div>
                        <div className="text-[10px] line-through text-gray-400">₹{currentUnit.mrp}</div>
                      </div>

                      <select className="text-[10px] border rounded px-1.5 py-1 bg-white" value={sel.unitId} onClick={(e) => e.stopPropagation()} onChange={(e) => onSelectUnit(p.id, e.target.value)}>
                        {selectedVariant.units.map((u) => <option key={u.id} value={u.id}>{u.name} — ₹{u.price}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>

          {/* RIGHT CART */}
          <div className="w-full md:w-1/3 bg-white p-4 rounded-xl border shadow-sm h-[calc(100vh-150px)] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Cart ({cart.length})</h3>
              <div className="text-sm text-gray-500">Items: {cart.reduce((s, i) => s + i.qty, 0)}</div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {cart.length === 0 && <div className="text-center text-gray-400 py-10">No items in cart</div>}

              {cart.map((it) => (
                <div key={it.cartId} className="bg-gray-50 border p-3 rounded-lg flex items-start justify-between">
                  <div className="w-2/3">
                    <div className="text-sm font-medium text-gray-900">{it.name}</div>
                    <div className="text-xs text-blue-500">{it.variantName}</div>
                    <div className="text-xs text-gray-500">Unit: {it.unitName}</div>
                    <div className="text-xs font-semibold text-green-700">₹{it.price}</div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-3">
                      <button className="px-2.5 py-1 bg-gray-200 rounded border" onClick={() => updateQty(it.cartId, it.qty - 1)}>-</button>
                      <span className="text-sm font-medium">{it.qty}</span>
                      <button className="px-2 py-1 bg-gray-200 rounded border" onClick={() => updateQty(it.cartId, it.qty + 1)}>+</button>
                    </div>
                    <button className="text-red-500 text-xs" onClick={() => updateQty(it.cartId, 0)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm">
                <span>Discount</span>
                <span>₹{totaldiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm"><span>GST</span><span>₹{totalgst.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold text-lg mt-1"><span>Total</span><span>₹{total.toFixed(2)}</span></div>

              <button
                className="w-full bg-blue-600 text-blue-600 py-2 rounded-lg mt-4 border"
                onClick={() => {
                  if (cart.length === 0) {
                    dispatch(showMessage({ message: "Please add at least one item before proceeding!", type: "error" }));
                    return;
                  }
                  setPaymentOpen(true);
                }}
              >
                Proceed to Payment
              </button>

              {/* Payment Drawer */}
              <PaymentDrawer
                open={paymentOpen}
                onClose={() => setPaymentOpen(false)}
                total={total}
                onComplete={handlePaymentComplete}
              />
            </div>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
}