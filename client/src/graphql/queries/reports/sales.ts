import { gql } from "@apollo/client";

// Sales Reports fields only.

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
