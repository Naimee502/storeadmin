import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaSave, FaTimes } from "react-icons/fa";
import { FormDensityContext } from "./density";
import { OVERLAY_SELECTOR, isOverlayOpen } from "./overlay";
import { useEscape } from "./useescape";

/** Desktop form shell: sticky Save/Cancel bar; Enter next field, Ctrl/⌘+S save, Esc cancel. */

const FOCUSABLE =
  'input:not([type="hidden"]):not([type="file"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

interface FormPageProps {
  title: string;
  /** Small text above the title, e.g. the list this form belongs to. */
  breadcrumb?: string;
  onSave: () => void | Promise<unknown>;
  onCancel: () => void;
  saveLabel?: string;
  /** Grey out Save (e.g. while saving, or a cancelled bill that can't change). */
  saveDisabled?: boolean;
  /** No Save at all — a read-only view. Ctrl/⌘+S and Enter-on-last-field do nothing. */
  hideSave?: boolean;
  /** Tooltip on Save — e.g. why it is disabled ("Still needed: Party, Date"). */
  saveTitle?: string;
  /** Text of the Cancel button, e.g. "Back" on a read-only (cancelled) bill. */
  cancelLabel?: string;
  /** Extra controls shown in the bar, left of Cancel. */
  actions?: React.ReactNode;
  /** Focus the first field when the form opens. Default true. */
  autoFocus?: boolean;
  children: React.ReactNode;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="ml-1.5 rounded border border-current px-1 text-[10px] font-medium leading-4 opacity-70">
    {children}
  </kbd>
);

const FormPage: React.FC<FormPageProps> = ({
  title,
  breadcrumb,
  onSave,
  onCancel,
  saveLabel = "Save",
  saveDisabled = false,
  hideSave = false,
  saveTitle,
  cancelLabel = "Cancel",
  actions,
  autoFocus = true,
  children,
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // One save at a time — a held Ctrl+S or a double click must not create two records.
  const save = useCallback(async () => {
    if (savingRef.current || saveDisabled || hideSave) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [onSave, saveDisabled, hideSave]);

  // Esc = Cancel (shared rule, see ./useescape).
  useEscape(onCancel);

  // Ctrl/⌘+S works wherever focus is on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); // stop the browser's "Save page"
        if (!isOverlayOpen()) save(); // a popup is open — it owns the keyboard
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  useEffect(() => {
    if (!autoFocus) return;
    const first = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, [autoFocus]);

  // Enter → next field; Enter on the last field → Save.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.defaultPrevented || (e.nativeEvent as any).isComposing) return;
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (tag !== "INPUT" && tag !== "SELECT") return; // textarea / buttons keep native Enter
    if (target.closest(OVERLAY_SELECTOR)) return; // fields inside a popup belong to the popup
    const fields = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (el) => el.offsetParent !== null && !el.closest(OVERLAY_SELECTOR) // visible, not in a popup
    );
    const idx = fields.indexOf(target);
    if (idx === -1) return;
    e.preventDefault();
    const next = fields[idx + 1];
    if (next) {
      next.focus();
      if (next instanceof HTMLInputElement && ["text", "email", "tel", "number", "password", "search", "url"].includes(next.type)) {
        next.select();
      }
    } else {
      save();
    }
  };

  return (
    <FormDensityContext.Provider value="compact">
      {/* One screen tall below the header; only the fields scroll. */}
      <div className="flex h-[calc(100vh-48px)] flex-col bg-slate-50">
        <div className="z-30 flex shrink-0 items-center gap-2 px-4 pt-4 pb-3">
          <button
            type="button"
            onClick={onCancel}
            title="Back (Esc)"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <FaArrowLeft className="text-sm" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            {breadcrumb && (
              <>
                <span className="hidden text-base font-medium text-slate-600 sm:inline">{breadcrumb}</span>
                <span className="hidden text-base text-slate-400 sm:inline">/</span>
              </>
            )}
            <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <FaTimes className="text-xs" /> {cancelLabel} <Kbd>Esc</Kbd>
            </button>
            {!hideSave && (
            <button
              type="button"
              onClick={save}
              disabled={saving || saveDisabled}
              title={saveTitle}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaSave className="text-xs" /> {saving ? "Saving…" : saveLabel} <Kbd>{MOD}+S</Kbd>
            </button>
            )}
          </div>
        </div>

        <div ref={bodyRef} onKeyDown={onKeyDown} className="formpage-body min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {children}
        </div>
      </div>
    </FormDensityContext.Provider>
  );
};

/** A titled block of fields laid out on a responsive grid. */
export const FormSection: React.FC<{
  title?: string;
  /** Columns on a wide screen (default 3). */
  cols?: 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
}> = ({ title, cols = 3, className = "", children }) => {
  const grid =
    cols === 4
      ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      : cols === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {title && (
        <h2 className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h2>
      )}
      <div className={`grid grid-cols-1 gap-x-3 gap-y-2 p-3 ${grid}`}>{children}</div>
    </section>
  );
};

/** Wrap a field so it spans more than one grid column. */
export const Span: React.FC<{ cols?: 2 | 3 | 4 | "full"; children: React.ReactNode }> = ({ cols = 2, children }) => {
  const span =
    cols === "full" ? "sm:col-span-full" : cols === 4 ? "sm:col-span-2 lg:col-span-3 xl:col-span-4" : cols === 3 ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-2";
  return <div className={span}>{children}</div>;
};

export default FormPage;
