import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { toWords } from "number-to-words";
import { useAppSelector } from "../../redux/hooks";
import { formatDateTimeDMY, formatDateDMY } from "../../utils/helper";

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
  // Party's running-account balance, fetched lazily on Print click — see
  // Business Settings → Invoice Print → "Show party's Previous/Current Balance".
  partyPreviousBalance?: number;
  partyCurrentBalance?: number;
}

interface PrintableInvoiceProps {
  invoice: Invoice;
}

// Fallback shown if the admin hasn't customised Terms & Conditions yet
// (mirrors AdminSettings.printTermsAndConditions default on the server).
const DEFAULT_TERMS =
  '1. Goods once sold will not be taken back.\n' +
  '2. Interest @18% p.a. will be charged if payment is not made within due date.\n' +
  '3. Our risk and responsibility ceases as soon as the goods leave our premises.\n' +
  '4. "Subject to RAJKOT Jurisdiction only. E.&.O.E"';

/* ================= COMPONENT ================= */
const PrintableInvoice = forwardRef<HTMLDivElement, PrintableInvoiceProps>(
  ({ invoice }, ref) => {
    const localRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => localRef.current!);

    const auth = useAppSelector((state) => state.auth);
    const branch = auth.branch;
    // Resolve the owning Admin record regardless of who is logged in
    // (admin / branch / staff) so the print header can use the admin's
    // company address & mobile instead of the branch's.
    const adminInfo: any =
      auth.type === "admin"
        ? auth.admin
        : auth.type === "branch"
          ? auth.branch?.admin
          : auth.type === "staff"
            ? auth.staff?.admin
            : null;
    const companyName = adminInfo?.companyName;
    const companyAddress = adminInfo?.address || branch?.address;
    const companyMobile = adminInfo?.mobile || branch?.phone || branch?.mobile;

    const { settings } = useAppSelector((state: any) => state.adminsettings);

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

    const invDisc = invoice.invoicediscount || 0;
    const computedInvDisc = invoice.invoicediscounttype === "percent" ? (taxableTotal * invDisc) / 100 : invDisc;

    const otherChargesTotal = (invoice.othercharges || []).reduce((sum, c) => sum + (c.totalamount || 0), 0);
    const roundOff = invoice.roundoff || 0;

    const grandTotal = (productsTotal - totalDiscount) + totalGST - computedInvDisc + otherChargesTotal + roundOff;

    const encrypt = !!settings?.encryptInvoicePrices;
    const mask = (val: number) => encrypt ? val / 10 : val;

    // Print layout customisation (Business Settings → Invoice Print)
    const showTerms = settings?.printShowTermsAndConditions !== false;
    const showSignatureCompanyName = settings?.printShowCompanyNameInSignature !== false;
    const termsLines = (settings?.printTermsAndConditions || DEFAULT_TERMS)
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);

    // Party's running balance — only shown when the admin has opted in AND
    // the caller actually fetched it (Print click), so other invoice/print
    // flows (e.g. WhatsApp share, Purchase Invoice) are unaffected.
    const showPartyBalance =
      settings?.printShowPartyBalance === true &&
      invoice.partyPreviousBalance !== undefined &&
      invoice.partyCurrentBalance !== undefined;

    return (
      <div ref={localRef} className="inv-root">
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
          .inv-root {
            width: 100%;
            padding: 16px;
            background: #ffffff;
            color: #111111;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.5;
          }
          .inv-box {
            border: 1.5px solid #111111;
          }

          /* ---- Header ---- */
          .inv-company {
            text-align: center;
            padding: 14px 16px 4px;
          }
          .inv-company-name {
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin: 0;
          }
          .inv-company-addr {
            font-size: 11.5px;
            color: #333333;
            margin-top: 4px;
            padding-bottom: 10px;
          }
          .inv-titlebar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #111111;
            border-bottom: 1px solid #111111;
            padding: 7px 12px;
            font-weight: 700;
            font-size: 12.5px;
            background: #f3f4f6;
          }

          /* ---- Meta grid ---- */
          .inv-meta {
            display: flex;
            flex-wrap: wrap;
            border-bottom: 1px solid #111111;
          }
          .inv-meta-cell {
            flex: 1 1 33.33%;
            min-width: 0;
            padding: 8px 12px;
            border-right: 1px solid #cccccc;
            border-bottom: 1px solid #cccccc;
          }
          .inv-meta-cell.no-right-border {
            border-right: none;
          }
          .inv-meta-cell.no-bottom-border {
            border-bottom: none;
          }
          .inv-meta-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #555555;
            margin-bottom: 2px;
          }
          .inv-meta-value {
            font-size: 12px;
            font-weight: 600;
            word-break: break-word;
          }

          /* ---- Items table ---- */
          .inv-table {
            width: 100%;
            border-collapse: collapse;
          }
          .inv-table th {
            background: #f3f4f6;
            border-top: 1px solid #111111;
            border-bottom: 1px solid #111111;
            border-right: 1px solid #cccccc;
            padding: 8px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            text-align: center;
            white-space: nowrap;
          }
          .inv-table th:last-child {
            border-right: none;
          }
          .inv-table td {
            border-bottom: 1px solid #dddddd;
            border-right: 1px solid #dddddd;
            padding: 7px 8px;
            vertical-align: top;
          }
          .inv-table td:last-child {
            border-right: none;
          }
          .inv-table .num {
            text-align: right;
            white-space: nowrap;
          }
          .inv-table .ctr {
            text-align: center;
            white-space: nowrap;
          }

          /* ---- Totals ---- */
          .inv-totals {
            display: flex;
            justify-content: flex-end;
            border-top: 1px solid #111111;
            /* Guarantee a full-width divider below Grand Total — this sits
               on the full-width flex container itself (not the 46%-wide
               floated totals box), so it always spans edge to edge. */
            border-bottom: 1px solid #111111;
          }
          .inv-totals-box {
            width: 46%;
            min-width: 240px;
          }
          .inv-totals-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 12px;
            border-bottom: 1px solid #eeeeee;
          }
          .inv-totals-row .lbl {
            font-weight: 600;
            color: #333333;
          }
          .inv-totals-row.grand {
            border-top: 1.5px solid #111111;
            border-bottom: none;
            background: #f3f4f6;
            padding: 8px 12px;
            font-size: 14px;
            font-weight: 700;
          }
          .inv-totals-row.inv-balance-row {
            border-bottom: 1px solid #eeeeee;
          }
          .inv-totals-row.inv-balance-row:first-of-type {
            border-top: 1px solid #dddddd;
          }
          .inv-totals-row.inv-balance-row:last-of-type {
            border-bottom: 1px solid #111111;
            font-weight: 700;
          }

          /* ---- Words / footer ---- */
          .inv-words {
            border-top: 1px solid #111111;
            padding: 9px 12px;
          }
          .inv-footer {
            display: flex;
            border-top: 1px solid #111111;
          }
          .inv-terms {
            flex: 1 1 62%;
            padding: 10px 12px;
            border-right: 1px solid #111111;
            font-size: 11px;
            line-height: 1.7;
          }
          .inv-sign {
            flex: 1 1 38%;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            /* Content anchors to the bottom, leaving blank space above for a
               physical signature — looks intentional whether 1 or 2 lines
               (company name row optional) are actually rendered. */
            justify-content: flex-end;
            text-align: right;
            min-height: 90px;
          }
          .inv-sign.standalone {
            /* When the Terms & Conditions column is hidden, don't stretch
               this block across the full row — keep it a normal-sized,
               right-aligned signature box instead of a big empty strip. */
            flex: 0 0 auto;
            width: 260px;
            margin-left: auto;
          }
        `}</style>

        <div className="inv-box">
          {/* ---- Company header ---- */}
          {settings?.printShowCompanyHeader !== false && (
            <div className="inv-company">
              <p className="inv-company-name">{companyName || "---"}</p>
              <div className="inv-company-addr">
                {companyAddress || "---"}
                <br />
                {[branch?.city, companyMobile].filter(Boolean).join(" - ")}
              </div>
            </div>
          )}

          <div className="inv-titlebar">
            <span>Online Memo</span>
            <span>TAX INVOICE &nbsp;|&nbsp; Original</span>
          </div>

          {/* ---- Invoice meta ---- */}
          <div className="inv-meta">
            {(() => {
              const cells = [
                { label: "M/S.", value: invoice.partyname || "---" },
                { label: "Invoice No.", value: invoice.billtype_billnumber },
                { label: "Place of Supply", value: invoice.placeofsupply || "---" },
                { label: "Transport / Vehicle No", value: `${invoice.transportname || "---"} / ${invoice.vehiclenumber || "---"}` },
              ];
              if (settings?.printShowEwayBillDistance !== false) {
                cells.push({ label: "E-Way Bill / Distance", value: `${invoice.ewaybillno || "---"} / ${invoice.distance ? `${invoice.distance} km` : "---"}` });
              }
              if (settings?.printShowDeliveryDueDate !== false) {
                cells.push({ label: "Delivery / Due Date", value: `${invoice.deliverydate ? formatDateDMY(invoice.deliverydate) : "---"} / ${invoice.duedate ? formatDateDMY(invoice.duedate) : "---"}` });
              }
              if (settings?.printShowGstin !== false) {
                cells.push({ label: "GSTIN No.", value: invoice.gstin || "---" });
              }
              cells.push({ label: "Date", value: formatDateTimeDMY((invoice as any).billdateRaw ?? invoice.billdate, (invoice as any).createdAt) });
              cells.push({ label: "Party A/c", value: invoice.partyacc });

              const lastRowStartIndex = Math.floor((cells.length - 1) / 3) * 3;
              return cells.map((cell, idx) => (
                <div 
                  key={idx} 
                  className={`inv-meta-cell ${idx % 3 === 2 ? 'no-right-border' : ''} ${idx >= lastRowStartIndex ? 'no-bottom-border' : ''}`}
                >
                  <div className="inv-meta-label">{cell.label}</div>
                  <div className="inv-meta-value">{cell.value}</div>
                </div>
              ));
            })()}
          </div>

          {/* ---- Items ---- */}
          {(() => {
            const showHsn = settings?.printShowHsnColumn !== false;
            const showGst = settings?.printShowGstColumn !== false;
            let nameWidth = 34;
            if (!showHsn) nameWidth += 9;
            if (!showGst) nameWidth += 8;

            return (
              <table className="inv-table">
                <thead>
                  <tr>
                    <th style={{ width: "6%" }}>Sr</th>
                    <th style={{ width: `${nameWidth}%`, textAlign: "left" }}>Product Name</th>
                    {showHsn && <th style={{ width: "9%" }}>HSN</th>}
                    <th style={{ width: "8%" }}>Qty</th>
                    <th style={{ width: "12%" }}>Rate</th>
                    <th style={{ width: "10%" }}>Disc</th>
                    {showGst && <th style={{ width: "8%" }}>GST%</th>}
                    <th style={{ width: "13%" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((item, idx) => {
                    const base = item.qty * item.rate;
                    const discount = item.discount || 0;
                    const taxable = base - discount;
                    const gstAmt = (taxable * item.gst) / 100;
                    const total = taxable + gstAmt;

                    return (
                      <tr key={idx}>
                        <td className="ctr">{idx + 1}</td>
                        <td>
                          {item.productserviceid.name}
                          {item.variantid?.name && ` - ${item.variantid.name}`}
                          {item.salesunitid?.unitname &&
                            ` (${item.salesunitid.unitname})`}
                        </td>
                        {showHsn && <td className="ctr">{item.hsn || "-"}</td>}
                        <td className="ctr">{item.qty}</td>
                        <td className="num">{mask(item.rate).toFixed(2)}</td>
                        <td className="num">{mask(discount).toFixed(2)}</td>
                        {showGst && <td className="ctr">{item.gst}</td>}
                        <td className="num">{mask(total).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}

          {/* ---- Totals ---- */}
          <div className="inv-totals">
            <div className="inv-totals-box">
              <div className="inv-totals-row">
                <span className="lbl">Sub Total</span>
                <span>{mask(productsTotal).toFixed(2)}</span>
              </div>
              <div className="inv-totals-row">
                <span className="lbl">Total Discount</span>
                <span>{mask(totalDiscount).toFixed(2)}</span>
              </div>
              {settings?.printShowTotalGst !== false && (
                <div className="inv-totals-row">
                  <span className="lbl">Total GST</span>
                  <span>{mask(totalGST).toFixed(2)}</span>
                </div>
              )}
              {(invoice.othercharges || []).map((c, idx) => (
                <div className="inv-totals-row" key={`oc-${idx}`}>
                  <span className="lbl">
                    {c.ledgername || c.ledgerid?.ledgername || "Other Charge"}
                  </span>
                  <span>{mask(c.totalamount || 0).toFixed(2)}</span>
                </div>
              ))}
              {computedInvDisc > 0 && (
                <div className="inv-totals-row">
                  <span className="lbl">Invoice Discount</span>
                  <span>{mask(computedInvDisc).toFixed(2)}</span>
                </div>
              )}
              {roundOff !== 0 && (
                <div className="inv-totals-row">
                  <span className="lbl">Round Off</span>
                  <span>{mask(roundOff).toFixed(2)}</span>
                </div>
              )}
              <div className="inv-totals-row grand">
                <span>Grand Total</span>
                <span>{mask(grandTotal).toFixed(2)}</span>
              </div>
              {showPartyBalance && (
                <>
                  <div className="inv-totals-row inv-balance-row">
                    <span className="lbl">Previous Balance</span>
                    <span>{mask(invoice.partyPreviousBalance || 0).toFixed(2)}</span>
                  </div>
                  <div className="inv-totals-row inv-balance-row">
                    <span className="lbl">Current Balance</span>
                    <span>{mask(invoice.partyCurrentBalance || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ---- Amount in words ---- */}
          <div className="inv-words">
            <strong>Amount in Words:</strong>{" "}
            {invoice.amountinwords ||
              `${toWords(Math.round(mask(grandTotal)))} Rupees`}
          </div>

          {/* ---- Terms & signature ---- */}
          <div className="inv-footer">
            {showTerms && (
              <div className="inv-terms">
                <strong>Terms &amp; Condition :</strong>
                <br />
                {termsLines.map((line, idx) => (
                  <React.Fragment key={idx}>
                    {line}
                    {idx < termsLines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            )}
            <div className={`inv-sign${showTerms ? "" : " standalone"}`}>
              {showSignatureCompanyName && (
                <div>
                  <strong>For, {companyName || "---"}</strong>
                </div>
              )}
              <div>Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default PrintableInvoice;
