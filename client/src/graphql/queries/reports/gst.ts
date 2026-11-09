import { gql } from "@apollo/client";

// GST report fields; invoice dates filtered client-side (server billdate filter never matches).

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

// e-Invoice / e-Way Bill reports: GST portal details per invoice.
export const GST_PORTAL_REPORT_INVOICES = gql`
  query GstPortalReportInvoices($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
      id
      billnumber
      billdate
      partyacc { id accountname mobile city state gstnumber }
      totalgst
      totalamount
      vehiclenumber
      irn
      irnAckNo
      irnAckDate
      irnStatus
      ewaybillno
      ewaybilldate
      ewaybillvalidupto
      sourcechallanid
      cancelStatus
      status
    }
  }
`;
