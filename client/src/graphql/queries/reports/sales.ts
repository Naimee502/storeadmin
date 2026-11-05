import { gql } from "@apollo/client";

// Lite queries for the Sales Reports page (pages/reports/sales). Only the
// fields the report rows and filters read — no ledgers, other charges,
// transport or audit fields — so a 30-day report doesn't drag every heavy
// invoice/order/return document over the wire.

const REPORT_PARTY = `
  partyacc {
    id
    accountname
    mobile
    city
  }
`;

const REPORT_LINES = `
  productservice {
    productserviceid { id name }
    variantid { id name }
    salesunitid { id unitname }
    qty
  }
`;

export const GET_SALES_INVOICES_REPORT = gql`
  query GetSalesInvoicesReport($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
      id
      billnumber
      billdate
      paymenttype
      ${REPORT_PARTY}
      ${REPORT_LINES}
      totaldiscount
      totalgst
      totalamount
      cancelStatus
      status
    }
  }
`;

export const GET_DELETED_SALES_INVOICES_REPORT = gql`
  query GetDeletedSalesInvoicesReport($filter: SalesInvoiceFilterInput) {
    getDeletedSalesInvoices(filter: $filter) {
      id
      billnumber
      billdate
      paymenttype
      ${REPORT_PARTY}
      ${REPORT_LINES}
      totaldiscount
      totalgst
      totalamount
      cancelStatus
      status
    }
  }
`;

export const GET_SALES_ORDERS_REPORT = gql`
  query GetSalesOrdersReport($filter: SalesOrderFilterInput) {
    getSalesOrders(filter: $filter) {
      id
      billnumber
      billdate
      paymenttype
      ${REPORT_PARTY}
      ${REPORT_LINES}
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

export const GET_SALES_RETURNS_REPORT = gql`
  query GetSalesReturnsReport($filter: SalesReturnFilterInput) {
    getSalesReturns(filter: $filter) {
      id
      billnumber
      returndate
      sourceBillNumber
      paymenttype
      ${REPORT_PARTY}
      ${REPORT_LINES}
      totaldiscount
      totalgst
      totalamount
      refundMode
      reason
      status
    }
  }
`;
