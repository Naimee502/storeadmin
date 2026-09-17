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

import { toWhatsAppNumber } from "./phone";

export type WhatsAppShareResult = "shared" | "cancelled" | "downloaded";

/**
 * Put the party's number on the clipboard, ready for WhatsApp's picker.
 *
 * The share sheet can carry a file but not a recipient, so WhatsApp always
 * finishes on its "Send message to" list — and finding one customer in a
 * list of group chats is the part that actually costs the user time. A
 * paste is the closest thing to picking them automatically: the number goes
 * on the clipboard here, and the message the caller shows on click is what
 * tells the user it is there.
 *
 * The international form (+919586400821) is copied rather than the ten
 * digits on file, because it matches BOTH a saved contact and an unsaved
 * one — for a number not in the address book, that is the only form
 * WhatsApp will offer a chat for at all.
 *
 * execCommand is used in place of navigator.clipboard.writeText on purpose.
 * The Clipboard API is async and draws on the same user-activation budget
 * navigator.share() needs a moment later; this flow has already been broken
 * once by spending that budget early, and every share quietly turned into a
 * download. The old command is synchronous and consumes nothing.
 *
 * Returns what was copied, or null if there was no usable number or the
 * copy was refused — so the caller can stay quiet rather than promise a
 * paste that will not work.
 */
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

// Send an already-built PDF on WhatsApp — as a file, never as a picture.
//
// ── Why the party's chat is NOT opened first ────────────────────────────
// It is the obvious idea, and it was tried: fire "whatsapp://send?phone=..."
// so the customer sits at the top of WhatsApp's "Send message to" list. It
// breaks the share outright. Launching an external protocol makes Chrome put
// up its own "Open WhatsApp?" confirmation and spends the click's user
// activation on it — and navigator.share() needs that activation a moment
// later, so it throws and every share silently became a download. Whatever
// is done about the recipient has to leave this call path untouched.
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
  /** As stored on the party, in any format — normalised here. */
  phone?: string;
  message?: string;
}): Promise<WhatsAppShareResult> => {
  const { blob, fileName, phone, message } = opts;

  // Party Accounts hold ten-digit numbers ("9586400821"); WhatsApp accepts
  // nothing without a country code and answers a bare one with "Phone number
  // shared via url is invalid" — which is why the wa.me fallback below used
  // to land on an empty "pick someone" screen instead of the party's chat.
  const number = toWhatsAppNumber(phone);

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
  // opens the desktop app when it is installed and WhatsApp Web otherwise —
  // and now on the party's own number, not an empty "pick someone" screen.
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  const wa = number ? `https://wa.me/${number}${query}` : `https://wa.me/${query}`;
  window.open(wa, "_blank", "noopener,noreferrer");

  return "downloaded";
};
