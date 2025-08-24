import { gql } from '@apollo/client';

// 🔹 Add Purchase Invoice
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
      adminid
      productservice {
        productserviceid
        variantid
        purchaseunitid
        gst
        qty
        rate
        amount
        discount
        purchaseaccountid
        salesaccountid
        serviceaccountid
      }
      isservice
      status
      createdAt
      updatedAt
    }
  }
`;

// 🔹 Edit Purchase Invoice
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
      adminid
      productservice {
        productserviceid
        variantid
        purchaseunitid
        gst
        qty
        rate
        amount
        discount
        purchaseaccountid
        salesaccountid
        serviceaccountid
      }
      isservice
      status
      createdAt
      updatedAt
    }
  }
`;

// 🔹 Delete Purchase Invoice
export const DELETE_PURCHASE_INVOICE = gql`
  mutation DeletePurchaseInvoice($id: ID!) {
    deletePurchaseInvoice(id: $id)
  }
`;

// 🔹 Reset Purchase Invoice
export const RESET_PURCHASE_INVOICE = gql`
  mutation ResetPurchaseInvoice($id: ID!) {
    resetPurchaseInvoice(id: $id)
  }
`;
