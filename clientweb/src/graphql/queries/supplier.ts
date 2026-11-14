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
