import { useEffect, useState } from "react";
import type { ServerPaging } from "../components/datatable";

/** useState kept in sessionStorage, so it survives a trip to edit and back. */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export type ColumnFilter = { key: string; value: string };

const toServerFilters = (filters: Record<string, string>): ColumnFilter[] =>
  Object.entries(filters)
    .filter(([, value]) => String(value || "").trim())
    .map(([key, value]) => ({ key, value: String(value).trim() }));

/** Server-paged DataTable state, remembered per tab; search/filters debounced 300ms. */
export function useServerTable(key: string, filterKeys?: string[], defaultPageSize = 10) {
  const [page, setPage] = useSessionState(`${key}:page`, 1);
  const [pageSize, setPageSize] = useSessionState(`${key}:pageSize`, defaultPageSize);
  const [searchInput, setSearchInput] = useSessionState(`${key}:search`, "");
  const [filters, setFilters] = useSessionState<Record<string, string>>(`${key}:filters`, {});
  const [applied, setApplied] = useState(() => ({
    search: searchInput.trim(),
    columnFilters: toServerFilters(filters),
  }));

  useEffect(() => {
    const timer = setTimeout(
      () => setApplied({ search: searchInput.trim(), columnFilters: toServerFilters(filters) }),
      300
    );
    return () => clearTimeout(timer);
  }, [searchInput, filters]);

  const onChange: ServerPaging["onChange"] = (next) => {
    if (next.filters !== undefined) {
      setFilters(next.filters);
      setPage(1);
      return;
    }
    if (next.search !== undefined) {
      setSearchInput(next.search);
      setPage(1);
      return;
    }
    if (next.pageSize !== undefined) {
      setPageSize(next.pageSize);
      setPage(1);
    }
    if (next.page !== undefined) setPage(next.page);
  };

  return {
    page,
    pageSize,
    /** Row number offset for "Seq Number" columns. */
    offset: (page - 1) * pageSize,
    setPage,
    /** Variables for the module's page query. */
    variables: { page, pageSize, search: applied.search, columnFilters: applied.columnFilters },
    /** Base serverPaging prop; useServerPaging adds the total. */
    paging: { page, pageSize, search: searchInput, filters, filterKeys, onChange },
  };
}

/** serverPaging prop for DataTable, with a guard against pages past the end. */
export function useServerPaging(
  table: ReturnType<typeof useServerTable>,
  total: number,
  loading: boolean
): ServerPaging {
  const { page, pageSize, setPage } = table;
  // A deleted row or a remembered page can point past the end: go to the last real page.
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    if (!loading && page > lastPage) setPage(lastPage);
  }, [total, loading, page, pageSize, setPage]);
  return { ...table.paging, total };
}
