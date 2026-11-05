import { gql } from "@apollo/client";

// GST report (pages/reports/gst) — lite selections: only the fields that page
// reads. Same root fields/filters as the full queries, so scoping is identical.
// NOTE: billdateFrom/billdateTo are NOT passed for invoices — the server casts
// them with new Date() against a String billdate, which never matches; the page
// filters invoice dates client-side instead.

export const GST_REPORT_SALES_INVOICES = gql`
  query GstReportSalesInvoices($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
      id
      billnumber
      billdate
      partyacc { id accountname mobile city gstnumber }
      totalamount
      productservice {
        productserviceid { id name }
        qty
        amount
      }
      cancelStatus
    }
  }
`;

export const GST_REPORT_PURCHASE_INVOICES = gql`
  query GstReportPurchaseInvoices($filter: PurchaseInvoiceFilterInput) {
    getPurchaseInvoices(filter: $filter) {
      id
      billnumber
      billdate
      partyacc { id accountname mobile city gstnumber }
      totalamount
      productservice {
        productserviceid { id name }
        qty
        amount
      }
      cancelStatus
    }
  }
`;

// Journal lines only — the page sums the Input/Output CGST/SGST/IGST ledgers
// per source document.
export const GST_REPORT_TRANSACTIONS = gql`
  query GstReportTransactions($filter: TransactionFilterInput) {
    getTransactions(filter: $filter) {
      id
      source { docid }
      entries {
        ledgerid { id ledgername }
        debit
        credit
      }
    }
  }
`;
