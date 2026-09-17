/**
 * Sending a finished PDF to WhatsApp.
 *
 * This file used to build the PDF as well, by photographing the invoice
 * with html2canvas and pasting that picture into a jsPDF page. It no
 * longer does: the bill is now drawn as a real, text-bearing PDF by
 * components/invoicepdf, and this module's only job is delivery. Two
 * problems went away with the screenshot — the text in the file was not
 * text, and a one-page bill weighed about ten times what it needed to.
 */

export type WhatsAppShareResult = "shared" | "cancelled" | "downloaded";

// Send an already-built PDF on WhatsApp — as a file, never as a picture.
//
// There is no way to push a file into a WhatsApp chat from a browser. wa.me
// and web.whatsapp.com URLs carry text only; the attachment has to come from
// the operating system. So the one route that can attach anything is
// navigator.share(), which hands the file to the OS share sheet.
//
// That call is tried on EVERY device. It used to be gated behind a
// touch-device check, written when the only desktop tested was a Mac — and
// on macOS the sheet genuinely has no WhatsApp entry, because the Mac app
// registers no Share Extension. Windows is not the same machine: Chrome and
// Edge both implement Web Share with files there, and the Windows share
// sheet does list WhatsApp once the app is installed. Skipping the call on
// every desktop meant Windows never got the one path that works for it.
//
// The sheet needs two things to appear at all:
//   - a secure context (https://, or localhost) — plain http over the LAN
//     will not do, the API is simply absent there;
//   - the click that started this to still be recent. The browser only
//     honours share() while the user's gesture is fresh, which is the other
//     reason the PDF is now built from data instead of from a screenshot:
//     there is no offscreen render and no rasterising to wait through.
//
// When the sheet is unavailable or the browser refuses it, the fallback is
// a plain download plus the chat opening: attach the file that just landed
// in Downloads. Deliberately NO image is put on the clipboard — pasting one
// was quicker, but what arrived in the chat was a picture of the bill
// rather than the bill, and a customer can do nothing with a picture: no
// selectable text, no printing, no forwarding to an accountant.
export const shareBlobOnWhatsApp = async (opts: {
  blob: Blob;
  fileName: string;
  phone?: string; // digits only, with country code
  message?: string;
}): Promise<WhatsAppShareResult> => {
  const { blob, fileName, phone, message } = opts;

  const file = new File([blob], fileName, { type: "application/pdf" });

  // canShare({files}) is the honest test: Web Share exists in browsers that
  // still refuse file payloads, and calling share() there throws instead of
  // opening anything.
  if (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: fileName, text: message });
      return "shared";
    } catch (e: any) {
      // The user closing the sheet is a decision, not a failure — re-running
      // the whole flow behind their back would download a file they just
      // declined to send.
      if (e?.name === "AbortError") return "cancelled";
      // Anything else (NotAllowedError when the gesture has gone stale,
      // a platform with no handler for PDFs) falls through to the download.
      console.warn("navigator.share failed, falling back to download:", e);
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

  // The text is prefilled so only the file itself has to be attached. wa.me
  // opens the desktop app when it is installed and WhatsApp Web otherwise.
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  const wa = phone ? `https://wa.me/${phone}${query}` : `https://wa.me/${query}`;
  window.open(wa, "_blank", "noopener,noreferrer");

  return "downloaded";
};
