import { useState } from "react";
import { Link } from "react-router";
import { Heart, Plus, Check, Star } from "lucide-react";
import type { SampleProduct } from "../../data/sampleData";
import { useCart } from "../../contexts/cart";
import { formatPrice, discountPercent } from "../../utils/format";

const badgeStyles: Record<string, string> = {
  NEW: "bg-blue-600",
  SALE: "bg-rose-600",
  BESTSELLER: "bg-amber-600",
};

export default function ProductCard({ product }: { product: SampleProduct }) {
  const { addToCart, addToWishlist } = useCart();
  const [added, setAdded] = useState(false);
  const [wished, setWished] = useState(false);
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
  const outOfStock = typeof product.stock === "number" && product.stock <= 0;
  const lowStock = typeof product.stock === "number" && product.stock > 0 && product.stock <= 5;

  const handleAdd = () => {
    if (outOfStock) return;
    addToCart(product, 1, selected.label);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="group flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-3.5 transition hover:-translate-y-1 hover:shadow-lg">
      <Link
        to={`/product/${product.id}`}
        className="relative mb-3 flex h-36 items-center justify-center overflow-hidden rounded-xl"
        style={product.imageurl ? undefined : { background: `linear-gradient(135deg, ${product.from}, ${product.to})` }}
      >
        {product.badge && (
          <span
            className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold text-white ${badgeStyles[product.badge]}`}
          >
            {product.badge}
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            setWished((w) => !w);
            if (!wished) addToWishlist();
          }}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/80 hover:bg-white"
          aria-label="Add to wishlist"
        >
          <Heart className={`h-3.5 w-3.5 ${wished ? "fill-rose-500 text-rose-500" : "text-slate-500"}`} />
        </button>
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

      {outOfStock ? (
        <p className="mb-1.5 text-[11px] font-semibold text-rose-600">Out of stock</p>
      ) : lowStock ? (
        <p className="mb-1.5 text-[11px] font-semibold text-amber-600">Only {product.stock} left</p>
      ) : typeof product.stock === "number" ? (
        <p className="mb-1.5 text-[11px] font-medium text-emerald-600">{product.stock} in stock</p>
      ) : null}

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

      <div className="mt-auto flex items-center justify-between pt-2">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-ink-900">{formatPrice(selected.price)}</span>
            {selected.mrp > selected.price && (
              <span className="text-xs text-slate-400 line-through">{formatPrice(selected.mrp)}</span>
            )}
          </div>
          <span className="block h-4 text-[11px] font-semibold text-brand-600">
            {discount > 0 ? `${discount}% off` : " "}
          </span>
        </div>
        <button
          onClick={handleAdd}
          disabled={outOfStock}
          className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white transition ${
            outOfStock ? "bg-slate-300" : added ? "bg-brand-600" : "bg-ink-900 hover:bg-brand-700"
          }`}
        >
          {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {outOfStock ? "Unavailable" : added ? "Added" : "Add"}
        </button>
      </div>
    </div>
  );
}
