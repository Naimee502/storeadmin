import { gql } from "@apollo/client";

const SALES_RETURN_FIELDS = `
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
    salesunitid { id unitname }
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
  roundoff
  invoicediscount
  invoicediscounttype
  isservice
  autocreate
  status
  createdAt
  updatedAt
`;

export const ADD_SALES_RETURN = gql`
  mutation AddSalesReturn($input: SalesReturnInput!) {
    addSalesReturn(input: $input) {
      ${SALES_RETURN_FIELDS}
    }
  }
`;

export const EDIT_SALES_RETURN = gql`
  mutation EditSalesReturn($id: ID!, $input: SalesReturnInput!) {
    editSalesReturn(id: $id, input: $input) {
      ${SALES_RETURN_FIELDS}
    }
  }
`;

export const DELETE_SALES_RETURN = gql`
  mutation DeleteSalesReturn($id: ID!) {
    deleteSalesReturn(id: $id)
  }
`;

export const RESET_SALES_RETURN = gql`
  mutation ResetSalesReturn($id: ID!) {
    resetSalesReturn(id: $id)
  }
`;
