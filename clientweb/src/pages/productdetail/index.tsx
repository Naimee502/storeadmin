import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { Star, Minus, Plus, ShieldCheck, Truck, RotateCcw, Briefcase, Check } from "lucide-react";
import Breadcrumb from "../../components/breadcrumb";
import ProductCard from "../../components/productcard";
import SectionHeader from "../../components/sectionheader";
import { useCatalog } from "../../hooks/useCatalog";
import { useCart } from "../../contexts/cart";
import { useTenant } from "../../contexts/tenant";
import { discountPercent } from "../../utils/format";
import { useCatalogPrice } from "../../utils/catalogprice";

const tabs = ["Description", "Highlights", "Reviews"] as const;

const sampleReviews = [
  { name: "Priya S.", rating: 5, text: "Great quality, exactly as described. Delivery was quick too." },
  { name: "Rahul M.", rating: 4, text: "Good value for money. Would buy again for my shop's regular stock." },
  { name: "Anita K.", rating: 5, text: "Ordered in bulk for my store — packaging and pricing were both solid." },
];

export default function ProductDetailPage() {
  const { id } = useParams();
  const { products, categories, loading } = useCatalog();
  const product = useMemo(() => products.find((p) => p.id === id) ?? products[0], [products, id]);
  const category = categories.find((c) => c.id === product?.category);

  const [selectedUnit, setSelectedUnit] = useState(product?.units[0]);
  useEffect(() => setSelectedUnit(product?.units[0]), [product]);
  // Which gallery image is shown large — resets whenever the product changes.
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  useEffect(() => setActiveImageIdx(0), [product]);
  // Quantity to add, only used before the product is actually in the cart —
  // once it's in, the stepper reads/writes the real cart line quantity
  // instead of a separate local counter that always looked reset to 1.
  const [pendingQty, setPendingQty] = useState(1);
  useEffect(() => setPendingQty(1), [product, selectedUnit]);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Description");
  const { lines, addToCart, updateQty, removeFromCart } = useCart();
  const { displayProductPrice, displayStock } = useTenant();
  // Display-only x2 markup (Business Settings -> "Show Double Price"). The
  // Add-to-cart button below is untouched — it hands the cart the real rate.
  const { formatCatalogPrice } = useCatalogPrice();

  if (loading && !product) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center text-sm text-slate-500">Loading product…</div>;
  }
  if (!product) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center text-sm text-slate-500">Product not found.</div>;
  }

  const Icon = product.icon;
  // Look up the price for whichever unit (Piece, Dozen, ...) is selected —
  // same as ProductCard, instead of always showing the first unit's price.
  const selected = product.unitPrices?.find((u) => u.label === selectedUnit) ?? {
    label: selectedUnit ?? product.unit,
    price: product.price,
    mrp: product.mrp,
  };
  const discount = discountPercent(selected.price, selected.mrp);
  const outOfStock = typeof product.stock === "number" && product.stock <= 0;
  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  // Full gallery — falls back to the single imageurl, or no images at all
  // (decorative icon tiles below cover that case, same as before).
  const galleryImages = product.imageurls?.length ? product.imageurls : product.imageurl ? [product.imageurl] : [];
  const mainImage = galleryImages[activeImageIdx] ?? galleryImages[0];

  // Cart line for whichever unit is currently selected — same lineId scheme
  // as CartProvider (`${productId}-${unit}`), so the stepper here shows the
  // real quantity already in the cart instead of resetting to 1.
  const lineId = `${product.id}-${selectedUnit}`;
  const line = lines.find((l) => l.lineId === lineId);
  const atStockLimit = typeof product.stock === "number" && !!line && line.qty >= product.stock;
  const displayQty = line ? line.qty : pendingQty;

  const handleAdd = () => {
    if (outOfStock) return;
    addToCart(product, pendingQty, selectedUnit);
  };

  const handleIncrement = () => {
    if (line) {
      if (!atStockLimit) updateQty(line.lineId, line.qty + 1);
    } else {
      setPendingQty((q) => q + 1);
    }
  };

  const handleDecrement = () => {
    if (line) {
      if (line.qty <= 1) removeFromCart(line.lineId);
      else updateQty(line.lineId, line.qty - 1);
    } else {
      setPendingQty((q) => Math.max(1, q - 1));
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          ...(category ? [{ label: category.name, to: "/shop" }] : []),
          { label: product.name },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="relative mb-4 aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {mainImage ? (
                <img src={mainImage} alt={product.name} className="h-full w-full object-contain" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${product.from}, ${product.to})` }}
                >
                  <Icon className="h-32 w-32 text-brand-600" />
                </div>
              )}
              {displayProductPrice && discount > 0 && (
                <span className="absolute left-3 top-3 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white shadow">
                  {discount}% OFF
                </span>
              )}
            </div>
            {galleryImages.length > 1 ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {galleryImages.map((url, i) => (
                  <button
                    key={url + i}
                    onClick={() => setActiveImageIdx(i)}
                    className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-white p-1.5 transition ${
                      i === activeImageIdx ? "border-brand-600 shadow-sm" : "border-slate-200 hover:border-brand-400"
                    }`}
                    aria-label={`Show image ${i + 1}`}
                  >
                    <img src={url} alt={`${product.name} ${i + 1}`} className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            ) : !mainImage ? (
              <div className="grid grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <button
                    key={i}
                    className="flex h-20 items-center justify-center rounded-xl border-2 border-transparent transition hover:border-brand-400"
                    style={{ background: `linear-gradient(135deg, ${product.from}, ${product.to})` }}
                  >
                    <Icon className="h-8 w-8 rotate-0 text-brand-600/70" style={{ transform: `rotate(${i * 15}deg)` }} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Info */}
          <div>
            <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{product.name}</h1>
            {product.categoryName && <p className="mt-1 text-sm text-slate-500">{product.categoryName}</p>}

            {product.ratingCount > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-sm font-semibold text-brand-700">
                  {product.rating} <Star className="h-3.5 w-3.5 fill-brand-700 text-brand-700" />
                </div>
                <a href="#reviews" className="text-sm text-slate-500 hover:text-brand-700">
                  {product.ratingCount} ratings
                </a>
              </div>
            )}

            {displayProductPrice && (
              <>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-ink-900">{formatCatalogPrice(selected.price)}</span>
                  {selected.mrp > selected.price && (
                    <span className="text-base text-slate-400 line-through">{formatCatalogPrice(selected.mrp)}</span>
                  )}
                  {discount > 0 && <span className="text-sm font-semibold text-brand-600">{discount}% off</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500">Inclusive of all taxes</p>
              </>
            )}
            {displayStock && (
              outOfStock ? (
                <p className="mt-2 text-sm font-semibold text-rose-600">Out of stock</p>
              ) : typeof product.stock === "number" && product.stock <= 5 ? (
                <p className="mt-2 text-sm font-semibold text-amber-600">Only {product.stock} left in stock</p>
              ) : typeof product.stock === "number" ? (
                <p className="mt-2 text-sm font-semibold text-brand-600">In stock</p>
              ) : null
            )}

            <ul className="mt-4 space-y-1.5">
              {product.highlights.slice(0, 3).map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {h}
                </li>
              ))}
            </ul>

            {/* Unit / variant selector */}
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-ink-900">
                {product.category === "fashion" ? "Size" : "Variant"}: <span className="text-slate-500">{selectedUnit}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.units.map((u) => (
                  <button
                    key={u}
                    onClick={() => setSelectedUnit(u)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      selectedUnit === u
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-slate-200 text-ink-900 hover:border-brand-400"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity + actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border border-slate-200">
                <button onClick={handleDecrement} disabled={outOfStock} className="p-2.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Decrease quantity">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-semibold">{displayQty}</span>
                <button onClick={handleIncrement} disabled={outOfStock || atStockLimit} className="p-2.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Increase quantity">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {line ? (
                <span className="flex-1 rounded-lg bg-brand-50 px-6 py-3 text-center text-sm font-semibold text-brand-700 sm:flex-none">
                  Added to Cart ✓
                </span>
              ) : (
                <button
                  onClick={handleAdd}
                  disabled={outOfStock}
                  className={`flex-1 rounded-lg px-6 py-3 text-sm font-semibold text-white transition sm:flex-none ${
                    outOfStock ? "bg-slate-300" : "bg-ink-900 hover:bg-brand-700"
                  }`}
                >
                  {outOfStock ? "Unavailable" : "Add to Cart"}
                </button>
              )}
              {!outOfStock && (
                <Link
                  to="/checkout"
                  className="flex-1 rounded-lg bg-accent-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-accent-700 sm:flex-none"
                >
                  Buy Now
                </Link>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Truck className="h-4 w-4 text-brand-600" /> Delivery in 2-5 days
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <RotateCcw className="h-4 w-4 text-brand-600" /> 7-day easy returns
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <ShieldCheck className="h-4 w-4 text-brand-600" /> 100% secure payment
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl bg-brand-50 p-4">
              <Briefcase className="h-8 w-8 shrink-0 text-brand-700" />
              <div>
                <p className="text-sm font-semibold text-ink-900">Buying for your shop?</p>
                <p className="text-xs text-slate-600">
                  Apply for a Business / Party account to get wholesale pricing on this product.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-12">
          <div className="flex gap-6 border-b border-slate-200">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border-b-2 pb-3 text-sm font-semibold transition ${
                  tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-ink-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="py-6" id="reviews">
            {tab === "Description" && <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{product.description}</p>}

            {tab === "Highlights" && (
              <ul className="max-w-2xl space-y-2">
                {product.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {h}
                  </li>
                ))}
              </ul>
            )}

            {tab === "Reviews" && (
              <div className="max-w-2xl space-y-4">
                {sampleReviews.map((r) => (
                  <div key={r.name} className="rounded-xl border border-slate-100 p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink-900">{r.name}</p>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">{r.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div className="mt-10">
            <SectionHeader eyebrow="You may also like" title="Related Products" action="View all" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
