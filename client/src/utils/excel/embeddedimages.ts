import type ExcelJS from "exceljs";

/**
 * Pictures a person put INSIDE the workbook, so the import needs no file
 * paths and no separate "Select Images" step.
 *
 * Two ways Excel stores a picture against a cell, both read here:
 *
 *   Place in Cell  — Insert → Pictures → Place in Cell (Excel 365, Excel for
 *                    the web). The picture is the cell's value. ExcelJS does
 *                    not understand these, so they are read straight out of
 *                    the xlsx zip: sheet cell (vm="n") → metadata.xml →
 *                    richData/rdrichvalue.xml → richValueRel.xml → xl/media.
 *
 *   Over the cell  — Insert → Picture, then dropped onto the cell (every
 *                    Excel version). ExcelJS reads these with getImages();
 *                    the picture belongs to the cell its top-left corner is in.
 *
 * Result: `${row}|${col}` (1-based, as Excel numbers them) → the pictures in
 * that cell, as Files ready to upload.
 */

export type CellImages = Map<string, File[]>;

export const cellKey = (row: number, col: number) => `${row}|${col}`;

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

/** Excel can also embed vector formats (emf/wmf/svg) — not usable as a product photo. */
const USABLE = /^(png|jpe?g|gif|bmp|webp)$/i;

const toFile = (bytes: Uint8Array | ArrayBuffer, row: number, col: number, index: number, ext: string): File => {
  const e = ext.toLowerCase().replace("jpeg", "jpg");
  return new File([bytes as any], `excel-r${row}-c${col}-${index + 1}.${e}`, {
    type: MIME[e] ?? "application/octet-stream",
  });
};

const add = (map: CellImages, row: number, col: number, file: File) => {
  const key = cellKey(row, col);
  const bucket = map.get(key) ?? [];
  bucket.push(file);
  map.set(key, bucket);
};

/** "K11" → { row: 11, col: 11 } */
const parseRef = (ref: string): { row: number; col: number } | null => {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]), col };
};

const attr = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m?.[1];
};

/** Resolve "../media/image1.png" against "xl/richData/" → "xl/media/image1.png". */
const resolvePath = (baseDir: string, target: string): string => {
  if (target.startsWith("/")) return target.slice(1);
  const parts = baseDir.split("/").filter(Boolean);
  for (const piece of target.split("/")) {
    if (piece === "..") parts.pop();
    else if (piece && piece !== ".") parts.push(piece);
  }
  return parts.join("/");
};

/* ------------------------------------------------------------------ *
 * Place in Cell (rich value) pictures
 * ------------------------------------------------------------------ */

const readPlacedInCell = async (buffer: ArrayBuffer, sheetName: string, out: CellImages) => {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const text = async (path: string) => (zip.file(path) ? await zip.file(path)!.async("string") : "");

  // Without these parts the file has no in-cell pictures at all.
  const [metadata, richValues, structures, relList, relRels, workbookXml, workbookRels] = await Promise.all([
    text("xl/metadata.xml"),
    text("xl/richData/rdrichvalue.xml"),
    text("xl/richData/rdrichvaluestructure.xml"),
    text("xl/richData/richValueRel.xml"),
    text("xl/richData/_rels/richValueRel.xml.rels"),
    text("xl/workbook.xml"),
    text("xl/_rels/workbook.xml.rels"),
  ]);
  if (!metadata || !richValues || !relList) return;

  // Sheet name → its XML part.
  const sheetTag = [...workbookXml.matchAll(/<sheet\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => attr(tag, "name") === sheetName);
  const sheetRid = sheetTag ? attr(sheetTag, "r:id") : undefined;
  const relTag = [...workbookRels.matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => attr(tag, "Id") === sheetRid);
  const sheetTarget = relTag ? attr(relTag, "Target") : undefined;
  if (!sheetTarget) return;
  const sheetXml = await text(resolvePath("xl", sheetTarget));
  if (!sheetXml) return;

  // vm (1-based) → valueMetadata <bk><rc v=…/> → futureMetadata XLRICHVALUE <bk> → rvb i.
  const valueBks = [...(/<valueMetadata\b[\s\S]*?<\/valueMetadata>/.exec(metadata)?.[0] ?? "").matchAll(/<bk>([\s\S]*?)<\/bk>/g)].map((m) => m[1]);
  const futureBlock = /<futureMetadata\b[^>]*name="XLRICHVALUE"[^>]*>([\s\S]*?)<\/futureMetadata>/.exec(metadata)?.[1] ?? "";
  const futureBks = [...futureBlock.matchAll(/<bk>([\s\S]*?)<\/bk>/g)].map((m) => m[1]);
  const richIndexForVm = (vm: number): number | null => {
    const rc = /<rc\b[^>]*>/.exec(valueBks[vm - 1] ?? "")?.[0];
    const v = rc ? Number(attr(rc, "v")) : NaN;
    const rvb = /<(?:\w+:)?rvb\b[^>]*>/.exec(futureBks[v] ?? "")?.[0];
    const i = rvb ? Number(attr(rvb, "i")) : NaN;
    return Number.isFinite(i) ? i : null;
  };

  // Rich value → the index of its picture in richValueRel.xml.
  const structureList = [...structures.matchAll(/<s\b[^>]*>([\s\S]*?)<\/s>/g)].map((m) =>
    [...m[1].matchAll(/<k\b[^>]*>/g)].map((k) => attr(k[0], "n") ?? "")
  );
  const values = [...richValues.matchAll(/<rv\b([^>]*)>([\s\S]*?)<\/rv>/g)].map((m) => ({
    s: Number(attr(m[1], "s") ?? 0),
    v: [...m[2].matchAll(/<v\b[^>]*>([\s\S]*?)<\/v>/g)].map((x) => x[1]),
  }));
  const relIndexForRich = (i: number): number | null => {
    const value = values[i];
    if (!value) return null;
    const keys = structureList[value.s] ?? [];
    const at = keys.indexOf("_rvRel:LocalImageIdentifier");
    const raw = value.v[at >= 0 ? at : 0];
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  // richValueRel index → media path.
  const relIds = [...relList.matchAll(/<rel\b[^>]*>/g)].map((m) => attr(m[0], "r:id") ?? "");
  const targets = new Map(
    [...relRels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], "Id") ?? "", attr(m[0], "Target") ?? ""])
  );

  const perCell = new Map<string, number>();
  for (const m of sheetXml.matchAll(/<c\s([^>]*?)\/?>/g)) {
    const vm = attr(m[1], "vm");
    const ref = attr(m[1], "r");
    if (!vm || !ref) continue;
    const pos = parseRef(ref);
    const rich = richIndexForVm(Number(vm));
    const relIndex = rich === null ? null : relIndexForRich(rich);
    const target = relIndex === null ? undefined : targets.get(relIds[relIndex]);
    if (!pos || !target) continue;

    const mediaPath = resolvePath("xl/richData", target);
    const ext = mediaPath.split(".").pop() ?? "";
    if (!USABLE.test(ext)) continue;
    const bytes = await zip.file(mediaPath)?.async("uint8array");
    if (!bytes) continue;

    const key = cellKey(pos.row, pos.col);
    const index = perCell.get(key) ?? 0;
    perCell.set(key, index + 1);
    add(out, pos.row, pos.col, toFile(bytes, pos.row, pos.col, index, ext));
  }
};

/* ------------------------------------------------------------------ *
 * Pictures floating over a cell
 * ------------------------------------------------------------------ */

const readFloating = (workbook: ExcelJS.Workbook, sheetName: string, out: CellImages) => {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return;

  for (const picture of sheet.getImages()) {
    const media: any = workbook.getImage(Number(picture.imageId));
    const bytes: Uint8Array | undefined = media?.buffer;
    const ext = String(media?.extension ?? "png");
    if (!bytes || !USABLE.test(ext)) continue;

    // The cell the picture's TOP-LEFT corner sits in: Excel inserts a
    // picture at the selected cell, and a full-size photo then hangs down over
    // many rows — its centre would land on some other product's row. tl is
    // 0-based and fractional; a corner in the last quarter of a cell was
    // nudged slightly above/left of the intended cell, so it counts as the next.
    const tl: any = picture.range?.tl;
    if (!tl) continue;
    const settle = (v: number) => (v - Math.floor(v) > 0.75 ? Math.floor(v) + 1 : Math.floor(v));
    let row = settle(Number(tl.row)) + 1;
    let col = settle(Number(tl.col)) + 1;

    // A hidden column has no width, so a picture put at the left edge of the
    // visible cell is anchored by Excel to the hidden column before it — in
    // the template that is the hidden "Category_ID" right before "Category
    // Image". What the person saw and aimed at is the next visible column.
    while (col < 16384 && sheet.getColumn(col).hidden) col++;
    while (row < 1048576 && sheet.getRow(row).hidden) row++;

    const index = out.get(cellKey(row, col))?.length ?? 0;
    add(out, row, col, toFile(bytes, row, col, index, ext));
  }
};

/**
 * Every picture on `sheetName`, by the cell it belongs to. Never throws — a
 * workbook we can't read pictures from simply has none.
 */
export const readCellImages = async (
  buffer: ArrayBuffer,
  workbook: ExcelJS.Workbook,
  sheetName: string
): Promise<CellImages> => {
  const out: CellImages = new Map();
  try {
    readFloating(workbook, sheetName, out);
  } catch {
    /* no floating pictures readable */
  }
  try {
    await readPlacedInCell(buffer, sheetName, out);
  } catch {
    /* no in-cell pictures readable */
  }
  return out;
};
