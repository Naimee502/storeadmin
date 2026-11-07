// List-cell text helpers shared by the transactions, payments, expense note,
// stock adjustment and transfer stock page queries.
import { activeFilters, dmyFromDate, type ColumnFilter } from "../../../utils/listquery";

/** Text of an expression, or `fallback` when it is missing or empty (like `x || "-"`). */
export const textOr = (input: any, fallback: string) => ({
  $let: {
    vars: { v: { $ifNull: [{ $toString: input }, ""] } },
    in: { $cond: [{ $gt: [{ $strLenCP: "$$v" }, 0] }, "$$v", fallback] },
  },
});

/** Number as a double; missing or not a number counts as 0. */
export const num = (input: any) => ({ $convert: { input, to: "double", onError: 0, onNull: 0 } });

/** Number as JS toFixed(2) text, e.g. 1500 -> "1500.00"; missing counts as 0. */
export const fixed2 = (input: any) => ({
  $let: {
    vars: { c: { $toLong: { $round: [{ $multiply: [num(input), 100] }, 0] } } },
    in: {
      $let: {
        vars: { a: { $abs: "$$c" } },
        in: {
          $concat: [
            { $cond: [{ $lt: ["$$c", 0] }, "-", ""] },
            { $toString: { $toLong: { $trunc: [{ $divide: ["$$a", 100] }, 0] } } },
            ".",
            { $cond: [{ $lt: [{ $mod: ["$$a", 100] }, 10] }, "0", ""] },
            { $toString: { $mod: ["$$a", 100] } },
          ],
        },
      },
    },
  },
});

/** DD-MM-YYYY of a Date field in India time, "-" when it is not a date. */
export const dmyOrDash = (field: string) => ({
  $cond: [{ $eq: [{ $type: field }, "date"] }, dmyFromDate(field), "-"],
});

/** "Active" / "Inactive" from a boolean status field. */
export const activeText = (field = "$status") => ({ $cond: [field, "Active", "Inactive"] });

/**
 * Search (any of `keys`) and column filters (each its own key) as Mongo clauses.
 * `clauseFor` returns the clause matching one column's shown text, or null.
 */
export async function searchAndFilterClauses(
  search: string | null | undefined,
  columnFilters: ColumnFilter[] | null | undefined,
  keys: string[],
  clauseFor: (key: string, term: string) => Promise<any | null>
): Promise<any[]> {
  const clauses: any[] = [];
  const term = String(search || "").trim();
  if (term) {
    const or = (await Promise.all(keys.map((k) => clauseFor(k, term)))).filter(Boolean);
    clauses.push(or.length ? { $or: or } : { _id: null });
  }
  for (const f of activeFilters(columnFilters)) {
    if (!keys.includes(f.key)) continue;
    const c = await clauseFor(f.key, f.value);
    if (c) clauses.push(c);
  }
  return clauses;
}
