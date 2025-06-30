import { gql } from '@apollo/client';

export const ADD_PURCHASE_INVOICE = gql`
  mutation AddPurchaseInvoice($input: PurchaseInvoiceInput!) {
    addPurchaseInvoice(input: $input) {
      id
      branchid
      paymenttype
      partyacc
      taxorsupplytype
      billdate
      billtype
      billnumber
      notes
      invoicetype
      subtotal
      totaldiscount
      totalgst
      totalamount
      products {
        productid
        gst
        qty
        rate
        amount
        discount
      }
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const EDIT_PURCHASE_INVOICE = gql`
  mutation EditPurchaseInvoice($id: ID!, $input: PurchaseInvoiceInput!) {
    editPurchaseInvoice(id: $id, input: $input) {
      id
      branchid
      paymenttype
      partyacc
      taxorsupplytype
      billdate
      billtype
      billnumber
      notes
      invoicetype
      subtotal
      totaldiscount
      totalgst
      totalamount
      products {
        productid
        gst
        qty
        rate
        amount
        discount
      }
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const DELETE_PURCHASE_INVOICE = gql`
  mutation DeletePurchaseInvoice($id: ID!) {
    deletePurchaseInvoice(id: $id)
  }
`;

export const RESET_PURCHASE_INVOICE = gql`
  mutation ResetPurchaseInvoice($id: ID!) {
    resetPurchaseInvoice(id: $id)
  }
`;
