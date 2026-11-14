import { gql } from "@apollo/client";

/** Where the website keeps a supplier's login for one business. */
export const supplierTokenKey = (adminid?: string | null) => `supplierToken:${adminid || ""}`;

export const LOGIN_SUPPLIER = gql`
  mutation LoginSupplier($adminId: ID!, $mobile: String!, $otp: String) {
    loginSupplier(adminId: $adminId, mobile: $mobile, otp: $otp) {
      accessToken
      name
    }
  }
`;

export const GET_SUPPLIER_PORTAL = gql`
  query GetSupplierPortal {
    getSupplierPortal {
      name
      company
      mobile
      payable
      orders { id billnumber billdate totalamount items orderStatus }
      bills { id billnumber billdate totalamount outstanding }
      payments { id paymentcode paymentdate type mode amount reference }
    }
  }
`;

const DOC_FIELDS = `
  id kind billnumber billdate duedate orderStatus notes suppliernote
  subtotal totaldiscount totalgst roundoff totalamount outstanding editable
  lines { lineid name unit qty rate discount gst amount }
  charges { name amount }
`;

export const GET_SUPPLIER_DOCUMENT = gql`
  query GetSupplierDocument($kind: String!, $id: ID!) {
    getSupplierDocument(kind: $kind, id: $id) { ${DOC_FIELDS} }
  }
`;

export const UPDATE_SUPPLIER_ORDER = gql`
  mutation UpdateSupplierOrder($id: ID!, $lines: [SupplierOrderLineInput!]!, $note: String) {
    updateSupplierOrder(id: $id, lines: $lines, note: $note) { ${DOC_FIELDS} }
  }
`;

export const SUPPLIER_PRINT_LINK = gql`
  mutation SupplierPrintLink($kind: String!, $id: ID!) {
    supplierPrintLink(kind: $kind, id: $id)
  }
`;

export const GET_SUPPLIER_NAME = gql`
  query GetSupplierName {
    getSupplierPortal { name }
  }
`;
