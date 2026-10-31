import { ProductService } from "../../models/products";
import { Category } from "../../models/categories";

/**
 * Arrange bill lines category-wise, then product name A-Z — so a party that
 * adds a Rider, a Walker and another Rider in any order still gets a bill
 * with all Riders together.
 *
 * Category order = the admin's Categories -> Rearrange order (sortorder).
 * Lines whose product has no category go last. Equal keys keep the order
 * they came in (stable sort).
 *
 * Runs once at save time (two small indexed lookups), so listing, printing
 * and editing read the lines already sorted with no extra work.
 * Best-effort: on any lookup error the lines are returned unchanged.
 */
export async function sortLinesByCategory<T extends { productserviceid?: any }>(lines: T[] | undefined | null): Promise<T[] | undefined | null> {
  if (!Array.isArray(lines) || lines.length < 2) return lines;
  try {
    const ids = [...new Set(lines.map((l) => String(l?.productserviceid ?? "")).filter(Boolean))];
    if (!ids.length) return lines;

    const products: any[] = await ProductService.find({ _id: { $in: ids } }).select("name categoryid").lean();
    const productById = new Map(products.map((p) => [String(p._id), p]));

    const catIds = [...new Set(products.map((p) => (p.categoryid ? String(p.categoryid) : "")).filter(Boolean))];
    const categories: any[] = catIds.length
      ? await Category.find({ _id: { $in: catIds } }).select("categoryname sortorder").lean()
      : [];
    const catById = new Map(categories.map((c) => [String(c._id), c]));

    const cmpText = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

    const keyed = lines.map((line, idx) => {
      const p = productById.get(String(line?.productserviceid ?? ""));
      const c = p?.categoryid ? catById.get(String(p.categoryid)) : undefined;
      return {
        line,
        idx,
        hasCat: c ? 0 : 1,
        catOrder: typeof c?.sortorder === "number" ? c.sortorder : Number.MAX_SAFE_INTEGER,
        catName: String(c?.categoryname ?? ""),
        name: String(p?.name ?? ""),
      };
    });

    keyed.sort(
      (a, b) =>
        a.hasCat - b.hasCat ||
        a.catOrder - b.catOrder ||
        cmpText(a.catName, b.catName) ||
        cmpText(a.name, b.name) ||
        a.idx - b.idx
    );
    return keyed.map((k) => k.line);
  } catch (e) {
    console.error("sortLinesByCategory failed — keeping original line order:", e);
    return lines;
  }
}
