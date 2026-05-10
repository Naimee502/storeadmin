import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { toWords } from "number-to-words";
import { useAppSelector } from "../../redux/hooks";

/* ================= TYPES ================= */
interface Product {
  productserviceid: { name: string };
  variantid?: { name: string };
  salesunitid?: { unitname: string };
  qty: number;
  rate: number;
  gst: number;
  discount?: number;
  hsn?: string;
}

interface Invoice {
  billtype_billnumber: string;
  billdate: string;
  partyacc: string;
  partyname?: string;
  placeofsupply?: string;
  gstin?: string;
  productservice?: Product[];
  totalamount?: number;
  amountinwords?: string;
}

interface PrintableInvoiceProps {
  invoice: Invoice;
}

/* ================= COMPONENT ================= */
const PrintableInvoice = forwardRef<HTMLDivElement, PrintableInvoiceProps>(
  ({ invoice }, ref) => {
    const localRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => localRef.current!);

    // Resolve the company name from whichever auth role is active. Admins
    // have it directly on `admin.companyName`; branch and staff users get
    // it via their parent admin. Falls back to "---" only if everything
    // is missing (which shouldn't happen for an authenticated session).
    const auth = useAppSelector((state) => state.auth);
    const branch = auth.branch;
    const companyName =
      auth.type === "admin"
        ? auth.admin?.companyName
        : auth.type === "branch"
          ? auth.branch?.admin?.companyName
          : auth.type === "staff"
            ? auth.staff?.admin?.companyName
            : "";

    const products = invoice.productservice || [];

    /* ================= CALCULATIONS ================= */
    const productsTotal = products.reduce(
      (sum, p) => sum + p.qty * p.rate,
      0
    );

    const totalDiscount = products.reduce(
      (sum, p) => sum + (p.discount || 0),
      0
    );

    const taxableTotal = productsTotal - totalDiscount;

    const totalGST = products.reduce((sum, p) => {
      const taxable = p.qty * p.rate - (p.discount || 0);
      return sum + (taxable * p.gst) / 100;
    }, 0);

    const grandTotal = (productsTotal - totalDiscount) + totalGST;

    return (
      <div
        ref={localRef}
        className="p-4 text-black text-xs w-full print:pt-2 print:pb-2 font-sans"
      >
        <style>{`
          @media print {
            body {
              margin: 0;
              padding: 50mm 0 0 0;
            }
            @page {
              margin: 10mm;
            }
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          td, th {
            border: 1px solid black;
            padding: 4px;
          }
        `}</style>

        <table>
          <thead>
            <tr>
              <td colSpan={8} className="text-center text-lg font-bold">
                {companyName || "---"}
              </td>
            </tr>

            <tr>
              <td colSpan={8} className="text-center">
                {/* Branch contact still appears below the company name so
                    the bill carries a usable address/phone for the buyer. */}
                {branch?.address || "---"}
                <br />
                {branch?.city || "---"} -{" "}
                {branch?.phone || branch?.mobile || "---"}
              </td>
            </tr>

            <tr>
              <td colSpan={4} className="text-left font-semibold">
                Online Memo
              </td>
              <td colSpan={4} className="text-right font-semibold">
                TAX INVOICE &nbsp;&nbsp;&nbsp; Original
              </td>
            </tr>

            <tr>
              <td colSpan={3}>
                <strong>M/S. :</strong> {invoice.partyname || "---"}
              </td>
              <td colSpan={2}>
                <strong>Invoice No. :</strong>{" "}
                {invoice.billtype_billnumber}
              </td>
              <td colSpan={3}>
                <strong>Place of Supply:</strong>{" "}
                {invoice.placeofsupply || "Rajkot"}
              </td>
            </tr>

            <tr>
              <td colSpan={3}>
                <strong>GSTIN No.:</strong>{" "}
                {invoice.gstin || "24CGQPM7906P1ZJ"}
              </td>
              <td colSpan={2}>
                <strong>Date:</strong> {invoice.billdate}
              </td>
              <td colSpan={3}>
                <strong>Party A/c:</strong> {invoice.partyacc}
              </td>
            </tr>
          </thead>

          <tbody>
            {/* HEADER */}
            <tr className="text-center font-semibold">
              <th>SrNo</th>
              <th>Product Name</th>
              <th>HSN</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Disc</th>
              <th>GST%</th>
              <th>Amount</th>
            </tr>

            {/* PRODUCTS */}
            {products.map((item, idx) => {
              const base = item.qty * item.rate;
              const discount = item.discount || 0;
              const taxable = base - discount;
              const gstAmt = (taxable * item.gst) / 100;
              const total = taxable + gstAmt;

              return (
                <tr key={idx}>
                  <td className="text-center">{idx + 1}</td>
                  <td>
                    {item.productserviceid.name}
                    {item.variantid?.name && ` - ${item.variantid.name}`}
                    {item.salesunitid?.unitname &&
                      ` (${item.salesunitid.unitname})`}
                  </td>
                  <td className="text-center">{item.hsn || "-"}</td>
                  <td className="text-center">{item.qty}</td>
                  <td className="text-center">{item.rate.toFixed(2)}</td>
                  <td className="text-center">{discount.toFixed(2)}</td>
                  <td className="text-center">{item.gst}</td>
                  <td className="text-center">{total.toFixed(2)}</td>
                </tr>
              );
            })}

            {/* TOTALS RIGHT SIDE */}
            <tr>
              <td colSpan={7} className="text-right font-semibold">
                Sub Total
              </td>
              <td className="text-right">
                {productsTotal.toFixed(2)}
              </td>
            </tr>

            <tr>
              <td colSpan={7} className="text-right font-semibold">
                Total Discount
              </td>
              <td className="text-right">
                {totalDiscount.toFixed(2)}
              </td>
            </tr>

            <tr>
              <td colSpan={7} className="text-right font-semibold">
                Total GST
              </td>
              <td className="text-right">
                {totalGST.toFixed(2)}
              </td>
            </tr>

            <tr>
              <td colSpan={7} className="text-right font-bold">
                Grand Total
              </td>
              <td className="text-right font-bold">
                {grandTotal.toFixed(2)}
              </td>
            </tr>

            {/* AMOUNT IN WORDS */}
            <tr>
              <td colSpan={8}>
                <strong>Amount in Words:</strong>{" "}
                {invoice.amountinwords ||
                  `${toWords(grandTotal)} Rupees`}
              </td>
            </tr>

            <tr>
              <td colSpan={5}>
                <strong>Terms & Condition :</strong>
                <br />
                1. Goods once sold will not be taken back.
                <br />
                2. Interest @18% p.a. will be charged if payment
                is not made within due date.
                <br />
                3. Our risk and responsibility ceases as soon as
                the goods leave our premises.
                <br />
                4. "Subject to RAJKOT Jurisdiction only. E.&.O.E"
              </td>
              <td colSpan={3} className="text-right align-bottom">
                For, {companyName || "---"}
                <br />
                <br />
                Authorised Signatory
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
);

export default PrintableInvoice;
