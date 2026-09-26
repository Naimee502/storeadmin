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
  collectPickedImages,
  readImportZip,
  uploadImportImages,
  type UploadProgress,
} from "../utils/excel/importimages";
import { PRODUCT_FORM_FIELD_IDS, headerForField, type SheetId } from "../utils/excel/productschema";
import type { ImportMode, ImportStage, ImportSummary } from "../components/importdialog";

/**
 * "2 new Categories will be created: Oils, Soaps" — one line per master type,
 * from the server's list, so the user sees exactly what the import will add.
 */
const newMasterLines = (
  items: { label: string; name: string }[] | null | undefined,
  done = false
): string[] => {
  const byLabel = new Map<string, string[]>();
  for (const item of items ?? []) {
    const bucket = byLabel.get(item.label) ?? [];
    bucket.push(item.name);
    byLabel.set(item.label, bucket);
  }
  return Array.from(byLabel, ([label, names]) => {
    const plural = label.endsWith("y") ? `${label.slice(0, -1)}ies` : `${label}s`;
    const noun = `new ${names.length > 1 ? plural : label}`;
    const shown = names.slice(0, 10).join(", ") + (names.length > 10 ? "…" : "");
    return done
      ? `Created ${names.length} ${noun}: ${shown}`
      : `${names.length} ${noun} will be created: ${shown}`;
  });
};

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
  // One mode only: add new products and update existing ones (matched on
  // Product Code). A separate "add only" choice was easy to pick by mistake
  // with an exported file, and then every existing row was skipped.
  const [mode, setMode] = useState<ImportMode>("UPSERT");
  const [abortOnError, setAbortOnError] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [busyMessage, setBusyMessage] = useState("");
  // Images picked with "Select Images" (files or a folder). Matched by file
  // name against the Product Image / Category Image / Sub Category Image cells.
  const [pickedImages, setPickedImages] = useState<Map<string, File>>(new Map());
  const pickedWarnings = useRef<string[]>([]);
  // The file exactly as the user chose it (sheet or zip), so picking images
  // after the upload can re-run the check without asking for it again.
  const originalFile = useRef<File | null>(null);

  // Held so "download the file with errors marked" can re-open the exact
  // workbook the user gave us, rather than a reconstruction of it.
  const uploadedFile = useRef<File | null>(null);
  const parsedRef = useRef<{
    products: any[];
    refs: string[];
    masterNames: Record<string, any>[];
  } | null>(null);

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

        originalFile.current = file;
        let sheetFile = file;
        let zipImages: Map<string, File> | null = null;
        const collectedWarnings: string[] = [...pickedWarnings.current];

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

        // Product images plus Category / Sub Category images, all uploaded in
        // one pass so a shared file is only sent once.
        const referencedImages = new Map<string, string[]>([
          ...parsed.imageFiles,
          ...parsed.masterImageFiles,
        ]);

        // Pictures inside the Excel cells, picked images and zip images
        // together. In-cell pictures have generated names, so they never clash.
        const availableImages = new Map<string, File>([
          ...pickedImages,
          ...(zipImages ?? []),
          ...parsed.embeddedImages,
        ]);

        // Images uploaded once each and attached by ProductRef.
        if (availableImages.size && referencedImages.size) {
          setBusyMessage("Uploading images…");
          const { urls, missing } = await uploadImportImages(
            referencedImages,
            availableImages,
            async (imageFile) => {
              const { data } = await uploadImageMutation({ variables: { file: imageFile } });
              return data?.uploadImage?.url ?? "";
            },
            setUploadProgress
          );
          attachImageUrls(parsed.products, parsed.refs, parsed.imageFiles, urls);
          for (const [key, [fileName]] of parsed.masterImageFiles) {
            const [index, field] = key.split(":");
            const url = urls.get(String(fileName).trim().toLowerCase());
            if (url && parsed.masterNames[Number(index)]) {
              parsed.masterNames[Number(index)][field] = url;
            }
          }
          if (missing.length) {
            collectedWarnings.push(
              `${missing.length} image${missing.length > 1 ? "s were" : " was"} named in the sheet but not found: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}. Put the picture${missing.length > 1 ? "s" : ""} into the cell${missing.length > 1 ? "s" : ""} instead (Excel: Insert → Pictures).`
            );
          }
        } else if (referencedImages.size) {
          collectedWarnings.push(
            "Some image cells contain a file name or path, which can't be read from here. Put the pictures into those cells instead (Excel: Insert → Pictures), or use web addresses."
          );
        }

        setUploadProgress(null);
        parsedRef.current = {
          products: parsed.products,
          refs: parsed.refs,
          masterNames: parsed.masterNames,
        };

        // The server does the counting. Client validation is for a fast, clear
        // report — it is not the gate, and its numbers are not authoritative.
        setBusyMessage("Checking against your data…");
        const dry = await runImport({
          products: parsed.products,
          refs: parsed.refs,
          masterNames: parsed.masterNames,
          mode,
          dryRun: true,
        });

        // The server knows which sheet an issue belongs to but not which row
        // of it — it never sees the workbook, only the assembled products. So
        // take its sheet, leave the row blank rather than guess (a guessed row
        // number paints the wrong cell in the corrected file), and translate
        // its field key into the header the user sees.
        const serverErrors: RowError[] = (dry?.errors ?? []).map((e: any) => {
          const sheet = ((e.sheet as SheetId) ?? "Products") as SheetId;
          return {
            sheet,
            row: e.row ?? null,
            column: e.field ? headerForField(sheet, e.field) ?? e.field : null,
            value: "",
            ref: e.ref ?? undefined,
            message: e.message,
          };
        });

        // Client errors first — they carry the exact cell coordinates.
        const seen = new Set(parsed.errors.map((e) => `${e.ref}|${e.message}`));
        const merged = [
          ...parsed.errors,
          ...serverErrors.filter((e) => !seen.has(`${e.ref}|${e.message}`)),
        ];

        setErrors(merged);
        setWarnings([...newMasterLines(dry?.newmasters), ...collectedWarnings]);
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
    [ensureMasters, permissions, adminid, branchid, mode, runImport, uploadImageMutation, dispatch, pickedImages]
  );

  /* ---------------- picked images ---------------- */

  const addImages = useCallback((files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const { images, warnings: pickWarnings } = collectPickedImages(list);
    pickedWarnings.current = pickWarnings;
    setPickedImages((prev) => new Map([...prev, ...images]));
    if (!images.size) {
      dispatch(showMessage({ message: "No image files (.jpg, .png, .webp…) were in that selection.", type: "error" }));
    }
  }, [dispatch]);

  const clearImages = useCallback(() => {
    pickedWarnings.current = [];
    setPickedImages(new Map());
  }, []);

  /** Re-run the check on the same file — after adding images on the review screen. */
  const recheck = useCallback(() => {
    if (originalFile.current) handleFile(originalFile.current);
  }, [handleFile]);

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
          masterNames: parsedRef.current.masterNames,
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
        if (result?.newmasters?.length) {
          setWarnings(newMasterLines(result.newmasters, true));
        }

        // New categories / brands now exist — refresh the cached lists so the
        // next template or import sees them in the dropdowns.
        loadMasters().catch(() => undefined);

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
    [mode, abortOnError, runImport, dispatch, loadMasters]
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
    originalFile.current = null;
  }, []);

  const open = useCallback(() => {
    reset();
    setIsOpen(true);
  }, [reset]);

  const close = useCallback(() => {
    setIsOpen(false);
    reset();
    clearImages();
  }, [reset, clearImages]);

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
    pickedImageCount: pickedImages.size,
    addImages,
    clearImages,
    recheck,
    downloadErrorFile,
    confirmImport,
    reset,
  };
};
