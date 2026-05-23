import { gql } from '@apollo/client';

// 🔹 Add Purchase Invoice
export const ADD_PURCHASE_INVOICE = gql`
  mutation AddPurchaseInvoice($input: PurchaseInvoiceInput!) {
    addPurchaseInvoice(input: $input) {
      id
      branchid
      adminid
      paymenttype
      partyacc {
        id
        accountname
        mobile
      }
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
      productservice {
        productserviceid {
          id
          name
        }
        variantid {
          id
          name
        }
        purchaseunitid {
          id
          unitname
        }
        unitqty
        gst
        qty
        rate
        amount
        discount
        salesaccountid {
          id
          ledgername
        }
        purchaseaccountid {
          id
          ledgername
        }
        serviceaccountid {
          id
          ledgername
        }
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
      createdby_id
      createdby_name
      createdby_type
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
      adminid
      paymenttype
      partyacc {
        id
        accountname
        mobile
      }
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
      productservice {
        productserviceid {
          id
          name
        }
        variantid {
          id
          name
        }
        purchaseunitid {
          id
          unitname
        }
        unitqty
        gst
        qty
        rate
        amount
        discount
        salesaccountid {
          id
          ledgername
        }
        purchaseaccountid {
          id
          ledgername
        }
        serviceaccountid {
          id
          ledgername
        }
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
      createdby_id
      createdby_name
      createdby_type
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
