import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@apollo/client";
import type { SampleProduct } from "../data/sampleData";
import { useAuth } from "./auth";
import { useTenant } from "./tenant";
import apolloClient from "../graphql/client";
import { GET_ACCOUNT, RESOLVE_PRICE } from "../graphql/queries/accounts";

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
  // Needed to actually place a real order (SalesOrderProductServiceInput).
  variantid?: string;
  unitid?: string | null;
  unitqty?: number;
  gst?: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  wishlistCount: number;
  addToCart: (product: SampleProduct, qty?: number, unit?: string) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeFromCart: (lineId: string) => void;
  clearCart: () => void;
  addToWishlist: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// In-memory cart — a real cart (Redux slice + SalesOrder draft synced with
// PriceList/PriceAssignment) is the natural next step once GraphQL is wired.
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const { account } = useAuth();
  const { adminid } = useTenant();

  // Channel/region for the logged-in party — needed for resolvePrice's
  // channel/channel+region/region fallback tiers, same as clientapp's
  // Catalog screen (which fetches this once via GET_ACCOUNT too).
  const { data: accountData } = useQuery(GET_ACCOUNT, {
    variables: { id: account?.id, adminId: adminid },
    skip: !account?.id || !adminid,
  });
  const partyAccount = accountData?.getAccountById;

  const addToCart = (product: SampleProduct, qty = 1, unit?: string) => {
    const chosenUnit = unit ?? product.units[0];
    // Each unit (Piece, Dozen, ...) can have its own price — look it up so
    // the cart charges for whichever unit was actually selected, instead of
    // always using the first unit's price.
    const matched = product.unitPrices?.find((u) => u.label === chosenUnit);
    const price = matched?.price ?? product.price;
    const mrp = matched?.mrp ?? product.mrp;
    const lineId = `${product.id}-${chosenUnit}`;

    const pushLine = (finalPrice: number) => {
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
            price: finalPrice,
            mrp,
            qty,
            icon: product.icon,
            from: product.from,
            to: product.to,
            imageurl: product.imageurl,
            variantid: product.variantid,
            unitid: matched?.unitid ?? null,
            unitqty: matched?.unitQuantity ?? 1,
            gst: product.gst ?? 0,
          },
        ];
      });
    };

    // Party-specific / channel / region price assignment — same resolvePrice
    // lookup clientapp's Catalog screen makes on "Add to Cart", so a logged-in
    // party's own negotiated price/discount applies here too, not just the
    // public catalog rate. Guest (not logged in) browsing just uses the base
    // catalog price — there's no account to resolve a price for.
    if (account?.id && product.variantid && matched?.unitid) {
      apolloClient
        .query({
          query: RESOLVE_PRICE,
          variables: {
            productid: product.id,
            variantid: product.variantid,
            unitid: matched.unitid,
            adminid: adminid || null,
            accountid: account.id,
            channelid: partyAccount?.channel?.id ?? null,
            region: partyAccount?.region ?? null,
          },
          fetchPolicy: "network-only",
        })
        .then(({ data }) => {
          const rp = data?.resolvePrice;
          if (!rp) {
            pushLine(price);
            return;
          }
          const rate = rp.rate != null ? rp.rate : price;
          // Only apply a resolved discount when it's a real positive value —
          // a null/zero result must not wipe the product's own unit price.
          const discount = rp.discount != null && rp.discount > 0 ? rp.discount : 0;
          pushLine(rate - discount);
        })
        .catch(() => pushLine(price));
    } else {
      pushLine(price);
    }
  };

  const updateQty = (lineId: string, qty: number) => {
    setLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, qty: Math.max(1, qty) } : l)));
  };

  const removeFromCart = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  // Called once an order is actually placed at checkout — same as the app,
  // which empties its cart right after a successful addSalesOrder, instead
  // of leaving the just-ordered items sitting in the cart/badge count.
  const clearCart = () => setLines([]);

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
      clearCart,
      addToWishlist: () => setWishlistCount((c) => c + 1),
    }),
    [lines, count, subtotal, wishlistCount, account?.id, adminid, partyAccount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
