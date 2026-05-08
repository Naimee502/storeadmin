import { gql } from '@apollo/client';

export const ADD_PURCHASE_ORDER = gql`
  mutation AddPurchaseOrder($input: PurchaseOrderInput!) {
  addPurchaseOrder(input: $input) {
    id
    purchasemenid {
      id
      name
    }
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
    ordertype
    subtotal
    totaldiscount
    totalgst
    totalamount
    adminid
    branchid
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

export const EDIT_PURCHASE_ORDER = gql`
  mutation EditPurchaseOrder($id: ID!, $input: PurchaseOrderInput!) {
    editPurchaseOrder(id: $id, input: $input) {
      id
      purchasemenid {
        id
        name
      }
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
      ordertype
      subtotal
      totaldiscount
      totalgst
      totalamount
      adminid
      branchid
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
      isservice
      status
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_PURCHASE_ORDER = gql`
  mutation DeletePurchaseOrder($id: ID!) {
    deletePurchaseOrder(id: $id)
  }
`;

export const RESET_PURCHASE_ORDER = gql`
  mutation ResetPurchaseOrder($id: ID!) {
    resetPurchaseOrder(id: $id)
  }
`;
