import { useMemo } from "react";
import { useQuery } from "@apollo/client";
import { Package, type LucideIcon } from "lucide-react";
import { GET_STORE_CATEGORIES, GET_STORE_PRODUCTS } from "../graphql/queries/catalog";
import { useTenant } from "../contexts/tenant";
import type { SampleProduct } from "../data/sampleData";

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
  const unitPrices: { label: string; price: number; mrp: number; unitid: string | null; unitQuantity: number }[] = rawUnitprices.map((u: any) => {
    const name = u.unitid?.unitname ?? "Unit";
    const label = u.quantity > 1 ? `${u.quantity} × ${name}` : name;
    const price = (u.offerprice ?? 0) > 0 ? u.offerprice : (u.salesrate ?? 0);
    const mrp = u.mrp && u.mrp > price ? u.mrp : price;
    const unitid = u.unitid?.id ?? null;
    return { label, price, mrp, unitid, unitQuantity: u.quantity || 1 };
  });

  const first = unitPrices[0] ?? { label: "1 unit", price: 0, mrp: 0 };

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

  const { data: prodData, loading: prodLoading } = useQuery(GET_STORE_PRODUCTS, {
    variables: { adminid, limit: 200 },
    skip: !adminid,
  });

  const products = useMemo<SampleProduct[]>(() => {
    const list = (prodData as any)?.getProductServices ?? [];
    return list.filter((p: any) => p && p.status !== false).map(mapProduct);
  }, [prodData]);

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
