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
    unitqty
    gst
    qty
    rate
    amount
    discount
  }
  isservice
  autocreate
  status
  createdAt
  updatedAt
`;

export const ADD_PURCHASE_RETURN = gql`
  mutation AddPurchaseReturn($input: PurchaseReturnInput!) {
    addPurchaseReturn(input: $input) {
      ${PURCHASE_RETURN_FIELDS}
    }
  }
`;

export const EDIT_PURCHASE_RETURN = gql`
  mutation EditPurchaseReturn($id: ID!, $input: PurchaseReturnInput!) {
    editPurchaseReturn(id: $id, input: $input) {
      ${PURCHASE_RETURN_FIELDS}
    }
  }
`;

export const DELETE_PURCHASE_RETURN = gql`
  mutation DeletePurchaseReturn($id: ID!) {
    deletePurchaseReturn(id: $id)
  }
`;

export const RESET_PURCHASE_RETURN = gql`
  mutation ResetPurchaseReturn($id: ID!) {
    resetPurchaseReturn(id: $id)
  }
`;
