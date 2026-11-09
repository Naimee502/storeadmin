import { toWords } from "number-to-words";
import { formatDateTimeDMY, formatDateDMY, gstSplit } from "../../utils/helper";

/** Invoice PDF data resolved up front; keep in step with components/printinvoice. */

export interface PdfProduct {
  productserviceid: { name: string };
  variantid?: { name: string };
  salesunitid?: { unitname: string };
  purchaseunitid?: { unitname: string };
  qty: number;
  rate: number;
  gst: number;
  discount?: number;
  hsn?: string;
}

export interface PdfInvoice {
  billtype_billnumber: string;
  billdate: string;
  billdateRaw?: string;
  createdAt?: string;
  partyacc: string;
  partyname?: string;
  placeofsupply?: string;
  partystate?: string;
  gstin?: string;
  productservice?: PdfProduct[];
  amountinwords?: string;
  othercharges?: { ledgerid?: any; ledgername?: string; totalamount: number }[];
  deliverydate?: string;
  duedate?: string;
  transportname?: string;
  vehiclenumber?: string;
  ewaybillno?: string;
  distance?: number;
  roundoff?: number;
  invoicediscount?: number;
  invoicediscounttype?: string;
  partyPreviousBalance?: number;
  partyCurrentBalance?: number;
}

export interface PdfCompany {
  name?: string;
  address?: string;
  city?: string;
  mobile?: string;
}

export interface PdfOptions {
  title?: string;
  docNoLabel?: string;
  memoLabel?: string;
}

// Same fallback as AdminSettings.printTermsAndConditions on the server.
const DEFAULT_TERMS =
  "1. Goods once sold will not be taken back.\n" +
  "2. Interest @18% p.a. will be charged if payment is not made within due date.\n" +
  "3. Our risk and responsibility ceases as soon as the goods leave our premises.\n" +
  '4. "Subject to RAJKOT Jurisdiction only. E.&.O.E"';

export interface InvoicePdfModel {
  title: string;
  docNoLabel: string;
  memoLabel: string;
  showCompanyHeader: boolean;
  company: PdfCompany;
  metaCells: { label: string; value: string }[];
  showHsn: boolean;
  showGst: boolean;
  nameWidth: number;
  rows: {
    sr: number;
    name: string;
    hsn: string;
    qty: string;
    rate: string;
    discount: string;
    gst: string;
    amount: string;
  }[];
  totals: { label: string; value: string; grand?: boolean; balance?: boolean }[];
  amountInWords: string;
  showTerms: boolean;
  termsLines: string[];
  showSignatureCompanyName: boolean;
}

export const buildInvoicePdfModel = (
  invoice: PdfInvoice,
  settings: any,
  company: PdfCompany,
  opts: PdfOptions = {}
): InvoicePdfModel => {
  const products = invoice.productservice || [];

  const productsTotal = products.reduce((sum, p) => sum + p.qty * p.rate, 0);
  const totalDiscount = products.reduce((sum, p) => sum + (p.discount || 0), 0);
  const taxableTotal = productsTotal - totalDiscount;
  const totalGST = products.reduce((sum, p) => {
    const taxable = p.qty * p.rate - (p.discount || 0);
    return sum + (taxable * p.gst) / 100;
  }, 0);

  const invDisc = invoice.invoicediscount || 0;
  const computedInvDisc =
    invoice.invoicediscounttype === "percent" ? (taxableTotal * invDisc) / 100 : invDisc;

  const otherChargesTotal = (invoice.othercharges || []).reduce(
    (sum, c) => sum + (c.totalamount || 0),
    0
  );
  const roundOff = invoice.roundoff || 0;

  const grandTotal =
    productsTotal - totalDiscount + totalGST - computedInvDisc + otherChargesTotal + roundOff;

  // "Encrypt prices" divides every money figure by ten on the printed copy.
  const encrypt = !!settings?.encryptInvoicePrices;
  const mask = (val: number) => (encrypt ? val / 10 : val);
  const money = (val: number) => mask(val).toFixed(2);
  // "+" = party has to pay (baki), "−" = advance / excess we hold.
  const signedMoney = (val: number) => {
    const m = mask(Number(val) || 0);
    if (m > 0) return `+${m.toFixed(2)}`;
    if (m < 0) return `-${Math.abs(m).toFixed(2)}`;
    return "0.00";
  };

  /* meta grid */
  const metaCells: { label: string; value: string }[] = [
    { label: "M/S.", value: invoice.partyname || "---" },
    { label: opts.docNoLabel || "Invoice No.", value: invoice.billtype_billnumber },
    { label: "Place of Supply", value: invoice.placeofsupply || "---" },
    {
      label: "Transport / Vehicle No",
      value: `${invoice.transportname || "---"} / ${invoice.vehiclenumber || "---"}`,
    },
  ];
  if (settings?.printShowEwayBillDistance !== false) {
    metaCells.push({
      label: "E-Way Bill / Distance",
      value: `${invoice.ewaybillno || "---"} / ${invoice.distance ? `${invoice.distance} km` : "---"}`,
    });
  }
  if (settings?.printShowDeliveryDueDate !== false) {
    metaCells.push({
      label: "Delivery / Due Date",
      value: `${invoice.deliverydate ? formatDateDMY(invoice.deliverydate) : "---"} / ${
        invoice.duedate ? formatDateDMY(invoice.duedate) : "---"
      }`,
    });
  }
  if (settings?.printShowGstin !== false) {
    metaCells.push({ label: "GSTIN No.", value: invoice.gstin || "---" });
  }
  metaCells.push({
    label: "Date",
    value: formatDateTimeDMY(invoice.billdateRaw ?? invoice.billdate, invoice.createdAt),
  });
  metaCells.push({ label: "Party A/c", value: invoice.partyacc });

  /* items */
  const showHsn = settings?.printShowHsnColumn !== false;
  const showGst = settings?.printShowGstColumn !== false;
  let nameWidth = 34;
  if (!showHsn) nameWidth += 9;
  if (!showGst) nameWidth += 8;

  const rows = products.map((item, idx) => {
    const base = item.qty * item.rate;
    const discount = item.discount || 0;
    const taxable = base - discount;
    const gstAmt = (taxable * item.gst) / 100;
    const unit = item.salesunitid?.unitname || item.purchaseunitid?.unitname;

    return {
      sr: idx + 1,
      name:
        item.productserviceid.name +
        (item.variantid?.name ? ` - ${item.variantid.name}` : "") +
        (unit ? ` (${unit})` : ""),
      hsn: item.hsn || "-",
      qty: String(item.qty),
      rate: money(item.rate),
      discount: money(discount),
      gst: String(item.gst),
      amount: money(taxable + gstAmt),
    };
  });

  /* totals */
  const totals: InvoicePdfModel["totals"] = [
    { label: "Sub Total", value: money(productsTotal) },
    { label: "Total Discount", value: money(totalDiscount) },
  ];
  if (settings?.printShowTaxSplit === true) {
    const t = gstSplit(settings?.companyState, invoice.partystate, totalGST);
    if (t.inter) totals.push({ label: "IGST", value: money(t.igst) });
    else totals.push({ label: "CGST", value: money(t.cgst) }, { label: "SGST", value: money(t.sgst) });
  }
  if (settings?.printShowTotalGst !== false) {
    totals.push({ label: "Total GST", value: money(totalGST) });
  }
  for (const c of invoice.othercharges || []) {
    totals.push({
      label: c.ledgername || c.ledgerid?.ledgername || "Other Charge",
      value: money(c.totalamount || 0),
    });
  }
  if (computedInvDisc > 0) {
    totals.push({ label: "Invoice Discount", value: money(computedInvDisc) });
  }
  if (roundOff !== 0) {
    totals.push({ label: "Round Off", value: money(roundOff) });
  }
  totals.push({ label: "Grand Total", value: money(grandTotal), grand: true });

  // Only when the admin opted in AND the caller actually fetched the figures.
  const showPartyBalance =
    settings?.printShowPartyBalance === true &&
    invoice.partyPreviousBalance !== undefined &&
    invoice.partyCurrentBalance !== undefined;

  if (showPartyBalance) {
    totals.push({
      label: "Previous Balance",
      value: signedMoney(invoice.partyPreviousBalance || 0),
      balance: true,
    });
    totals.push({
      label: "Current Balance",
      value: signedMoney(invoice.partyCurrentBalance || 0),
      balance: true,
    });
  }

  return {
    title: opts.title || "TAX INVOICE",
    docNoLabel: opts.docNoLabel || "Invoice No.",
    memoLabel: opts.memoLabel || "Online Memo",
    showCompanyHeader: settings?.printShowCompanyHeader !== false,
    company,
    metaCells,
    showHsn,
    showGst,
    nameWidth,
    rows,
    totals,
    amountInWords:
      invoice.amountinwords || `${toWords(Math.round(mask(grandTotal)))} Rupees`,
    showTerms: settings?.printShowTermsAndConditions !== false,
    termsLines: (settings?.printTermsAndConditions || DEFAULT_TERMS)
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean),
    showSignatureCompanyName: settings?.printShowCompanyNameInSignature !== false,
  };
};
