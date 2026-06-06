import { gql } from '@apollo/client';

export const SEND_OTP = gql`
  mutation SendOTP($adminId: ID!, $mobile: String!) {
    sendOTP(adminId: $adminId, mobile: $mobile) {
      success
      message
      otp
    }
  }
`;

export const VERIFY_OTP = gql`
  mutation VerifyOTP($adminId: ID!, $mobile: String!, $otp: String!) {
    verifyOTP(adminId: $adminId, mobile: $mobile, otp: $otp) {
      accessToken
      account {
        id
        name
        mobile
        email
        admin { id }
      }
    }
  }
`;

export const ADD_SALES_ORDER = gql`
  mutation AddSalesOrder($input: SalesOrderInput!) {
    addSalesOrder(input: $input) {
      id
      billnumber
      totalamount
      cancelStatus
    }
  }
`;

export const CANCEL_SALES_ORDER = gql`
  mutation CancelSalesOrder($id: ID!) {
    cancelSalesOrder(id: $id) {
      id
      cancelStatus
    }
  }
`;

export const ADD_ACCOUNT = gql`
  mutation AddAccount($input: AccountInput!) {
    addAccount(input: $input) {
      id
      accountcode
      name
      type
      mobile
      accountgroupid { id accountgroupname }
      channel { id channelName }
      region
      status
    }
  }
`;

export const ADD_PAYMENT = gql`
  mutation AddPayment($input: PaymentInput!) {
    addPayment(input: $input) {
      id
      paymentcode
      amount
      mode
      type
      partyid  { id name }
      ledgerid { id ledgername }
    }
  }
`;
