import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@apollo/client";
import apolloClient from "../graphql/client";
import { GET_ACCOUNT, RESOLVE_PRICE } from "../graphql/queries/accounts";
import { useAuth } from "../contexts/auth";
import { Package, type LucideIcon } from "lucide-react";
import { GET_STORE_CATEGORIES, GET_STORE_PRODUCTS } from "../graphql/queries/catalog";
import { useTenant } from "../contexts/tenant";
import type { SampleProduct } from "../data/sampleData";
import { inStockFirst } from "../utils/stock";

export interface DisplayCategory {
  id: string;
  name: string;
  image?: string;
  icon: LucideIcon;
  items: number;
  from: string;
  to: string;
}

// Cosmetic-only palette — real categories don't carry a color/icon in the
// database, so we cycle through the same soft gradients the demo data used,
// purely for visual variety on the category grid/nav.
const PALETTE = [
  { from: "#dcfce7", to: "#bbf7d0" },
  { from: "#dbeafe", to: "#bfdbfe" },
  { from: "#fce7f3", to: "#fbcfe8" },
  { from: "#ffedd5", to: "#fed7aa" },
  { from: "#fae8ff", to: "#f5d0fe" },
  { from: "#fef9c3", to: "#fef08a" },
  { from: "#e0f2fe", to: "#bae6fd" },
  { from: "#ede9fe", to: "#ddd6fe" },
];

function mapProduct(p: any): SampleProduct {
  const variant = p.productvariants?.[0];
  const rawUnitprices: any[] = variant?.unitprices ?? [];

  // Same default-price rule the app's party Catalog screen uses: offerprice
  // wins if set, otherwise salesrate. This is the price shown to anyone who
  // isn't logged in (or has no party-specific price assignment) — party
  // login will later override this per line via resolvePrice. Each unit
  // (Piece, Dozen, ...) gets its own price/mrp here, same as the app, so
  // switching units on the card actually changes the price shown/added.
  // Base units in one of the unit — the variant's conversion factor for it,
  // 1 for the base unit itself. Stock is kept in base units, so a "Box of 12"
  // uses up 12 of it.
  const factorOf = (unitid: string | null) => {
    const conv = (variant?.unitconversions ?? []).find((c: any) => c?.unitid?.id && c.unitid.id === unitid);
    const f = Number(conv?.factor);
    return f > 0 ? f : 1;
  };

  const unitPrices: { label: string; price: number; mrp: number; discount: number; unitid: string | null; unitQuantity: number; baseQty: number }[] = rawUnitprices.map((u: any) => {
    const name = u.unitid?.unitname ?? "Unit";
    const label = u.quantity > 1 ? `${u.quantity} × ${name}` : name;
    const price = (u.offerprice ?? 0) > 0 ? u.offerprice : (u.salesrate ?? 0);
    const mrp = u.mrp && u.mrp > price ? u.mrp : price;
    // The admin's own per-unit rupee discount off the rate — the same field
    // the POS (`chosenUnit.discount`) and the app (`up.discount`) subtract to
    // reach the payable amount. It was being dropped here, which is why the
    // website's cart charged the full rate and then invented a "discount"
    // out of the MRP gap instead. MRP stays a display-only strike-through.
    const discount = Number(u.discount) || 0;
    const unitid = u.unitid?.id ?? null;
    const unitQuantity = u.quantity || 1;
    return { label, price, mrp, discount, unitid, unitQuantity, baseQty: unitQuantity * factorOf(unitid) };
  });

  const first = unitPrices[0] ?? { label: "1 unit", price: 0, mrp: 0, discount: 0 };

  // Total stock across all variants — shown on the card/detail page
  // instead of a brand name, same as the mobile app's catalog screen.
  const stock = (p.productvariants ?? []).reduce(
    (sum: number, v: any) => sum + (Number(v?.currentstock) || 0),
    0
  );

  return {
    id: p.id,
    name: p.name,
    category: p.categoryid?.id ?? "",
    categoryName: p.categoryid?.categoryname ?? "",
    brand: p.brandid?.brandname ?? "",
    stock,
    unit: first.label,
    units: unitPrices.map((u) => u.label),
    price: first.price,
    mrp: first.mrp,
    discount: first.discount ?? 0,
    unitPrices,
    rating: 0,
    ratingCount: 0,
    icon: Package,
    from: "#ecfdf5",
    to: "#d1fae5",
    imageurl: p.imageurl || undefined,
    imageurls: Array.isArray(p.imageurls) && p.imageurls.length ? p.imageurls : undefined,
    createdAt: p.createdAt || undefined,
    variantid: variant?.id,
    variantStock: typeof variant?.currentstock === "number" ? Number(variant.currentstock) : undefined,
    gst: variant?.gst ?? 0,
    description: p.description || `Genuine, quality-checked — ${p.name}.`,
    highlights: ["Genuine product", "Quality checked", "Fast delivery", "Easy returns"],
  };
}

// Real, adminid-scoped product/category data for the storefront — the
// website equivalent of the app's party Catalog screen. Every page (Home,
// Shop, ProductDetail, CategoryGrid, Header nav) reads from this single
// hook so there's one source of truth instead of each page re-fetching.
export function useCatalog() {
  const { adminid } = useTenant();

  const { data: catData, loading: catLoading } = useQuery(GET_STORE_CATEGORIES, {
    variables: { adminId: adminid },
    skip: !adminid,
  });

  // No limit: the server treats limit=0 as "everything". The old cap of 200
  // silently dropped products past that point — and because the resolver had no
  // sort, WHICH 200 came back was up to Mongo, so a product could appear one day
  // and vanish the next. The category counts on the home grid are derived from
  // this same list, so a short list also made every count wrong.
  const { data: prodData, loading: prodLoading } = useQuery(GET_STORE_PRODUCTS, {
    variables: { adminid },
    skip: !adminid,
  });

  const baseProducts = useMemo<SampleProduct[]>(() => {
    const list = (prodData as any)?.getProductServices ?? [];
    // Out-of-stock last everywhere the storefront lists products (the server
    // already orders them so; this keeps it true by the card's own rule).
    return inStockFirst(list.filter((p: any) => p && p.status !== false).map(mapProduct));
  }, [prodData]);

  // ---- Party price list -------------------------------------------------
  // A logged-in party sees the rate from the price list assigned to them
  // (customer → channel+region → channel → region), on every card and the
  // detail page — not only once the item is in the cart. Guests keep the
  // base catalog price.
  const { account } = useAuth();
  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: account?.id, adminId: adminid },
    skip: !account?.id || !adminid,
  });
  const partyAccount = (accountData as any)?.getAccountById;

  type Resolved = { rate: number; discount: number } | null;
  const [priceMap, setPriceMap] = useState<Record<string, Resolved>>({});
  const priceMapRef = useRef(priceMap);
  priceMapRef.current = priceMap;
  const keyOf = (pid: string, vid: string, uid: string) => `${pid}:${vid}:${uid}`;

  // Different party (login/logout) → drop the previous party's prices.
  useEffect(() => { setPriceMap({}); }, [account?.id, adminid]);

  useEffect(() => {
    if (!account?.id || !adminid || baseProducts.length === 0) return;
    const channelid = partyAccount?.channel?.id ?? null;
    const region = partyAccount?.region ?? null;
    let cancelled = false;
    (async () => {
      const updates: Record<string, Resolved> = {};
      await Promise.all(baseProducts.flatMap((p) =>
        (p.unitPrices ?? []).map(async (u) => {
          if (!p.variantid || !u.unitid) return;
          const key = keyOf(p.id, p.variantid, u.unitid);
          if (priceMapRef.current[key] !== undefined) return;
          try {
            // cache-first: every component that calls useCatalog shares the
            // same Apollo cache, so each product+unit is fetched once.
            const { data } = await apolloClient.query({
              query: RESOLVE_PRICE,
              variables: { productid: p.id, variantid: p.variantid, unitid: u.unitid, adminid, accountid: account.id, channelid, region },
              fetchPolicy: "cache-first",
            });
            const rp = (data as any)?.resolvePrice;
            updates[key] = rp?.rate != null ? { rate: rp.rate, discount: Number(rp.discount) || 0 } : null;
          } catch {
            updates[key] = null;
          }
        })
      ));
      if (!cancelled && Object.keys(updates).length) setPriceMap((prev) => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseProducts, partyAccount, account?.id, adminid]);

  const products = useMemo<SampleProduct[]>(() => {
    if (!account?.id || Object.keys(priceMap).length === 0) return baseProducts;
    return baseProducts.map((p) => {
      if (!p.variantid || !p.unitPrices?.length) return p;
      let changed = false;
      const unitPrices = p.unitPrices.map((u) => {
        const r = u.unitid ? priceMap[keyOf(p.id, p.variantid!, u.unitid)] : undefined;
        if (!r) return u;
        changed = true;
        return {
          ...u,
          price: r.rate,
          mrp: Math.max(u.mrp, r.rate),
          // Keep the unit's own discount unless the price list sets one.
          discount: r.discount > 0 ? r.discount : u.discount,
        };
      });
      if (!changed) return p;
      const first = unitPrices[0];
      return { ...p, unitPrices, price: first.price, mrp: first.mrp, discount: first.discount ?? 0 };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseProducts, priceMap, account?.id]);

  const categories = useMemo<DisplayCategory[]>(() => {
    const list = (catData as any)?.getCategories ?? [];
    return list
      .filter((c: any) => c.status !== false)
      .map((c: any, i: number) => {
        const palette = PALETTE[i % PALETTE.length];
        return {
          id: c.id,
          name: c.categoryname,
          image: c.image || undefined,
          icon: Package,
          items: products.filter((p) => p.category === c.id).length,
          from: palette.from,
          to: palette.to,
        };
      });
  }, [catData, products]);

  return { categories, products, loading: catLoading || prodLoading };
}
