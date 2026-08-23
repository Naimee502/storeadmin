import React, { useMemo, useRef, useState } from "react";
import { Dialog } from "@headlessui/react";
import Button from "../button";
import type { RowError } from "../../utils/excel/importproducts";
import { CSV_LIMITATIONS } from "../../utils/excel/csvadapter";

/**
 * The import screen.
 *
 * Deliberately not a raw file picker. Three things have to happen before
 * anyone uploads anything: they need the template (with the dropdowns), they
 * need to know xlsx and csv are not equivalent, and after upload they need to
 * see what is about to happen before it happens. Nothing is written until the
 * server's dry run comes back and the user approves the counts.
 */

export type ImportStage = "idle" | "reading" | "review" | "importing" | "done";
export type ImportMode = "CREATE" | "UPSERT";

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
}

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;

  stage: ImportStage;
  errors: RowError[];
  warnings: string[];
  summary: ImportSummary | null;
  /** Set while images from a .zip are uploading. */
  uploadProgress?: { done: number; total: number; currentName: string } | null;

  mode: ImportMode;
  onModeChange: (mode: ImportMode) => void;
  abortOnError: boolean;
  onAbortOnErrorChange: (value: boolean) => void;

  onDownloadTemplate: (format: "xlsx" | "csv") => void;
  onDownloadCurrent: (format: "xlsx" | "csv") => void;
  onFileSelected: (file: File) => void;
  onDownloadErrorFile: () => void;
  onConfirm: () => void;
  onReset: () => void;

  busyMessage?: string;
}

const Chip: React.FC<{ tone: "ok" | "warn" | "bad"; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const tones = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    bad: "bg-rose-50 text-rose-700 border-rose-200",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
};

const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  stage,
  errors,
  warnings,
  summary,
  uploadProgress,
  mode,
  onModeChange,
  abortOnError,
  onAbortOnErrorChange,
  onDownloadTemplate,
  onDownloadCurrent,
  onFileSelected,
  onDownloadErrorFile,
  onConfirm,
  onReset,
  busyMessage,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [errorFilter, setErrorFilter] = useState("");

  const filteredErrors = useMemo(() => {
    if (!errorFilter.trim()) return errors;
    const needle = errorFilter.trim().toLowerCase();
    return errors.filter((e) =>
      [e.sheet, e.column, e.value, e.message, e.ref]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    );
  }, [errors, errorFilter]);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  const busy = stage === "reading" || stage === "importing";

  return (
    <Dialog open={isOpen} onClose={busy ? () => {} : onClose} className="fixed z-50 inset-0">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <Dialog.Panel className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[calc(100vh-3rem)]">
          {/* header */}
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200 shrink-0">
            <div>
              <Dialog.Title className="text-lg font-bold text-gray-900">
                Import Products
              </Dialog.Title>
              <p className="text-sm text-gray-500 mt-0.5">
                Download the template, fill it in, and upload it back. Nothing is saved until you approve the summary.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2 disabled:opacity-40 cursor-pointer"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1 min-h-0">
            {/* ---------------- step 1: get a file ---------------- */}
            {(stage === "idle" || stage === "reading") && (
              <>
                <section>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">1 · Start from a template</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    The Excel template carries dropdown lists for every category, brand, unit and
                    account you have, so the right record is always picked.
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                      {(["xlsx", "csv"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFormat(f)}
                          className={`px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                            format === f
                              ? "bg-gray-900 text-white"
                              : "bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {f === "xlsx" ? "Excel (.xlsx)" : "CSV"}
                        </button>
                      ))}
                    </div>

                    <Button type="button" variant="outline" onClick={() => onDownloadTemplate(format)}>
                      Download blank template
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onDownloadCurrent(format)}>
                      Download current products
                    </Button>
                  </div>

                  {format === "csv" && (
                    <div className="mt-3 border-l-2 border-amber-400 bg-amber-50 px-3 py-2 rounded-r">
                      <p className="text-xs font-bold text-amber-800 mb-1">
                        CSV works, but it gives up a few things:
                      </p>
                      <ul className="text-xs text-amber-800 list-disc pl-4 space-y-0.5">
                        {CSV_LIMITATIONS.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">2 · Choose what happens to existing products</h3>
                  <div className="flex flex-col gap-2 mt-2">
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={mode === "CREATE"}
                        onChange={() => onModeChange("CREATE")}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-semibold text-gray-800">Add new products only</span>
                        <span className="block text-xs text-gray-500">
                          A row whose product code already exists is reported and skipped. Nothing existing is touched.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={mode === "UPSERT"}
                        onChange={() => onModeChange("UPSERT")}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-semibold text-gray-800">Add new and update existing</span>
                        <span className="block text-xs text-gray-500">
                          Matches on product code and overwrites that product, pricing included. Use this for the
                          export → edit → re-import loop.
                        </span>
                      </span>
                    </label>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">3 · Upload the filled-in file</h3>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-colors ${
                      dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-700">
                      Drop your file here, or click to choose
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      .xlsx or .csv — or a .zip holding the file plus an images folder
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.csv,.zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onFileSelected(file);
                      e.target.value = "";
                    }}
                  />
                </section>

                {stage === "reading" && (
                  <div className="text-sm text-gray-600">
                    {busyMessage || "Reading your file…"}
                    {uploadProgress && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Uploading images — {uploadProgress.currentName}</span>
                          <span>
                            {uploadProgress.done} / {uploadProgress.total}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all"
                            style={{
                              width: `${Math.round((uploadProgress.done / Math.max(uploadProgress.total, 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ---------------- review ---------------- */}
            {(stage === "review" || stage === "importing" || stage === "done") && summary && (
              <section>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Chip tone="ok">
                    {summary.created} to add
                  </Chip>
                  {summary.updated > 0 && <Chip tone="ok">{summary.updated} to update</Chip>}
                  {summary.skipped > 0 && <Chip tone="bad">{summary.skipped} with problems</Chip>}
                  <span className="text-xs text-gray-500">{summary.total} products read</span>
                </div>

                {warnings.length > 0 && (
                  <div className="mb-4 border-l-2 border-amber-400 bg-amber-50 px-3 py-2 rounded-r">
                    {warnings.map((warning, i) => (
                      <p key={i} className="text-xs text-amber-800">
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                {errors.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-gray-900">
                        {errors.length} problem{errors.length > 1 ? "s" : ""} to fix
                      </h3>
                      <div className="flex items-center gap-2">
                        <input
                          value={errorFilter}
                          onChange={(e) => setErrorFilter(e.target.value)}
                          placeholder="Filter…"
                          className="border border-gray-300 rounded px-2 py-1 text-xs w-40"
                        />
                        <button
                          type="button"
                          onClick={onDownloadErrorFile}
                          className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          Download file with errors marked
                        </button>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded overflow-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">Sheet</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">Row</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">Column</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">Value</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">Problem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredErrors.map((error, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{error.sheet}</td>
                              <td className="px-3 py-1.5 text-gray-700 tabular-nums">{error.row ?? "—"}</td>
                              <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{error.column ?? "—"}</td>
                              <td className="px-3 py-1.5 text-gray-500 max-w-[140px] truncate" title={error.value}>
                                {error.value || "—"}
                              </td>
                              <td className="px-3 py-1.5 text-rose-700">{error.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {stage === "review" && (
                      <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={abortOnError}
                          onChange={(e) => onAbortOnErrorChange(e.target.checked)}
                        />
                        <span className="text-gray-700">
                          Import nothing unless every row is valid
                        </span>
                      </label>
                    )}
                  </>
                )}

                {stage === "done" && (
                  <div className="mt-4 border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 rounded-r">
                    <p className="text-sm font-semibold text-emerald-800">
                      Added {summary.created}
                      {summary.updated > 0 ? `, updated ${summary.updated}` : ""}.
                      {summary.skipped > 0 ? ` ${summary.skipped} skipped.` : ""}
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg shrink-0">
            <span className="text-xs text-gray-500">
              {busy ? busyMessage || "Working…" : ""}
            </span>
            <div className="flex items-center gap-2">
              {stage === "review" && (
                <>
                  <Button type="button" variant="outline" onClick={onReset}>
                    Choose a different file
                  </Button>
                  <Button
                    type="button"
                    onClick={onConfirm}
                    disabled={abortOnError && errors.length > 0}
                  >
                    {abortOnError && errors.length > 0
                      ? "Fix the problems first"
                      : `Import ${summary ? summary.created + summary.updated : 0} products`}
                  </Button>
                </>
              )}
              {(stage === "idle" || stage === "done") && (
                <Button type="button" variant={stage === "done" ? "primary" : "outline"} onClick={onClose}>
                  {stage === "done" ? "Done" : "Cancel"}
                </Button>
              )}
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default ImportDialog;
