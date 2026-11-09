import { gql } from "@apollo/client";

export const DELIVERY_CHALLAN_FIELDS = `
  id
  partyacc { id name accountname mobile address city state gstnumber }
  billdate
  billnumber
  offlineNumber
  reason
  notes
  sourceorderid
  sourceinvoiceid
  sourceOrderNumber
  sourceInvoiceNumber
  invoiceid
  invoicenumber
  subtotal
  totaldiscount
  totalgst
  totalamount
  adminid
  branchid
  createdby_name
  createdby_type
  productservice {
    productserviceid { id name }
    variantid { id name }
    salesunitid { id unitname }
    unitqty
    qty
    rate
    discount
    gst
    amount
  }
  transportname
  vehiclenumber
  ewaybillno
  ewaybilldate
  ewaybillvalidupto
  distance
  deliverydate
  stockapplied
  challanStatus
  deliveredAt
  returnedAt
  status
  createdAt
  updatedAt
`;

export const GET_DELIVERY_CHALLANS_PAGE = gql`
  query GetDeliveryChallansPage($filter: DeliveryChallanFilterInput, $page: Int, $pageSize: Int, $search: String, $columnFilters: [ColumnFilter!]) {
    getDeliveryChallansPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
        ${DELIVERY_CHALLAN_FIELDS}
      }
    }
  }
`;

export const GET_DELETED_DELIVERY_CHALLANS = gql`
  query GetDeletedDeliveryChallans($filter: DeliveryChallanFilterInput) {
    getDeletedDeliveryChallans(filter: $filter) {
      ${DELIVERY_CHALLAN_FIELDS}
    }
  }
`;

export const GET_DELIVERY_CHALLAN_BY_ID = gql`
  query GetDeliveryChallanById($id: ID!) {
    getDeliveryChallanById(id: $id) {
      ${DELIVERY_CHALLAN_FIELDS}
    }
  }
`;

export const GET_DELIVERY_CHALLAN_DRAFT = gql`
  query GetDeliveryChallanDraft($sourceType: String!, $sourceId: ID!) {
    getDeliveryChallanDraft(sourceType: $sourceType, sourceId: $sourceId) {
      ${DELIVERY_CHALLAN_FIELDS}
    }
  }
`;

// Reports: every active challan in the date range (answered from the device offline).
export const GET_DELIVERY_CHALLANS_REPORT = gql`
  query GetDeliveryChallansReport($filter: DeliveryChallanFilterInput) {
    getDeliveryChallans(filter: $filter) {
      ${DELIVERY_CHALLAN_FIELDS}
    }
  }
`;
