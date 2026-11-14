import { toWords } from "../supplierdocs";

// Same printed-document layout as client/src/utils/billprint.ts (the billing system invoice frame).

export const esc = (v: any) => String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string));
export const f2 = (n: any) => (Number(n) || 0).toFixed(2);
export const amountInWords = (n: any) => `${toWords(Math.round(Number(n) || 0))} Rupees`;

export type Column = { label: string; align?: "l" | "c" | "r"; width?: string };
export interface BillDoc {
  title: string;
  copy?: string;
  memo?: string;
  company: { name: string; address?: string; line2?: string; gstin?: string };
  /** Colour for the company name (Quotation Format accent). */
  accent?: string;
  showHeader?: boolean;
  cells: [string, string][];
  columns: Column[];
  /** Cell html per row, already escaped. */
  rows: string[][];
  /** Html between the items and the totals (e.g. optional items). */
  afterItems?: string;
  totals?: [string, string][];
  grand?: [string, string];
  words?: string;
  /** Html after the words line (notes, intro). */
  extra?: string;
  terms?: string[];
  termsTitle?: string;
  signLeft?: string;
  signCompany?: string | null;
  signLabel?: string;
  footer?: string;
}

const CSS = `body{margin:0;background:#fff}@media print{@page{margin:10mm}.inv-page{page-break-after:always}.inv-page:last-child{page-break-after:auto}}
.inv-root{padding:16px;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5}.inv-box{border:1.5px solid #111}
.inv-company{text-align:center;padding:14px 16px 4px}.inv-company-name{font-size:22px;font-weight:700;letter-spacing:.5px;margin:0}.inv-company-addr{font-size:11.5px;color:#333;margin-top:4px;padding-bottom:10px}
.inv-titlebar{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #111;border-bottom:1px solid #111;padding:7px 12px;font-weight:700;font-size:12.5px;background:#f3f4f6}
.inv-meta{display:flex;flex-wrap:wrap;border-bottom:1px solid #111}.inv-meta-cell{flex:1 1 33.33%;min-width:0;padding:8px 12px;border-right:1px solid #ccc;border-bottom:1px solid #ccc;box-sizing:border-box}.inv-meta-cell.nr{border-right:none}.inv-meta-cell.nb{border-bottom:none}.inv-meta-cell.wide{flex:1 1 100%;border-right:none}
.inv-meta-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#555;margin-bottom:2px}.inv-meta-value{font-size:12px;font-weight:600;word-break:break-word;white-space:pre-line}
.inv-table{width:100%;border-collapse:collapse}.inv-table th{background:#f3f4f6;border-top:1px solid #111;border-bottom:1px solid #111;border-right:1px solid #ccc;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}.inv-table th:last-child{border-right:none}
.inv-table td{border-bottom:1px solid #ddd;border-right:1px solid #ddd;padding:7px 8px;vertical-align:top}.inv-table td:last-child{border-right:none}.al{text-align:left}.ac{text-align:center;white-space:nowrap}.ar{text-align:right;white-space:nowrap}.desc{color:#444;font-size:11px;margin-top:2px}
.inv-sub{padding:8px 12px;font-weight:700;border-top:1px solid #111;background:#fafafa}
.inv-totals{display:flex;justify-content:flex-end;border-top:1px solid #111;border-bottom:1px solid #111}.inv-totals-box{width:46%;min-width:240px}.inv-totals-row{display:flex;justify-content:space-between;padding:5px 12px;border-bottom:1px solid #eee}.inv-totals-row .lbl{font-weight:600;color:#333}
.inv-totals-row.grand{border-top:1.5px solid #111;border-bottom:none;background:#f3f4f6;padding:8px 12px;font-size:14px;font-weight:700}
.inv-words{border-top:1px solid #111;padding:9px 12px}.inv-extra{border-top:1px solid #111;padding:9px 12px}.inv-footer{display:flex;border-top:1px solid #111}.inv-terms{flex:1 1 62%;padding:10px 12px;border-right:1px solid #111;font-size:11px;line-height:1.7}
.inv-sign{flex:1 1 38%;padding:10px 12px;display:flex;flex-direction:column;justify-content:flex-end;text-align:right;min-height:90px}.inv-sign.standalone{flex:0 0 auto;width:260px;margin-left:auto}
.inv-sign-left{flex:1 1 38%;padding:10px 12px;display:flex;flex-direction:column;justify-content:flex-end;min-height:90px;border-right:1px solid #111}.inv-note{text-align:center;color:#666;font-size:10px;padding:6px 12px;border-top:1px solid #111}`;

/** One document page in the common bill layout. */
export const billBody = (d: BillDoc) => {
  const lastRow = Math.floor((d.cells.length - 1) / 3) * 3;
  const meta = d.cells.map(([l, v], i) => `<div class="inv-meta-cell${i % 3 === 2 ? " nr" : ""}${i >= lastRow ? " nb" : ""}"><div class="inv-meta-label">${esc(l)}</div><div class="inv-meta-value">${v}</div></div>`).join("");
  const al = (c: Column) => (c.align === "r" ? "ar" : c.align === "c" ? "ac" : "al");
  const head = d.columns.map((c) => `<th class="${al(c)}"${c.width ? ` style="width:${c.width}"` : ""}>${esc(c.label)}</th>`).join("");
  const rows = d.rows.map((r) => `<tr>${r.map((cell, i) => `<td class="${al(d.columns[i] || { label: "" })}">${cell}</td>`).join("")}</tr>`).join("");
  const totals = (d.totals || []).map(([l, v]) => `<div class="inv-totals-row"><span class="lbl">${esc(l)}</span><span>${v}</span></div>`).join("")
    + (d.grand ? `<div class="inv-totals-row grand"><span>${esc(d.grand[0])}</span><span>${d.grand[1]}</span></div>` : "");
  const terms = d.terms?.length ? `<div class="inv-terms"><strong>${esc(d.termsTitle || "Terms & Condition :")}</strong><br/>${d.terms.join("<br/>")}</div>` : "";
  const left = d.signLeft ? `<div class="inv-sign-left"><div>${esc(d.signLeft)}</div></div>` : "";
  const sign = `<div class="inv-sign${terms || left ? "" : " standalone"}">${d.signCompany ? `<div><strong>For, ${esc(d.signCompany)}</strong></div>` : ""}<div>${esc(d.signLabel || "Authorised Signatory")}</div></div>`;
  return `<div class="inv-page"><div class="inv-root"><div class="inv-box">
${d.showHeader !== false ? `<div class="inv-company"><p class="inv-company-name"${d.accent ? ` style="color:${esc(d.accent)}"` : ""}>${esc(d.company.name || "---")}</p><div class="inv-company-addr">${esc(d.company.address || "---")}${d.company.line2 ? `<br/>${esc(d.company.line2)}` : ""}${d.company.gstin ? `<br/>GSTIN: ${esc(d.company.gstin)}` : ""}</div></div>` : ""}
<div class="inv-titlebar"><span>${esc(d.memo || "")}</span><span>${esc(d.title)} &nbsp;|&nbsp; ${esc(d.copy || "Original")}</span></div>
<div class="inv-meta">${meta}</div>
<table class="inv-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
${d.afterItems || ""}
${totals ? `<div class="inv-totals"><div class="inv-totals-box">${totals}</div></div>` : ""}
${d.words ? `<div class="inv-words"><strong>Amount in Words:</strong> ${esc(d.words)}</div>` : ""}
${d.extra ? `<div class="inv-extra">${d.extra}</div>` : ""}
<div class="inv-footer">${left}${terms}${sign}</div>
${d.footer ? `<div class="inv-note">${d.footer}</div>` : ""}
</div></div></div>`;
};

export const billHtml = (title: string, pages: string[]) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}.bar{text-align:right;padding:12px 16px}.bar button{background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer}@media print{.bar{display:none}}.inv-root{max-width:900px;margin:auto}</style></head><body><div class="bar"><button onclick="window.print()">Print / Save PDF</button></div>${pages.join("")}</body></html>`;

/** Company block from the logged-in business and Business Settings, same as the invoice header. */
export const companyOf = (company: any, settings: any) => ({
  name: company?.companyName || company?.name || "",
  address: company?.address || "",
  line2: [company?.city, company?.mobile].filter(Boolean).join(" - "),
  gstin: settings?.gstin || company?.gstnumber || "",
});

/** Invoice Print settings shared by every document. */
export const printOptions = (settings: any) => {
  const s = settings || {};
  return {
    showHeader: s.printShowCompanyHeader !== false,
    signCompany: s.printShowCompanyNameInSignature !== false,
    showTerms: s.printShowTermsAndConditions !== false,
    terms: String(s.printTermsAndConditions || "").split("\n").map((l: string) => l.trim()).filter(Boolean).map(esc),
  };
};

