import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@apollo/client";
import apolloClient from "../graphql/client";
import { GET_ACCOUNT, RESOLVE_PRICE } from "../graphql/queries/accounts";
import { useAuth } from "../contexts/auth";
import { Package, type LucideIcon } from "lucide-react";
import { GET_STORE_CATEGORIES, GET_STORE_CATEGORY_COUNTS, GET_STORE_PRODUCTS, GET_STORE_PRODUCTS_PAGE } from "../graphql/queries/catalog";
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

const toProducts = (list: any[]) => list.filter((p: any) => p && p.status !== false).map(mapProduct);

// A logged-in party sees the rate from the price list assigned to them
// (customer → channel+region → channel → region), on every card and the
// detail page. Guests keep the base catalog price. Only the products passed
// in are resolved, so a paged list asks for the cards on screen only.
function usePartyPrices(baseProducts: SampleProduct[]): SampleProduct[] {
  const { adminid } = useTenant();
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
            // cache-first: every list shares the Apollo cache, so each product+unit is fetched once.
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

  return useMemo<SampleProduct[]>(() => {
    if (!account?.id || Object.keys(priceMap).length === 0) return baseProducts;
    return baseProducts.map((p) => {
      if (!p.variantid || !p.unitPrices?.length) return p;
      let changed = false;
      const unitPrices = p.unitPrices.map((u) => {
        const r = u.unitid ? priceMap[keyOf(p.id, p.variantid!, u.unitid)] : undefined;
        if (!r) return u;
        changed = true;
        // Keep the unit's own discount unless the price list sets one.
        return { ...u, price: r.rate, mrp: Math.max(u.mrp, r.rate), discount: r.discount };
      });
      if (!changed) return p;
      const first = unitPrices[0];
      return { ...p, unitPrices, price: first.price, mrp: first.mrp, discount: first.discount ?? 0 };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseProducts, priceMap, account?.id]);
}

const PALETTED = (list: any[], countOf: (id: string) => number): DisplayCategory[] =>
  list
    .filter((c: any) => c.status !== false)
    .map((c: any, i: number) => {
      const palette = PALETTE[i % PALETTE.length];
      return { id: c.id, name: c.categoryname, image: c.image || undefined, icon: Package, items: countOf(c.id), from: palette.from, to: palette.to };
    });

/** Categories with product counts, without loading the products (header, footer, grids, filters). */
export function useCatalogCategories() {
  const { adminid } = useTenant();
  const { data: catData, loading: catLoading } = useQuery(GET_STORE_CATEGORIES, {
    variables: { adminId: adminid },
    skip: !adminid,
  });
  const { data: countData, loading: countLoading } = useQuery(GET_STORE_CATEGORY_COUNTS, {
    variables: { adminid },
    skip: !adminid,
  });
  const categories = useMemo(() => {
    const counts = new Map<string, number>(((countData as any)?.getStoreCategoryCounts ?? []).map((r: any) => [String(r.categoryid), r.count]));
    return PALETTED((catData as any)?.getCategories ?? [], (id) => counts.get(String(id)) ?? 0);
  }, [catData, countData]);
  const total = useMemo(
    () => ((countData as any)?.getStoreCategoryCounts ?? []).reduce((t: number, r: any) => t + (r.count || 0), 0),
    [countData]
  );
  return { categories, total, loading: catLoading || countLoading };
}

type FeedFilter = { categoryid?: string | null; ids?: string[]; instockfirst?: boolean };

/**
 * One page of products at a time (in-stock first, like the full list);
 * loadMore() appends the next page — used for infinite scroll on Home / Shop.
 * pageSize 0 loads the whole set in one go (picked ids).
 */
export function useProductFeed(filter: FeedFilter, opts: { pageSize?: number; skip?: boolean; page?: number } = {}) {
  const { adminid } = useTenant();
  const pageSize = opts.pageSize ?? 20;
  const skip = !!opts.skip || !adminid || (filter.ids !== undefined && filter.ids.length === 0);
  const serverFilter = useMemo(() => {
    const f: any = { adminid, instockfirst: filter.instockfirst ?? true };
    if (filter.categoryid) f.categoryid = filter.categoryid;
    if (filter.ids?.length) f.ids = filter.ids;
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminid, filter.categoryid, filter.instockfirst, (filter.ids || []).join(",")]);
  // `page` set: that one numbered page only (no loadMore).
  const startAt = opts.page ? (opts.page - 1) * pageSize : 0;
  const key = JSON.stringify(serverFilter) + pageSize + ":" + startAt;

  const { data, loading } = useQuery(GET_STORE_PRODUCTS_PAGE, {
    variables: { filter: serverFilter, limit: pageSize, offset: startAt },
    skip,
  });
  const first: any[] = (data as any)?.getProductServices ?? [];

  const [more, setMore] = useState<{ key: string; rows: any[]; done: boolean }>({ key, rows: [], done: false });
  const [loadingMore, setLoadingMore] = useState(false);
  const cur = more.key === key ? more : { key, rows: [], done: false };
  const hasMore = !skip && !opts.page && pageSize > 0 && !cur.done && first.length === pageSize;

  const busy = useRef(false);
  const loadMore = useCallback(async () => {
    if (!hasMore || busy.current) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const offset = pageSize * (1 + Math.floor(cur.rows.length / pageSize));
      const { data: next } = await apolloClient.query({
        query: GET_STORE_PRODUCTS_PAGE,
        variables: { filter: serverFilter, limit: pageSize, offset },
      });
      const rows: any[] = (next as any)?.getProductServices ?? [];
      setMore((m) => {
        const base = m.key === key ? m.rows : [];
        return { key, rows: [...base, ...rows], done: rows.length < pageSize };
      });
    } catch {
      // Network hiccup: the sentinel asks again on the next scroll.
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, pageSize, cur.rows.length, serverFilter, key]);

  const baseProducts = useMemo(() => {
    const seen = new Set<string>();
    return toProducts([...first, ...cur.rows].filter((p: any) => p && !seen.has(p.id) && seen.add(p.id)));
  }, [first, cur.rows]);
  const products = usePartyPrices(baseProducts);
  return { products, loading: loading && !first.length, loadingMore, hasMore, loadMore };
}

/** The whole catalog in one list. Only for screens that need every product (account reorder, order edit, shop's price/brand filters). */
export function useCatalog(opts: { skip?: boolean } = {}) {
  const { adminid } = useTenant();
  const { categories, loading: catLoading } = useCatalogCategories();

  // limit 0 = everything; out-of-stock last (the server orders them so too).
  const { data: prodData, loading: prodLoading } = useQuery(GET_STORE_PRODUCTS, {
    variables: { adminid },
    skip: !adminid || !!opts.skip,
  });

  const baseProducts = useMemo<SampleProduct[]>(() => {
    const list = (prodData as any)?.getProductServices ?? [];
    return inStockFirst(toProducts(list));
  }, [prodData]);

  const products = usePartyPrices(baseProducts);
  return { categories, products, loading: catLoading || prodLoading };
}
