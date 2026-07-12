import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Render a DOM element (the printable invoice) into an A4 PDF blob.
// Handles multi-page overflow by sliding the same image up on each new page.
export const elementToPdfBlob = async (el: HTMLElement): Promise<Blob> => {
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });
  const img = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  const imgH = (canvas.height * contentW) / canvas.width;

  let heightLeft = imgH;
  let position = margin;
  pdf.addImage(img, "PNG", margin, position, contentW, imgH);
  heightLeft -= contentH;
  while (heightLeft > 0) {
    position -= contentH;
    pdf.addPage();
    pdf.addImage(img, "PNG", margin, position, contentW, imgH);
    heightLeft -= contentH;
  }
  return pdf.output("blob");
};

export type WhatsAppShareResult = "shared" | "cancelled" | "downloaded";

// Share the element as a PDF on WhatsApp.
// 1) Preferred: Web Share API with the PDF file — on mobile (and supported
//    desktops) the share sheet lets the user pick WhatsApp and the PDF is
//    attached directly.
// 2) Fallback (browsers that can't share files): download the PDF and open
//    the WhatsApp chat so the user attaches the just-downloaded file.
//    (WhatsApp's wa.me URL only accepts text — a file can't be pushed into
//    the chat from a browser without the Web Share API.)
export const shareElementAsPdfOnWhatsApp = async (opts: {
  element: HTMLElement;
  fileName: string;
  phone?: string; // digits only, with country code
  message?: string;
}): Promise<WhatsAppShareResult> => {
  const { element, fileName, phone, message } = opts;
  const blob = await elementToPdfBlob(element);
  const file = new File([blob], fileName, { type: "application/pdf" });

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName, text: message });
      return "shared";
    } catch (e: any) {
      if (e?.name === "AbortError") return "cancelled";
      // fall through to download fallback on any other share failure
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

  const wa = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  window.open(wa, "_blank", "noopener,noreferrer");
  return "downloaded";
};
