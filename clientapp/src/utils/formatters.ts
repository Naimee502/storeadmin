export const formatINR = (n: number): string =>
  `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Parse a date value coming from the API. The GraphQL layer serialises Mongo
 * Date fields as epoch-millisecond STRINGS (e.g. "1748649600000"), which
 * `new Date(str)` cannot parse → "Invalid Date". This helper handles those,
 * plus ISO strings and numbers, returning null when unparseable.
 */
export const parseServerDate = (d: string | number | null | undefined): Date | null => {
  if (d === null || d === undefined || d === '') return null;
  // Pure digits → epoch milliseconds
  if (typeof d === 'number' || /^\d+$/.test(String(d).trim())) {
    const dt = new Date(Number(d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
};

export const formatDate = (d: string | number | null | undefined): string => {
  const dt = parseServerDate(d);
  if (!dt) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateShort = (d: string | number | null | undefined): string => {
  const dt = parseServerDate(d);
  if (!dt) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export const formatRelativeDate = (d: string | number | null | undefined): string => {
  const date = parseServerDate(d);
  if (!date) return '—';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(d);
};

export const formatNumber = (n: number): string =>
  (n ?? 0).toLocaleString('en-IN');

export const formatPercent = (n: number): string =>
  `${(n ?? 0).toFixed(1)}%`;

// Returns "SO-000001" for orders, "INV-000001" for converted orders (matching admin panel)
export const formatBillNumber = (order: { billnumber?: string | null; isConverted?: boolean; invoicenumber?: string | null }): string => {
  // Converted orders show the REAL invoice number (same as the admin panel),
  // not the order's own sequence. Falls back to the order number if the invoice
  // link isn't available yet.
  const raw = (order.isConverted && order.invoicenumber) ? order.invoicenumber : (order.billnumber ?? '');
  const num = raw ? String(parseInt(raw, 10) || raw).padStart(6, '0') : '000000';
  return order.isConverted ? `INV-${num}` : `SO-${num}`;
};

/**
 * Normalises a server document code to the admin-panel "#PAY0001" style.
 * Accepts an existing code ("PAY0001", "#PAY0001") or builds one from a
 * numeric sequence + prefix.
 */
export const formatDocCode = (
  code: string | null | undefined,
  prefix: string,
  seq?: number | null,
): string => {
  if (code) return code.startsWith('#') ? code : `#${code}`;
  const n = seq != null ? String(seq).padStart(4, '0') : '0000';
  return `#${prefix}${n}`;
};

export const formatPaymentCode = (code?: string | null, seq?: number | null) =>
  formatDocCode(code, 'PAY', seq);

export const formatTxnCode = (code?: string | null, seq?: number | null) =>
  formatDocCode(code, 'TRX', seq);

/** Title-cases a short status / type token e.g. "receipt" → "Receipt". */
export const titleCase = (s?: string | null): string =>
  !s ? '' : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/**
 * Sums the debit/credit that belong specifically to one ledger within a
 * transaction's entries. A transaction's `totaldebit`/`totalcredit` are always
 * balanced (debit === credit), so they must NOT be used to derive a party's
 * ledger movement — only the entries that reference this ledger count.
 * Falls back to the transaction totals when entries are missing.
 */
export const ledgerEntryTotals = (
  tx: { entries?: any[]; totaldebit?: number; totalcredit?: number },
  ledgerId?: string | null,
): { debit: number; credit: number } => {
  const entries = tx?.entries ?? [];
  if (!ledgerId || entries.length === 0) {
    return { debit: tx?.totaldebit ?? 0, credit: tx?.totalcredit ?? 0 };
  }
  return entries.reduce(
    (acc, e) => {
      const eid = e?.ledgerid?.id ?? e?.ledgerid;
      if (String(eid) === String(ledgerId)) {
        acc.debit += e?.debit ?? 0;
        acc.credit += e?.credit ?? 0;
      }
      return acc;
    },
    { debit: 0, credit: 0 },
  );
};
