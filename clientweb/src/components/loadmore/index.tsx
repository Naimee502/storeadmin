import { useEffect, useRef } from "react";

/** Sits under a product grid; asks for the next page as it nears the screen. */
export default function LoadMore({ hasMore, loading, onMore }: { hasMore: boolean; loading: boolean; onMore: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore) return;
    // 600px head start so the next page is there before the shopper reaches the end.
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onMore();
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onMore]);
  if (!hasMore && !loading) return null;
  return (
    <div ref={ref} className="py-6 text-center text-xs text-slate-400">
      {loading ? "Loading more products…" : ""}
    </div>
  );
}
