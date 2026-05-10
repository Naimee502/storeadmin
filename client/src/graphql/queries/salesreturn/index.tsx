import { gql } from "@apollo/client";

const SALES_RETURN_FIELDS = `
  id
  sourceInvoiceId
  sourceBillNumber
  salesmenid { id name }
  paymenttype
  partyacc { id accountname mobile }
  taxorsupplytype
  returndate
  billtype
  billnumber
  notes
  reason
  refundMode
  invoicetype
  subtotal
  totaldiscount
  totalgst
  totalamount
  adminid
  branchid
  productservice {
    productserviceid { id name }
    variantid { id name }
    salesunitid { id unitname }
    salesaccountid { id ledgername }
    purchaseaccountid { id ledgername }
    serviceaccountid { id ledgername }
    unitqty
    gst
    qty
    rate
    amount
    discount
  }
  isservice
  autocreate
  createdby_id
  createdby_name
  createdby_type
  status
  createdAt
  updatedAt
`;

export const GET_SALES_RETURNS = gql`
  query GetSalesReturns($filter: SalesReturnFilterInput) {
    getSalesReturns(filter: $filter) {
      ${SALES_RETURN_FIELDS}
    }
  }
`;

export const GET_DELETED_SALES_RETURNS = gql`
  query GetDeletedSalesReturns($filter: SalesReturnFilterInput) {
    getDeletedSalesReturns(filter: $filter) {
      ${SALES_RETURN_FIELDS}
    }
  }
`;

export const GET_SALES_RETURN_BY_ID = gql`
  query GetSalesReturnById($id: ID!, $adminid: ID) {
    getSalesReturnById(id: $id, adminid: $adminid) {
      ${SALES_RETURN_FIELDS}
    }
  }
`;
