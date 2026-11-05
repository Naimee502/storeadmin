import { gql } from "@apollo/client";

// Product statement report (pages/reports/product) — lite selections: only
// what the page reads. Same root fields/filters as the full queries.

// Product picker (id + name). Same variables as useProductServicesQuery.
// Variant id/name too: transfer and adjustment lines carry a bare variant id.
export const PRODUCT_REPORT_PRODUCT_OPTIONS = gql`
  query ProductReportProductOptions($filter: ProductServiceFilterInput, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id
      name
      productvariants { id name }
    }
  }
`;

const INVOICE_FIELDS = `
  id
  billnumber
  billdate
  partyacc { id accountname mobile city }
  productservice {
    productserviceid { id }
    variantid { id name }
    qty
    rate
    amount
  }
  cancelStatus
  cancelledAt
  cancelReason
`;

export const PRODUCT_REPORT_SALES_INVOICES = gql`
  query ProductReportSalesInvoices($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
      ${INVOICE_FIELDS}
    }
  }
`;

export const PRODUCT_REPORT_PURCHASE_INVOICES = gql`
  query ProductReportPurchaseInvoices($filter: PurchaseInvoiceFilterInput) {
    getPurchaseInvoices(filter: $filter) {
      ${INVOICE_FIELDS}
    }
  }
`;

const RETURN_FIELDS = `
  id
  billnumber
  returndate
  reason
  partyacc { id accountname mobile city }
  productservice {
    productserviceid { id }
    variantid { id name }
    qty
    rate
    amount
  }
  createdAt
`;

export const PRODUCT_REPORT_SALES_RETURNS = gql`
  query ProductReportSalesReturns($filter: SalesReturnFilterInput) {
    getSalesReturns(filter: $filter) {
      ${RETURN_FIELDS}
    }
  }
`;

export const PRODUCT_REPORT_PURCHASE_RETURNS = gql`
  query ProductReportPurchaseReturns($filter: PurchaseReturnFilterInput) {
    getPurchaseReturns(filter: $filter) {
      ${RETURN_FIELDS}
    }
  }
`;

// Stock transfers — a voucher keeps its products in items[] (one line per
// product/variant). Same root field/arguments as GET_TRANSFER_STOCKS.
export const PRODUCT_REPORT_TRANSFER_STOCKS = gql`
  query ProductReportTransferStocks($adminId: ID, $frombranchid: ID) {
    getTransferStocks(adminId: $adminId, frombranchid: $frombranchid) {
      id
      vouchernumber
      frombranchid
      tobranchid
      transferdate
      narration
      items {
        productid
        variantid
        transferqty
        rate
        amount
      }
    }
  }
`;

// Branch names for the transfer from/to column. Same as GET_BRANCHES' root.
export const PRODUCT_REPORT_BRANCHES = gql`
  query ProductReportBranches($adminId: ID) {
    getBranches(adminId: $adminId) {
      id
      branchname
    }
  }
`;

// Stock adjustments with their line items (Excess = stock in, Shortage = out).
export const PRODUCT_REPORT_STOCK_ADJUSTMENTS = gql`
  query ProductReportStockAdjustments($filter: StockAdjustmentFilterInput, $limit: Int, $offset: Int) {
    getStockAdjustments(filter: $filter, limit: $limit, offset: $offset) {
      id
      vouchernumber
      adjustmentdate
      type
      reason
      createdAt
      items {
        productid { id }
        variantid
        quantity
        rate
        amount
      }
    }
  }
`;
