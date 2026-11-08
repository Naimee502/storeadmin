// List-screen helpers: unsynced rows on page 1, badges and the no-network note (offline mode only).
import { useMemo, type ReactNode } from "react";
import { listOfflineDocs, queuedChangesFor } from "./docs";
import { useOfflineSnapshot } from "./billing";
import { findQueuedCreate, isOfflineId, type DocType, type OutboxStatus } from "./core";

type Change = ReturnType<typeof queuedChangesFor>[number];

const STATUS_STYLE: Record<OutboxStatus, { label: string; cls: string }> = {
  pending: { label: "Pending sync", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  failed: { label: "Failed", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  review: { label: "Needs review", cls: "bg-amber-50 text-amber-800 border-amber-200" },
};

const KIND_LABEL: Record<string, string> = {
  edit: "Edited offline",
  cancel: "Cancel pending",
  reopen: "Re-open pending",
  delete: "Delete pending",
};

export function OfflineBadge({ status, label, title }: { status: OutboxStatus; label?: string; title?: string | null }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span title={title || undefined} className={`inline-flex h-5 items-center whitespace-nowrap rounded border px-1.5 text-[11px] font-medium ${s.cls}`}>
      {label || s.label}
    </span>
  );
}

// Badge for a server row with queued changes: review or failed wins, else the latest change.
function changesBadge(changes: Change[]): ReactNode {
  const review = changes.find((c) => c.status === "review");
  const failed = changes.find((c) => c.status === "failed");
  if (review) return <OfflineBadge status="review" title={review.lastError} />;
  if (failed) return <OfflineBadge status="failed" title={failed.lastError} />;
  const last = changes[changes.length - 1];
  return <OfflineBadge status="pending" label={KIND_LABEL[last.kind] || "Pending sync"} />;
}

const withBadge = (value: ReactNode, badge: ReactNode) => (
  <span className="inline-flex items-center gap-1.5">
    {value !== "" && value !== null && value !== undefined && <span>{value}</span>}
    {badge}
  </span>
);

// Unsynced rows for page 1 and a row decorator; no-op when offline billing is off.
export function useOfflineList(type: DocType, page: number) {
  const snap = useOfflineSnapshot();
  const on = snap.enabled || snap.items.length > 0;
  // Without network the local page already holds them.
  const rows = useMemo<any[]>(() => (on && snap.online && page === 1 ? listOfflineDocs(type, snap.items) : []), [on, snap.online, page, type, snap.items]);
  // Marks the given column of a built row: offline rows get their status, server rows their queued changes.
  const decorate = (row: any, key: string): any => {
    if (!on) return row;
    const create = !row?.isOffline && isOfflineId(row?.id) ? findQueuedCreate(snap.items, row.id) : null;
    if (row?.isOffline || create) {
      const status = row?.offlineStatus ?? create?.status ?? "pending";
      return { ...row, [key]: withBadge("", <OfflineBadge status={status} title={row?.offlineError ?? create?.lastError} />) };
    }
    const changes = typeof row?.id === "string" ? queuedChangesFor(row.id, snap.items) : [];
    if (!changes.length) return row;
    return { ...row, [key]: withBadge(row[key], changesBadge(changes)) };
  };
  return { on, online: snap.online, rows, decorate };
}
