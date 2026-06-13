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

export const EDIT_SALES_ORDER = gql`
  mutation EditSalesOrder($id: ID!, $input: SalesOrderInput!) {
    editSalesOrder(id: $id, input: $input) {
      id billnumber totalamount orderStatus
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

export const CONFIRM_SALES_ORDER = gql`
  mutation ConfirmSalesOrder($id: ID!) {
    confirmSalesOrder(id: $id) {
      id orderStatus isConverted
    }
  }
`;

export const CONVERT_SALES_ORDER_TO_INVOICE = gql`
  mutation ConvertSalesOrderToInvoice($id: ID!) {
    convertSalesOrderToInvoice(id: $id) {
      id billnumber totalamount
    }
  }
`;

export const MARK_SALES_ORDER_DELIVERED = gql`
  mutation MarkSalesOrderDelivered($id: ID!, $byId: ID, $byName: String, $byType: String) {
    markSalesOrderDelivered(id: $id, byId: $byId, byName: $byName, byType: $byType) {
      id deliveryStatus deliveredAt
    }
  }
`;

export const ASSIGN_ORDER_DELIVERY_BOY = gql`
  mutation AssignOrderDeliveryBoy($id: ID!, $deliveryboyid: ID!) {
    assignOrderDeliveryBoy(id: $id, deliveryboyid: $deliveryboyid) {
      id deliveryStatus deliveryboyid
    }
  }
`;

export const MARK_SALES_INVOICE_DELIVERED = gql`
  mutation MarkSalesInvoiceDelivered($id: ID!, $byId: ID, $byName: String, $byType: String) {
    markSalesInvoiceDelivered(id: $id, byId: $byId, byName: $byName, byType: $byType) {
      id deliveryStatus deliveredAt
    }
  }
`;

export const MARK_SALES_ORDER_DISPATCHED = gql`
  mutation MarkSalesOrderDispatched($id: ID!, $deliveryboyid: ID) {
    markSalesOrderDispatched(id: $id, deliveryboyid: $deliveryboyid) {
      id deliveryStatus
    }
  }
`;

export const MARK_SALES_INVOICE_DISPATCHED = gql`
  mutation MarkSalesInvoiceDispatched($id: ID!, $deliveryboyid: ID) {
    markSalesInvoiceDispatched(id: $id, deliveryboyid: $deliveryboyid) {
      id deliveryStatus
    }
  }
`;

export const ASSIGN_INVOICE_DELIVERY_BOY = gql`
  mutation AssignInvoiceDeliveryBoy($id: ID!, $deliveryboyid: ID!) {
    assignInvoiceDeliveryBoy(id: $id, deliveryboyid: $deliveryboyid) {
      id deliveryStatus deliveryboyid
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

// Manual journal / ledger entry (party "New Ledger Entry"). Mirrors the admin
// Transaction page: balanced entries + optional Tally bill allocation.
export const ADD_TRANSACTION = gql`
  mutation AddTransaction($input: TransactionInput!) {
    addTransaction(input: $input) {
      id
      transactioncode
      totaldebit
      totalcredit
      partyid
      invoices { invoiceid invoicemodel settledamount }
    }
  }
`;
