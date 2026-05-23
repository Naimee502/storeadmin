import { gql } from "@apollo/client";

const PURCHASE_RETURN_FIELDS = `
  id
  sourceInvoiceId
  sourceBillNumber
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
    purchaseunitid { id unitname }
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
  othercharges {
    ledgerid { id ledgername }
    amount
    gstpercent
    gstamount
    totalamount
    remarks
  }
  deliverydate
  duedate
  transportname
  vehiclenumber
  ewaybillno
  distance
  roundoff
  invoicediscount
  invoicediscounttype
  isservice
  autocreate
  createdby_id
  createdby_name
  createdby_type
  status
  createdAt
  updatedAt
`;

export const GET_PURCHASE_RETURNS = gql`
  query GetPurchaseReturns($filter: PurchaseReturnFilterInput) {
    getPurchaseReturns(filter: $filter) {
      ${PURCHASE_RETURN_FIELDS}
    }
  }
`;

export const GET_DELETED_PURCHASE_RETURNS = gql`
  query GetDeletedPurchaseReturns($filter: PurchaseReturnFilterInput) {
    getDeletedPurchaseReturns(filter: $filter) {
      ${PURCHASE_RETURN_FIELDS}
    }
  }
`;

export const GET_PURCHASE_RETURN_BY_ID = gql`
  query GetPurchaseReturnById($id: ID!, $adminid: ID) {
    getPurchaseReturnById(id: $id, adminid: $adminid) {
      ${PURCHASE_RETURN_FIELDS}
    }
  }
`;
