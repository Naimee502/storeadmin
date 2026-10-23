import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shows the confirm button as busy and blocks closing while true. */
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Confirmation modal for destructive actions (e.g. deleting an order).
 * Nothing happens until the user presses the confirm button; Esc, the
 * backdrop and Cancel all just close it.
 */
export default function ConfirmDialog({
  open, title, message, confirmLabel = "Delete", cancelLabel = "Cancel", loading = false, onConfirm, onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !loading) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      onClick={() => { if (!loading) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>
        <h3 id="confirm-dialog-title" className="mt-4 text-center text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-center text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            autoFocus
            className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
