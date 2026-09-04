import { useState } from "react";
import { Link } from "react-router";
import { Plus, Minus, Star } from "lucide-react";
import type { SampleProduct } from "../../data/sampleData";
import { useCart } from "../../contexts/cart";
import { useTenant } from "../../contexts/tenant";
import { discountPercent } from "../../utils/format";
import { useCatalogPrice } from "../../utils/catalogprice";

const badgeStyles: Record<string, string> = {
  NEW: "bg-blue-600",
  SALE: "bg-rose-600",
  BESTSELLER: "bg-amber-600",
};

export default function ProductCard({
  product,
  // Which section's image ratio this card follows (Settings -> General ->
  // Product Image Ratio). Left out, it takes the Home/Featured value — that
  // covers the cards that aren't part of a named section, like related
  // products on a product page or the account page's reorder grid.
  imageRatio,
}: {
  product: SampleProduct;
  imageRatio?: string;
}) {
  const { lines, addToCart, updateQty, removeFromCart } = useCart();
  const { displayProductPrice, displayStock, homeProductImageRatio } = useTenant();
  // Card prices follow the admin's "Show Double Price" display markup; the
  // Add-to-cart handlers below pass the untouched product through to the cart,
  // so the line and the total stay on the real rate.
  const { formatCatalogPrice } = useCatalogPrice();
  const ratio = imageRatio ?? homeProductImageRatio;
  const [unitIdx, setUnitIdx] = useState(0);
  const Icon = product.icon;

  // Same as the app's catalog card — when a product has more than one unit
  // (Piece, Dozen, ...), let the buyer pick one right here and show/add
  // whichever unit's price is selected, instead of always the first one.
  const unitChips = product.unitPrices?.length ? product.unitPrices : [{ label: product.unit, price: product.price, mrp: product.mrp, unitid: null }];
  const hasMultipleUnits = unitChips.length > 1;
  const selected = unitChips[unitIdx] ?? unitChips[0];
  const discount = discountPercent(selected.price, selected.mrp);

  // Out-of-stock is only enforced when we actually have a stock number —
  // sample/fallback products without one stay purchasable.
  // Blank keeps the fixed h-36 every card used before the setting existed; a
  // ratio swaps that for an aspect-ratio box, so a grid of differently
  // proportioned uploads still lines up (the photo itself stays object-cover).
  const imageBoxStyle = ratio ? { aspectRatio: ratio.replace(":", " / ") } : undefined;

  const outOfStock = typeof product.stock === "number" && product.stock <= 0;
  const lowStock = typeof product.stock === "number" && product.stock > 0 && product.stock <= 5;

  // Cart line for whichever unit is currently selected — same lineId scheme
  // as CartProvider (`${productId}-${unit}`), so switching the unit chip
  // shows/adds to that unit's own line instead of a shared counter.
  const lineId = `${product.id}-${selected.label}`;
  const line = lines.find((l) => l.lineId === lineId);
  const atStockLimit = typeof product.stock === "number" && !!line && line.qty >= product.stock;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (outOfStock) return;
    addToCart(product, 1, selected.label);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    if (atStockLimit) return;
    if (line) updateQty(line.lineId, line.qty + 1);
    else addToCart(product, 1, selected.label);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!line) return;
    if (line.qty <= 1) removeFromCart(line.lineId);
    else updateQty(line.lineId, line.qty - 1);
  };

  return (
    <div className="group flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-3.5 transition hover:-translate-y-1 hover:shadow-lg">
      <Link
        to={`/product/${product.id}`}
        className={`relative mb-3 flex ${ratio ? "w-full" : "h-36"} items-center justify-center overflow-hidden rounded-xl`}
        style={{
          ...imageBoxStyle,
          ...(product.imageurl ? {} : { background: `linear-gradient(135deg, ${product.from}, ${product.to})` }),
        }}
      >
        {product.badge && (
          <span
            className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold text-white ${badgeStyles[product.badge]}`}
          >
            {product.badge}
          </span>
        )}
        {product.imageurl ? (
          <img src={product.imageurl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-14 w-14 text-brand-600" />
        )}
      </Link>

      <Link to={`/product/${product.id}`}>
        <h3 className="mb-0.5 line-clamp-2 text-sm font-semibold text-ink-900 hover:text-brand-700">{product.name}</h3>
      </Link>
      {product.categoryName && (
        <p className="mb-1 text-[11px] text-slate-400">{product.categoryName}</p>
      )}

      <div className="mb-1.5 flex items-center gap-1">
        {product.ratingCount > 0 && (
          <>
            <div className="flex items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
              {product.rating} <Star className="h-3 w-3 fill-brand-700 text-brand-700" />
            </div>
            <span className="text-xs text-slate-400">({product.ratingCount})</span>
          </>
        )}
      </div>

      {displayStock && (
        outOfStock ? (
          <p className="mb-1.5 text-[11px] font-semibold text-rose-600">Out of stock</p>
        ) : lowStock ? (
          <p className="mb-1.5 text-[11px] font-semibold text-amber-600">Only {product.stock} left</p>
        ) : typeof product.stock === "number" ? (
          <p className="mb-1.5 text-[11px] font-medium text-emerald-600">{product.stock} in stock</p>
        ) : null
      )}

      {/* Unit chips — Piece / Dozen etc., same as the app's catalog card.
          Always shown (even for a single unit) so every card has the same layout. */}
      <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
        {unitChips.map((u, i) => (
          <button
            key={u.label}
            onClick={(e) => {
              e.preventDefault();
              if (hasMultipleUnits) setUnitIdx(i);
            }}
            className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              i === unitIdx
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 text-ink-900 hover:border-brand-400"
            } ${!hasMultipleUnits ? "cursor-default" : ""}`}
          >
            {u.label}
          </button>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        {displayProductPrice ? (
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-ink-900">{formatCatalogPrice(selected.price)}</span>
            {selected.mrp > selected.price && (
              <span className="text-xs text-slate-400 line-through">{formatCatalogPrice(selected.mrp)}</span>
            )}
          </div>
          <span className="block h-4 text-[11px] font-semibold text-brand-600">
            {discount > 0 ? `${discount}% off` : " "}
          </span>
        </div>
        ) : (
          <div />
        )}
        {outOfStock ? (
          <button
            disabled
            className="shrink-0 whitespace-nowrap rounded-lg bg-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-500"
          >
            Unavailable
          </button>
        ) : line ? (
          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-ink-900 px-1 py-1">
            <button
              onClick={handleDecrement}
              className="grid h-6 w-6 place-items-center rounded-md text-white hover:bg-white/10"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-5 text-center text-xs font-semibold text-white">{line.qty}</span>
            <button
              onClick={handleIncrement}
              disabled={atStockLimit}
              className="grid h-6 w-6 place-items-center rounded-md text-white hover:bg-white/10 disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>
    </div>
  );
}
