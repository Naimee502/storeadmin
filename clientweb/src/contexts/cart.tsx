import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { sampleProducts, type SampleProduct } from "../data/sampleData";

export interface CartLine {
  lineId: string;
  productId: string;
  name: string;
  brand: string;
  unit: string;
  price: number;
  mrp: number;
  qty: number;
  icon: SampleProduct["icon"];
  from: string;
  to: string;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  wishlistCount: number;
  addToCart: (product: SampleProduct, qty?: number, unit?: string) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeFromCart: (lineId: string) => void;
  addToWishlist: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// A couple of items pre-seeded so Cart/Checkout don't look empty on first
// load — matches the "3 items" cart badge in the reference screenshots.
const seedProducts = [sampleProducts[0], sampleProducts[1]];

// In-memory cart — a real cart (Redux slice + SalesOrder draft synced with
// PriceList/PriceAssignment) is the natural next step once GraphQL is wired.
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() =>
    seedProducts.map((p) => ({
      lineId: `${p.id}-${p.units[0]}`,
      productId: p.id,
      name: p.name,
      brand: p.brand,
      unit: p.units[0],
      price: p.price,
      mrp: p.mrp,
      qty: 1,
      icon: p.icon,
      from: p.from,
      to: p.to,
    }))
  );
  const [wishlistCount, setWishlistCount] = useState(2);

  const addToCart = (product: SampleProduct, qty = 1, unit?: string) => {
    const chosenUnit = unit ?? product.units[0];
    const lineId = `${product.id}-${chosenUnit}`;
    setLines((prev) => {
      const existing = prev.find((l) => l.lineId === lineId);
      if (existing) {
        return prev.map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + qty } : l));
      }
      return [
        ...prev,
        {
          lineId,
          productId: product.id,
          name: product.name,
          brand: product.brand,
          unit: chosenUnit,
          price: product.price,
          mrp: product.mrp,
          qty,
          icon: product.icon,
          from: product.from,
          to: product.to,
        },
      ];
    });
  };

  const updateQty = (lineId: string, qty: number) => {
    setLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, qty: Math.max(1, qty) } : l)));
  };

  const removeFromCart = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  const value = useMemo(
    () => ({
      lines,
      count,
      subtotal,
      wishlistCount,
      addToCart,
      updateQty,
      removeFromCart,
      addToWishlist: () => setWishlistCount((c) => c + 1),
    }),
    [lines, count, subtotal, wishlistCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
