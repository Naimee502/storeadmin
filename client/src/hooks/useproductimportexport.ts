import { useCallback, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { showMessage } from "../redux/slices/message";
import {
  useProductImport,
  useProductImportMasters,
} from "../graphql/hooks/products";
import { useImageUpload } from "../graphql/hooks/uploads";
import {
  buildProductWorkbook,
  productsToSheetRows,
  type MasterLists,
} from "../utils/excel/exportproducts";
import {
  buildErrorWorkbook,
  parseProductCsv,
  parseProductWorkbook,
  type RowError,
} from "../utils/excel/importproducts";
import { buildCsvTemplate, sheetRowsToCsv } from "../utils/excel/csvadapter";
import {
  attachImageUrls,
  readImportZip,
  uploadImportImages,
  type UploadProgress,
} from "../utils/excel/importimages";
import { PRODUCT_FORM_FIELD_IDS } from "../utils/excel/productschema";
import type { ImportMode, ImportStage, ImportSummary } from "../components/importdialog";

/**
 * Ties the spreadsheet pieces to the products page.
 *
 * Kept as a hook rather than inline in the page so the same flow can be reused
 * for the other master modules later — categories, brands, units and the rest
 * all have the identical import/export stub today.
 */
export const useProductImportExport = (products: any[]) => {
  const dispatch = useAppDispatch();

  const permissions: Record<string, boolean | undefined> = useAppSelector(
    (state) => state.permissions.permissions?.formPermissions?.products || {}
  );

  const { loadMasters, masters, adminid, branchid } = useProductImportMasters();
  const { runImport } = useProductImport();
  const { uploadImageMutation } = useImageUpload();

  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<ImportStage>("idle");
  const [errors, setErrors] = useState<RowError[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [mode, setMode] = useState<ImportMode>("CREATE");
  const [abortOnError, setAbortOnError] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [busyMessage, setBusyMessage] = useState("");

  // Held so "download the file with errors marked" can re-open the exact
  // workbook the user gave us, rather than a reconstruction of it.
  const uploadedFile = useRef<File | null>(null);
  const parsedRef = useRef<{ products: any[]; refs: string[] } | null>(null);

  const disabledFields = PRODUCT_FORM_FIELD_IDS.filter((id) => permissions[id] === false);

  /** Masters are needed by every path here, so fetch once and reuse. */
  const ensureMasters = useCallback(async (): Promise<Partial<MasterLists> | null> => {
    if (masters) return masters;
    const result = await loadMasters();
    const fresh = result.data?.getProductImportMasters;
    if (!fresh) {
      dispatch(showMessage({ message: "Could not load your category and unit lists.", type: "error" }));
      return null;
    }
    return {
      categories: fresh.categories ?? [],
      subcategories: fresh.subcategories ?? [],
      brands: fresh.brands ?? [],
      models: fresh.models ?? [],
      sizes: fresh.sizes ?? [],
      groups: fresh.groups ?? [],
      units: fresh.units ?? [],
      ledgers: fresh.ledgers ?? [],
    };
  }, [masters, loadMasters, dispatch]);

  const metaFor = useCallback(
    (resolvedAdminId: string) => ({
      adminid: resolvedAdminId,
      branchid: branchid ?? null,
      disabledFields,
    }),
    [branchid, disabledFields]
  );

  /* ---------------- downloads ---------------- */

  const downloadTemplate = useCallback(
    async (format: "xlsx" | "csv") => {
      if (format === "csv") {
        const csv = buildCsvTemplate(permissions);
        saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), "product_import_template.csv");
        return;
      }

      setBusyMessage("Building your template…");
      const loaded = await ensureMasters();
      setBusyMessage("");
      if (!loaded) return;

      const { blob } = await buildProductWorkbook({
        permissions,
        masters: loaded,
        meta: metaFor(adminid ?? ""),
      });
      saveAs(blob, "product_import_template.xlsx");
    },
    [permissions, ensureMasters, metaFor, adminid]
  );

  const downloadCurrent = useCallback(
    async (format: "xlsx" | "csv") => {
      const rows = productsToSheetRows(products);

      if (format === "csv") {
        const csv = sheetRowsToCsv(rows, permissions);
        saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), "products.csv");
        return;
      }

      setBusyMessage("Building your export…");
      const loaded = await ensureMasters();
      setBusyMessage("");
      if (!loaded) return;

      const { blob } = await buildProductWorkbook({
        permissions,
        masters: loaded,
        meta: metaFor(adminid ?? ""),
        data: rows,
      });
      saveAs(blob, "products.xlsx");
    },
    [products, permissions, ensureMasters, metaFor, adminid]
  );

  /* ---------------- upload + dry run ---------------- */

  const handleFile = useCallback(
    async (file: File) => {
      setStage("reading");
      setErrors([]);
      setWarnings([]);
      setSummary(null);
      setUploadProgress(null);

      try {
        const loaded = await ensureMasters();
        if (!loaded) {
          setStage("idle");
          return;
        }

        let sheetFile = file;
        let zipImages: Map<string, File> | null = null;
        const collectedWarnings: string[] = [];

        if (/\.zip$/i.test(file.name)) {
          setBusyMessage("Opening the archive…");
          const zip = await readImportZip(file);
          sheetFile = zip.sheetFile;
          zipImages = zip.images;
          collectedWarnings.push(...zip.warnings);
        }

        const isCsv = /\.csv$/i.test(sheetFile.name);
        if (isCsv) {
          collectedWarnings.push(
            "CSV has no dropdowns, so categories, brands and units were matched by name."
          );
        }

        uploadedFile.current = sheetFile;

        setBusyMessage("Reading your file…");
        const parsed = isCsv
          ? await parseProductCsv({
              text: await sheetFile.text(),
              permissions,
              masters: loaded,
              adminid: adminid ?? "",
              branchid,
            })
          : await parseProductWorkbook({
              file: sheetFile,
              permissions,
              masters: loaded,
              adminid: adminid ?? "",
              branchid,
            });

        collectedWarnings.push(...parsed.warnings);

        // Images from the zip, uploaded once each and attached by ProductRef.
        if (zipImages && parsed.imageFiles.size) {
          setBusyMessage("Uploading images…");
          const { urls, missing } = await uploadImportImages(
            parsed.imageFiles,
            zipImages,
            async (imageFile) => {
              const { data } = await uploadImageMutation({ variables: { file: imageFile } });
              return data?.uploadImage?.url ?? "";
            },
            setUploadProgress
          );
          attachImageUrls(parsed.products, parsed.refs, parsed.imageFiles, urls);
          if (missing.length) {
            collectedWarnings.push(
              `${missing.length} image${missing.length > 1 ? "s were" : " was"} named in the sheet but not found in the zip: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`
            );
          }
        } else if (!zipImages && parsed.imageFiles.size) {
          collectedWarnings.push(
            "The Image Files column has entries, but no images were uploaded. Zip the sheet together with an images folder to include them."
          );
        }

        setUploadProgress(null);
        parsedRef.current = { products: parsed.products, refs: parsed.refs };

        // The server does the counting. Client validation is for a fast, clear
        // report — it is not the gate, and its numbers are not authoritative.
        setBusyMessage("Checking against your data…");
        const dry = await runImport({
          products: parsed.products,
          refs: parsed.refs,
          mode,
          dryRun: true,
        });

        const serverErrors: RowError[] = (dry?.errors ?? []).map((e: any) => ({
          sheet: (e.sheet as any) ?? "Products",
          row: e.row ?? null,
          column: e.field ?? null,
          value: "",
          ref: e.ref ?? undefined,
          message: e.message,
        }));

        // Client errors first — they carry the exact cell coordinates.
        const seen = new Set(parsed.errors.map((e) => `${e.ref}|${e.message}`));
        const merged = [
          ...parsed.errors,
          ...serverErrors.filter((e) => !seen.has(`${e.ref}|${e.message}`)),
        ];

        setErrors(merged);
        setWarnings(collectedWarnings);
        setSummary({
          total: dry?.total ?? parsed.products.length,
          created: dry?.created ?? 0,
          updated: dry?.updated ?? 0,
          skipped: dry?.skipped ?? 0,
        });
        setStage("review");
      } catch (err: any) {
        dispatch(
          showMessage({
            message: err?.message || "That file could not be read.",
            type: "error",
          })
        );
        setStage("idle");
      } finally {
        setBusyMessage("");
      }
    },
    [ensureMasters, permissions, adminid, branchid, mode, runImport, uploadImageMutation, dispatch]
  );

  /* ---------------- commit ---------------- */

  const confirmImport = useCallback(
    async (onFinished?: () => void) => {
      if (!parsedRef.current) return;
      setStage("importing");
      setBusyMessage("Importing…");

      try {
        const result = await runImport({
          products: parsedRef.current.products,
          refs: parsedRef.current.refs,
          mode,
          dryRun: false,
          abortOnError,
        });

        setSummary({
          total: result?.total ?? 0,
          created: result?.created ?? 0,
          updated: result?.updated ?? 0,
          skipped: result?.skipped ?? 0,
        });
        setErrors(
          (result?.errors ?? []).map((e: any) => ({
            sheet: (e.sheet as any) ?? "Products",
            row: e.row ?? null,
            column: e.field ?? null,
            value: "",
            ref: e.ref ?? undefined,
            message: e.message,
          }))
        );
        setStage("done");

        const added = (result?.created ?? 0) + (result?.updated ?? 0);
        dispatch(
          showMessage({
            message: added ? `Imported ${added} products.` : "Nothing was imported.",
            type: added ? "success" : "error",
          })
        );
        onFinished?.();
      } catch (err: any) {
        dispatch(
          showMessage({ message: err?.message || "The import failed.", type: "error" })
        );
        setStage("review");
      } finally {
        setBusyMessage("");
      }
    },
    [mode, abortOnError, runImport, dispatch]
  );

  const downloadErrorFile = useCallback(async () => {
    if (!uploadedFile.current) return;
    if (/\.csv$/i.test(uploadedFile.current.name)) {
      // CSV has no cells to colour, so the report is a plain list.
      const lines = [
        "Sheet,Row,Column,Value,Problem",
        ...errors.map((e) =>
          [e.sheet, e.row ?? "", e.column ?? "", e.value, e.message]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        ),
      ].join("\n");
      saveAs(new Blob([lines], { type: "text/csv;charset=utf-8" }), "import_errors.csv");
      return;
    }
    const blob = await buildErrorWorkbook(uploadedFile.current, errors);
    saveAs(blob, "import_errors.xlsx");
  }, [errors]);

  const reset = useCallback(() => {
    setStage("idle");
    setErrors([]);
    setWarnings([]);
    setSummary(null);
    setUploadProgress(null);
    uploadedFile.current = null;
    parsedRef.current = null;
  }, []);

  const open = useCallback(() => {
    reset();
    setIsOpen(true);
  }, [reset]);

  const close = useCallback(() => {
    setIsOpen(false);
    reset();
  }, [reset]);

  return {
    isOpen,
    open,
    close,
    stage,
    errors,
    warnings,
    summary,
    uploadProgress,
    busyMessage,
    mode,
    setMode,
    abortOnError,
    setAbortOnError,
    downloadTemplate,
    downloadCurrent,
    handleFile,
    downloadErrorFile,
    confirmImport,
    reset,
  };
};
