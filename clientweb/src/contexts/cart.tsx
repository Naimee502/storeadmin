import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SampleProduct } from "../data/sampleData";

export interface CartLine {
  lineId: string;
  productId: string;
  name: string;
  categoryName?: string;
  unit: string;
  price: number;
  mrp: number;
  qty: number;
  icon: SampleProduct["icon"];
  from: string;
  to: string;
  imageurl?: string;
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

// In-memory cart — a real cart (Redux slice + SalesOrder draft synced with
// PriceList/PriceAssignment) is the natural next step once GraphQL is wired.
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);

  const addToCart = (product: SampleProduct, qty = 1, unit?: string) => {
    const chosenUnit = unit ?? product.units[0];
    // Each unit (Piece, Dozen, ...) can have its own price — look it up so
    // the cart charges for whichever unit was actually selected, instead of
    // always using the first unit's price.
    const matched = product.unitPrices?.find((u) => u.label === chosenUnit);
    const price = matched?.price ?? product.price;
    const mrp = matched?.mrp ?? product.mrp;
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
          categoryName: product.categoryName,
          unit: chosenUnit,
          price,
          mrp,
          qty,
          icon: product.icon,
          from: product.from,
          to: product.to,
          imageurl: product.imageurl,
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
