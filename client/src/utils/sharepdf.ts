// Sends a finished PDF (built by components/invoicepdf) to WhatsApp.

import { toWhatsAppNumber } from "./phone";

export type WhatsAppShareResult = "shared" | "cancelled" | "downloaded";

// Copy the party's +91 number for pasting into WhatsApp's picker; sync execCommand keeps the share gesture.
export const copyPartyNumberForPicker = (phone?: string | null): string | null => {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;

  const text = `+${number}`;
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, text.length);
    const copied = document.execCommand("copy");
    field.remove();
    return copied ? text : null;
  } catch (e) {
    console.warn("[whatsapp] Could not copy the party's number:", e);
    return null;
  }
};

// Share the PDF file via navigator.share(); fall back to download + open the chat.
export const shareBlobOnWhatsApp = async (opts: {
  blob: Blob;
  fileName: string;
  /** As stored on the party, in any format — normalised here. */
  phone?: string;
  message?: string;
}): Promise<WhatsAppShareResult> => {
  const { blob, fileName, phone, message } = opts;

  // WhatsApp needs a country code; party numbers are stored as ten digits.
  const number = toWhatsAppNumber(phone);

  const file = new File([blob], fileName, { type: "application/pdf" });

  // Some browsers have Web Share but refuse files.
  if (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: fileName, text: message });
      return "shared";
    } catch (e: any) {
      // User closed the sheet: don't fall back to a download.
      if (e?.name === "AbortError") return "cancelled";
      // Anything else (stale gesture, no PDF handler) falls through to the download.
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

  // Prefilled text, opened on the party's own chat.
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  const wa = number ? `https://wa.me/${number}${query}` : `https://wa.me/${query}`;
  window.open(wa, "_blank", "noopener,noreferrer");

  return "downloaded";
};
