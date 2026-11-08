import { gql } from "@apollo/client";

// Delivery boy report fields only.

// billdate is a "YYYY-MM-DD" string, so the To day is included.
export const DELIVERYBOY_REPORT_SALES_ORDERS = gql`
  query DeliveryBoyReportSalesOrders($filter: SalesOrderFilterInput) {
    getSalesOrders(filter: $filter) {
      id
      billdate
      deliveryboyid
      deliveryStatus
      totalamount
    }
  }
`;

export const DELIVERYBOY_REPORT_PAYMENTS = gql`
  query DeliveryBoyReportPayments($filter: PaymentFilterInput) {
    getPayments(filter: $filter) {
      id
      type
      paymentdate
      amount
      createdby_id
    }
  }
`;
