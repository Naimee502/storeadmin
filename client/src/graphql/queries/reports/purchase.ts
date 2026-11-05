import { gql } from "@apollo/client";

// Purchase Reports page only — just what each report row / filter reads.
// Line items carry only name, variant and qty (the Product(s) cell, the
// Product filter and Total Qty); everything else is header-level.

const PURCHASE_REPORT_PARTY = `
  partyacc {
    id
    accountname
    mobile
    city
  }
`;

const PURCHASE_REPORT_LINES = `
  productservice {
    productserviceid { id name }
    variantid { id name }
    qty
  }
`;

export const GET_PURCHASE_INVOICES_REPORT = gql`
  query GetPurchaseInvoicesReport($filter: PurchaseInvoiceFilterInput) {
    getPurchaseInvoices(filter: $filter) {
      id
      billnumber
      billdate
      paymenttype
      ${PURCHASE_REPORT_PARTY}
      ${PURCHASE_REPORT_LINES}
      totaldiscount
      totalgst
      totalamount
      cancelStatus
      status
    }
  }
`;

export const GET_DELETED_PURCHASE_INVOICES_REPORT = gql`
  query GetDeletedPurchaseInvoicesReport($filter: PurchaseInvoiceFilterInput) {
    getDeletedPurchaseInvoices(filter: $filter) {
      id
      billnumber
      billdate
      paymenttype
      ${PURCHASE_REPORT_PARTY}
      ${PURCHASE_REPORT_LINES}
      totaldiscount
      totalgst
      totalamount
      cancelStatus
      status
    }
  }
`;

export const GET_PURCHASE_ORDERS_REPORT = gql`
  query GetPurchaseOrdersReport($filter: PurchaseOrderFilterInput) {
    getPurchaseOrders(filter: $filter) {
      id
      billnumber
      billdate
      paymenttype
      ${PURCHASE_REPORT_PARTY}
      ${PURCHASE_REPORT_LINES}
      totaldiscount
      totalgst
      totalamount
      status
      isConverted
      cancelStatus
      orderStatus
    }
  }
`;

export const GET_PURCHASE_RETURNS_REPORT = gql`
  query GetPurchaseReturnsReport($filter: PurchaseReturnFilterInput) {
    getPurchaseReturns(filter: $filter) {
      id
      billnumber
      returndate
      sourceBillNumber
      paymenttype
      ${PURCHASE_REPORT_PARTY}
      ${PURCHASE_REPORT_LINES}
      totaldiscount
      totalgst
      totalamount
      refundMode
      reason
      status
    }
  }
`;

// Dropdown options only: Party (Vendor) and Product filters.
export const GET_PURCHASE_REPORT_PARTIES = gql`
  query GetPurchaseReportParties($filter: AccountFilterInput) {
    getAccounts(filter: $filter) {
      id
      name
      mobile
      city
      type
    }
  }
`;

export const GET_PURCHASE_REPORT_PRODUCTS = gql`
  query GetPurchaseReportProducts($filter: ProductServiceFilterInput, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id
      name
    }
  }
`;
