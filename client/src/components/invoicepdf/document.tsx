import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { InvoicePdfModel } from "./model";

/**
 * The invoice, drawn as a real PDF.
 *
 * Every line here is a vector instruction, not a picture: the text in the
 * finished file can be selected, searched, copied into an accounting
 * package and printed at any size without going soft. The old route
 * (html2canvas -> JPEG -> jsPDF.addImage) produced a PDF whose entire
 * contents were one flat photograph of the screen — which is what "the PDF
 * is an image" meant. It also weighed about ten times as much.
 *
 * ── Fonts ───────────────────────────────────────────────────────────────
 * Helvetica only, which is one of the fourteen faces every PDF reader is
 * required to have. Nothing is registered and nothing is downloaded, so
 * building a bill never waits on the network — the difference between a
 * file that appears instantly at the counter and one that appears after a
 * spinner. Helvetica is also the closest built-in match to the Arial the
 * printed copy uses, so the two look like the same document.
 *
 * ── Sizes ───────────────────────────────────────────────────────────────
 * The HTML invoice is specified in px, PDFs are specified in points, and
 * 1px at 96dpi is 0.75pt. Rather than convert each number by hand and
 * leave a trail of 8.25s, px() does it, so any measurement below can be
 * read straight against the stylesheet in components/printinvoice.
 */

const px = (v: number) => v * 0.75;

const BLACK = "#111111";
const GREY_LINE = "#cccccc";
const ROW_LINE = "#dddddd";
const HEAD_BG = "#f3f4f6";

const s = StyleSheet.create({
  page: {
    paddingVertical: px(40),
    paddingHorizontal: px(40),
    fontFamily: "Helvetica",
    fontSize: px(12),
    color: BLACK,
    lineHeight: 1.4,
  },
  box: { borderWidth: px(1.5), borderColor: BLACK },

  /* ---- header ---- */
  company: { textAlign: "center", paddingTop: px(14), paddingHorizontal: px(16), paddingBottom: px(4) },
  companyName: { fontSize: px(22), fontFamily: "Helvetica-Bold", letterSpacing: px(0.5) },
  companyAddr: { fontSize: px(11.5), color: "#333333", marginTop: px(4), paddingBottom: px(10) },

  titlebar: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: px(1),
    borderBottomWidth: px(1),
    borderColor: BLACK,
    paddingVertical: px(7),
    paddingHorizontal: px(12),
    fontFamily: "Helvetica-Bold",
    fontSize: px(12.5),
    backgroundColor: HEAD_BG,
  },

  /* ---- meta grid ---- */
  meta: { flexDirection: "row", flexWrap: "wrap", borderBottomWidth: px(1), borderColor: BLACK },
  metaCell: {
    width: "33.333%",
    paddingVertical: px(8),
    paddingHorizontal: px(12),
    borderRightWidth: px(1),
    borderBottomWidth: px(1),
    borderColor: GREY_LINE,
  },
  metaLabel: {
    fontSize: px(10),
    fontFamily: "Helvetica-Bold",
    letterSpacing: px(0.4),
    color: "#555555",
    marginBottom: px(2),
  },
  metaValue: { fontSize: px(12), fontFamily: "Helvetica-Bold" },

  /* ---- items ---- */
  th: {
    flexDirection: "row",
    backgroundColor: HEAD_BG,
    borderTopWidth: px(1),
    borderBottomWidth: px(1),
    borderColor: BLACK,
  },
  thCell: {
    paddingVertical: px(8),
    paddingHorizontal: px(8),
    fontSize: px(11),
    fontFamily: "Helvetica-Bold",
    letterSpacing: px(0.3),
    textAlign: "center",
    borderRightWidth: px(1),
    borderColor: GREY_LINE,
  },
  tr: { flexDirection: "row", borderBottomWidth: px(1), borderColor: ROW_LINE },
  td: {
    paddingVertical: px(7),
    paddingHorizontal: px(8),
    borderRightWidth: px(1),
    borderColor: ROW_LINE,
  },
  noRight: { borderRightWidth: 0 },

  /* ---- totals ---- */
  totals: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: px(1),
    borderBottomWidth: px(1),
    borderColor: BLACK,
  },
  totalsBox: { width: "46%" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: px(5),
    paddingHorizontal: px(12),
    borderBottomWidth: px(1),
    borderColor: "#eeeeee",
  },
  totalsLabel: { fontFamily: "Helvetica-Bold", color: "#333333" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: px(1.5),
    borderColor: BLACK,
    backgroundColor: HEAD_BG,
    paddingVertical: px(8),
    paddingHorizontal: px(12),
    fontSize: px(14),
    fontFamily: "Helvetica-Bold",
  },

  /* ---- words / footer ---- */
  words: { borderTopWidth: px(1), borderColor: BLACK, paddingVertical: px(9), paddingHorizontal: px(12) },
  footer: { flexDirection: "row", borderTopWidth: px(1), borderColor: BLACK },
  terms: {
    width: "62%",
    paddingVertical: px(10),
    paddingHorizontal: px(12),
    borderRightWidth: px(1),
    borderColor: BLACK,
    fontSize: px(11),
    lineHeight: 1.6,
  },
  sign: {
    width: "38%",
    paddingVertical: px(10),
    paddingHorizontal: px(12),
    justifyContent: "flex-end",
    textAlign: "right",
    minHeight: px(90),
  },
  // With Terms hidden, the signature must not stretch across the whole row —
  // it becomes a normal right-aligned block, as it does in the printed copy.
  signStandalone: { width: px(260), marginLeft: "auto" },
  bold: { fontFamily: "Helvetica-Bold" },
});

export const InvoiceDocument = ({ model: m }: { model: InvoicePdfModel }) => {
  // Column widths, as percentages, in the order the header declares them.
  const cols: { key: keyof (typeof m.rows)[number]; w: string; align: "left" | "center" | "right"; head: string }[] = [
    { key: "sr", w: "6%", align: "center", head: "Sr" },
    { key: "name", w: `${m.nameWidth}%`, align: "left", head: "Product Name" },
    ...(m.showHsn ? ([{ key: "hsn", w: "9%", align: "center", head: "HSN" }] as const) : []),
    { key: "qty", w: "8%", align: "center", head: "Qty" },
    { key: "rate", w: "12%", align: "right", head: "Rate" },
    { key: "discount", w: "10%", align: "right", head: "Disc" },
    ...(m.showGst ? ([{ key: "gst", w: "8%", align: "center", head: "GST%" }] as const) : []),
    { key: "amount", w: "13%", align: "right", head: "Amount" },
  ] as any;

  const lastCol = cols.length - 1;
  // Matches the HTML: the final ROW of meta cells carries no bottom border,
  // because the grid's own border closes it.
  const lastRowStart = Math.floor((m.metaCells.length - 1) / 3) * 3;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.box}>
          {m.showCompanyHeader && (
            <View style={s.company}>
              <Text style={s.companyName}>{m.company.name || "---"}</Text>
              <Text style={s.companyAddr}>
                {m.company.address || "---"}
                {"\n"}
                {[m.company.city, m.company.mobile].filter(Boolean).join(" - ")}
              </Text>
            </View>
          )}

          <View style={s.titlebar}>
            <Text>{m.memoLabel}</Text>
            <Text>{m.title}  |  Original</Text>
          </View>

          {/* ---- meta ---- */}
          <View style={s.meta}>
            {m.metaCells.map((cell, idx) => (
              <View
                key={idx}
                style={[
                  s.metaCell,
                  idx % 3 === 2 ? { borderRightWidth: 0 } : {},
                  idx >= lastRowStart ? { borderBottomWidth: 0 } : {},
                ]}
              >
                <Text style={s.metaLabel}>{cell.label.toUpperCase()}</Text>
                <Text style={s.metaValue}>{cell.value}</Text>
              </View>
            ))}
          </View>

          {/* ---- items ---- */}
          {/* `fixed` repeats the header when a long bill runs onto a second
              page; without it page two would be a wall of unlabelled numbers. */}
          <View style={s.th} fixed>
            {cols.map((c, i) => (
              <View key={c.key as string} style={[{ width: c.w }, i === lastCol ? s.noRight : {}]}>
                <Text style={[s.thCell, { textAlign: i === 1 ? "left" : "center", borderRightWidth: 0 }]}>
                  {c.head}
                </Text>
              </View>
            ))}
          </View>

          {m.rows.map((row, ri) => (
            // A line item must not be torn in half across a page break.
            <View key={ri} style={s.tr} wrap={false}>
              {cols.map((c, i) => (
                <View key={c.key as string} style={[{ width: c.w }, s.td, i === lastCol ? s.noRight : {}]}>
                  <Text style={{ textAlign: c.align }}>{String(row[c.key])}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* ---- totals ---- */}
          <View style={s.totals}>
            <View style={s.totalsBox}>
              {m.totals.map((t, i) =>
                t.grand ? (
                  <View key={i} style={s.grandRow}>
                    <Text>{t.label}</Text>
                    <Text>{t.value}</Text>
                  </View>
                ) : (
                  <View key={i} style={s.totalsRow}>
                    <Text style={[s.totalsLabel, t.balance ? s.bold : {}]}>{t.label}</Text>
                    <Text style={t.balance ? s.bold : {}}>{t.value}</Text>
                  </View>
                )
              )}
            </View>
          </View>

          {/* ---- amount in words ---- */}
          <View style={s.words}>
            <Text>
              <Text style={s.bold}>Amount in Words: </Text>
              {m.amountInWords}
            </Text>
          </View>

          {/* ---- terms & signature ---- */}
          <View style={s.footer}>
            {m.showTerms && (
              <View style={s.terms}>
                <Text style={s.bold}>Terms &amp; Condition :</Text>
                {m.termsLines.map((line, i) => (
                  <Text key={i}>{line}</Text>
                ))}
              </View>
            )}
            <View style={[s.sign, m.showTerms ? {} : s.signStandalone]}>
              {m.showSignatureCompanyName && (
                <Text style={s.bold}>For, {m.company.name || "---"}</Text>
              )}
              <Text>Authorised Signatory</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default InvoiceDocument;
