export const formatINR = (n: number): string =>
  `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDate = (d: string): string => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateShort = (d: string): string => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export const formatRelativeDate = (d: string): string => {
  if (!d) return '';
  const now = new Date();
  const date = new Date(d);
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
