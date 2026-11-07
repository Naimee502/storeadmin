// Shared helpers for server-side paged lists (search + column filters).

export type ColumnFilter = { key: string; value: string };

export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive "contains" regex for a user-typed term. */
export const containsRx = (term: string) => new RegExp(escapeRegex(term), "i");

/** Field (any type) as text, "" when missing. */
export const asText = (field: string) => ({ $ifNull: [{ $toString: field }, ""] });

/** Match the text an aggregation expression produces, like a "contains" search. */
export const textMatch = (input: any, term: string) => ({
  $expr: { $regexMatch: { input, regex: escapeRegex(term), options: "i" } },
});

/** DD-MM-YYYY from a text date stored as YYYY-MM-DD… */
export const dmyFromText = (field: string) => {
  const d = asText(field);
  return { $concat: [{ $substrCP: [d, 8, 2] }, "-", { $substrCP: [d, 5, 2] }, "-", { $substrCP: [d, 0, 4] }] };
};

/** DD-MM-YYYY from a Date field, in India time (matches what the browser shows). */
export const dmyFromDate = (field: string) => ({
  $ifNull: [{ $dateToString: { format: "%d-%m-%Y", date: field, timezone: "+05:30" } }, ""],
});

/** Clamp page/pageSize and return skip/limit. */
export const pageWindow = (page?: number, pageSize?: number) => {
  const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * limit;
  return { skip, limit };
};

/** Non-empty, trimmed column filters only. */
export const activeFilters = (filters?: ColumnFilter[] | null): ColumnFilter[] =>
  (filters || [])
    .map((f) => ({ key: String(f?.key || ""), value: String(f?.value ?? "").trim() }))
    .filter((f) => f.key && f.value);

/** Entries hidden with "Clear" never show again in deleted lists or reports. */
export const notCleared = { cleared: { $ne: true } };
