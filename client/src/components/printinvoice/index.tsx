import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { toWords } from 'number-to-words';

interface Product {
  productname: string;
  qty: number;
  rate: number;
  gst: number;
  hsn?: string;
}

interface Invoice {
  billtype_billnumber: string;
  billdate: string;
  partyacc: string;
  partyname?: string;
  placeofsupply?: string;
  gstin?: string;
  products: Product[];
  totalamount: number;
  amountinwords?: string;
  productname: string;
}

interface PrintableInvoiceProps {
  invoice: Invoice;
}

const PrintableInvoice = forwardRef<HTMLDivElement, PrintableInvoiceProps>(
  ({ invoice }, ref) => {
    const localRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => localRef.current!);

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
          .no-border {
            border: none;
          }
        `}</style>

        <table>
          <thead>
            {/* Header */}
            <tr>
              <td colSpan={7} className="text-center text-lg font-bold">
                Jay Balaji Mobile Accessories (Kalawad Road)
              </td>
            </tr>
            <tr>
              <td colSpan={7} className="text-center">
                Sagar Complex B/s Krishan Medical Store Kalawad Road<br />
                RAJKOT - 04 M-9104345676
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="text-left font-semibold">Online Memo</td>
              <td colSpan={4} className="text-right font-semibold">TAX INVOICE &nbsp;&nbsp;&nbsp; Original</td>
            </tr>

            {/* Product Table Header */}
            <tr className="text-center font-semibold">
              <th>SrNo</th>
              <th>Product Name</th>
              <th>HSN/SAC</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>GST</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>
            {/* Party and Invoice Info */}
            <tr>
              <td colSpan={2}><strong>M/S. :</strong> {invoice.partyname || "---"}</td>
              <td colSpan={2}><strong>Invoice No. :</strong> {invoice.billtype_billnumber}</td>
              <td colSpan={3}><strong>Place of Supply:</strong> {invoice.placeofsupply || "Rajkot"}</td>
            </tr>
            <tr>
              <td colSpan={2}><strong>GSTIN No.:</strong> {invoice.gstin || "24CGQPM7906P1ZJ"}</td>
              <td colSpan={2}><strong>Date:</strong> {invoice.billdate}</td>
              <td colSpan={3}><strong>Party A/c:</strong> {invoice.partyacc}</td>
            </tr>

            {/* Product Rows */}
            {invoice.products.map((item, idx) => (
              <tr key={idx}>
                <td className="text-center">{idx + 1}</td><td>{invoice.productname}</td><td className="text-center">{item.hsn || "-"}</td><td className="text-center">{item.qty}</td><td className="text-right">{item.rate.toFixed(2)}</td><td className="text-center">{item.gst}%</td><td className="text-right">{(item.qty * item.rate).toFixed(2)}</td>
              </tr>
            ))}

            {/* Subtotal */}
            <tr>
              <td colSpan={6}><strong>GSTIN No.:</strong> 24CGQPM7906P1ZJ</td>
              <td className="text-right"><strong>Sub Total</strong> {invoice.totalamount.toFixed(2)}</td>
            </tr>

            {/* Bank Details and Summary */}
            <tr>
              <td colSpan={4}>
                <strong>Bank Name:</strong> Bank of India<br />
                <strong>Bank A/C No.:</strong> 312720110000408<br />
                <strong>RTGS/IFSC Code:</strong> BKID0003127
              </td>
              <td colSpan={3}>
                <p><strong>Total Discount:</strong> 0.00</p>
                <p><strong>Other Tax Amount:</strong> 0</p>
              </td>
            </tr>

            <tr>
              <td colSpan={4}><strong>Bill Amount:</strong> {invoice.amountinwords || toWords(invoice.totalamount) + " Rupees"}</td>
              <td colSpan={3}><strong>Grand Total:</strong> {invoice.totalamount.toFixed(2)}</td>
            </tr>

            {/* Notes / Terms */}
            <tr>
              <td colSpan={7}><strong>Notes:</strong></td>
            </tr>
            <tr>
              <td colSpan={5}>
                <strong>Terms & Condition :</strong><br />
                1. Goods once sold will not be taken back.<br />
                2. Interest @18% p.a. will be charged if payment is not made within due date.<br />
                3. Our risk and responsibility ceases as soon as the goods leave our premises.<br />
                4. "Subject to RAJKOT Jurisdiction only. E.&.O.E"
              </td>
              <td colSpan={2} className="text-right align-bottom">
                For, Jay Balaji Mobile Accessories (Kalawad Road)<br /><br />
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
