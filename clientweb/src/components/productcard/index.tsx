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
  const Icon = product.icon;
  const discount = discountPercent(product.price, product.mrp);

  const handleAdd = () => {
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-3.5 transition hover:-translate-y-1 hover:shadow-lg">
      <Link
        to={`/product/${product.id}`}
        className="relative mb-3 flex h-36 items-center justify-center rounded-xl"
        style={{ background: `linear-gradient(135deg, ${product.from}, ${product.to})` }}
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
        <Icon className="h-14 w-14 text-ink-800/70" />
      </Link>

      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{product.brand}</p>
      <Link to={`/product/${product.id}`}>
        <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-ink-900 hover:text-brand-700">{product.name}</h3>
      </Link>

      <div className="mb-1.5 flex items-center gap-1">
        <div className="flex items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
          {product.rating} <Star className="h-3 w-3 fill-brand-700 text-brand-700" />
        </div>
        <span className="text-xs text-slate-400">({product.ratingCount})</span>
        <span className="ml-auto text-xs text-slate-400">{product.unit}</span>
      </div>

      <div className="mt-auto flex items-center justify-between pt-2">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-ink-900">{formatPrice(product.price)}</span>
            <span className="text-xs text-slate-400 line-through">{formatPrice(product.mrp)}</span>
          </div>
          {discount > 0 && <span className="text-[11px] font-semibold text-brand-600">{discount}% off</span>}
        </div>
        <button
          onClick={handleAdd}
          className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white transition ${
            added ? "bg-brand-600" : "bg-ink-900 hover:bg-brand-700"
          }`}
        >
          {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {added ? "Added" : "Add"}
        </button>
      </div>
    </div>
  );
}
