import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Turning the printable invoice into something that can be sent on WhatsApp.
 *
 * The whole file is written around one measurement. A one-page invoice used to
 * leave here as a 5 MB PDF, and WhatsApp spent minutes uploading it — at a shop
 * counter, with the customer standing there, that is the entire problem. The
 * PDF was never slow to BUILD (html2canvas ~150 ms, the rest under half a
 * second); it was slow to SEND, because of how big it was.
 *
 * It was that big because jsPDF does not re-compress a PNG: it decodes it and
 * writes the raw pixels into the document, so a 0.91 MB PNG became a 6.6 MB
 * PDF — larger than what went in. A JPEG is copied in verbatim (DCTDecode) and
 * the same page comes out at 0.22 MB. That one change is ~20x off the upload.
 *
 * JPEG costs nothing here: the page is black text on white, there is no
 * transparency to preserve, and at scale 2 with quality 0.92 it is
 * indistinguishable from the PNG at any normal zoom.
 */

/** html2canvas scale. 2 over an 800px layout is ~215 DPI on A4 — plenty. */
const RENDER_SCALE = 2;
const JPEG_QUALITY = 0.92;

const renderCanvas = (el: HTMLElement) =>
  html2canvas(el, {
    scale: RENDER_SCALE,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

/** A4 PDF from an already-rendered canvas, paging by sliding the image up. */
const canvasToPdfBlob = (canvas: HTMLCanvasElement): Blob => {
  const img = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  const imgH = (canvas.height * contentW) / canvas.width;

  let heightLeft = imgH;
  let position = margin;
  pdf.addImage(img, "JPEG", margin, position, contentW, imgH);
  heightLeft -= contentH;
  while (heightLeft > 0) {
    position -= contentH;
    pdf.addPage();
    pdf.addImage(img, "JPEG", margin, position, contentW, imgH);
    heightLeft -= contentH;
  }
  return pdf.output("blob");
};

// Render a DOM element (the printable invoice) into an A4 PDF blob.
export const elementToPdfBlob = async (el: HTMLElement): Promise<Blob> =>
  canvasToPdfBlob(await renderCanvas(el));

/**
 * Put the invoice on the clipboard as an image, so it can be pasted straight
 * into the chat with one keystroke.
 *
 * This is what removes the last slow step on desktop. Downloading a file and
 * then finding it and dragging it in is three actions and several seconds of
 * a customer's patience; Cmd/Ctrl+V is one. The chat also shows the bill
 * inline instead of as an attachment the customer has to open.
 *
 * PNG, not JPEG: image/png is the one image type browsers reliably accept on
 * the clipboard. Size does not matter much here — it never leaves the machine
 * as a PNG, WhatsApp re-encodes whatever is pasted.
 *
 * It can legitimately fail — the API is missing, the document lost focus, the
 * user denied clipboard access — so every caller treats it as a bonus and
 * falls back to the downloaded PDF.
 */
const copyCanvasToClipboard = async (canvas: HTMLCanvasElement): Promise<boolean> => {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, "image/png"));
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
};

export type WhatsAppShareResult = "shared" | "cancelled" | "copied" | "downloaded";

/**
 * Is this a phone/tablet?
 *
 * It decides which of the two WhatsApp routes below is worth taking, so it
 * asks about the input device rather than sniffing the browser name: a coarse
 * pointer with no hover is a finger, and that is exactly the case where the
 * OS share sheet contains WhatsApp.
 */
const isTouchDevice = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: coarse) and (hover: none)").matches === true;

// Share the printable element on WhatsApp.
//
// There is no way to push a file into a WhatsApp chat from a browser. wa.me
// and web.whatsapp.com URLs carry text only — the attachment has to come from
// somewhere else. That leaves two routes, and which one works depends on the
// device, not on the browser:
//
//   Phone/tablet — navigator.share() hands the PDF to the OS share sheet, and
//     on Android and iOS that sheet lists WhatsApp. Picking it attaches the
//     PDF as a real document.
//
//   Desktop — the same call opens the macOS share sheet, and WhatsApp is not
//     in it: the Mac app registers no Share Extension, so the sheet offers
//     AirDrop, Mail, Messages and nothing that helps. So the sheet is skipped.
//     Instead the invoice goes on the clipboard as an image and the party's
//     chat opens: paste, Enter, done. The PDF is downloaded as well, for when
//     the customer wants the actual file rather than a picture of it.
//
// If WhatsApp ever does appear in the macOS sheet (System Settings → General
// → Login Items & Extensions → Sharing), drop the isTouchDevice() guard and
// the desktop gets the direct path back.
export const shareElementAsPdfOnWhatsApp = async (opts: {
  element: HTMLElement;
  fileName: string;
  phone?: string; // digits only, with country code
  message?: string;
}): Promise<WhatsAppShareResult> => {
  const { element, fileName, phone, message } = opts;
  const canvas = await renderCanvas(element);
  const blob = canvasToPdfBlob(canvas);

  if (isTouchDevice()) {
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName, text: message });
        return "shared";
      } catch (e: any) {
        if (e?.name === "AbortError") return "cancelled";
        // Any other share failure falls through to the desktop route below.
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  // Before window.open: Chrome refuses a clipboard write once the document
  // has lost focus, and opening the chat takes the focus away.
  const copied = await copyCanvasToClipboard(canvas);

  // The text is prefilled so only the bill itself has to be pasted. wa.me
  // opens the desktop app when it is installed and WhatsApp Web otherwise.
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  const wa = phone ? `https://wa.me/${phone}${query}` : `https://wa.me/${query}`;
  window.open(wa, "_blank", "noopener,noreferrer");

  return copied ? "copied" : "downloaded";
};
