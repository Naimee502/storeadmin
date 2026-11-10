import { gql } from "@apollo/client";

export const QUOTATION_FIELDS = `
  id
  adminid
  branchid
  billnumber
  offlineNumber
  revision
  rootid
  partyacc { id name accountname mobile address city state gstnumber }
  leadid { id name mobile city }
  customername
  customermobile
  customeraddress
  customercity
  customerstate
  customergstin
  contactperson
  billdate
  validtill
  subject
  intro
  terms
  notes
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
    description
    optional
  }
  subtotal
  totaldiscount
  totalgst
  totalamount
  quotationStatus
  statusreason
  statusAt
  convertedorderid
  createdby_name
  createdby_type
  status
  createdAt
  updatedAt
`;

export const GET_QUOTATIONS_PAGE = gql`
  query GetQuotationsPage($filter: QuotationFilterInput, $page: Int, $pageSize: Int, $search: String, $columnFilters: [ColumnFilter!]) {
    getQuotationsPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items { ${QUOTATION_FIELDS} }
    }
  }
`;

export const GET_QUOTATIONS = gql`
  query GetQuotations($filter: QuotationFilterInput) {
    getQuotations(filter: $filter) { ${QUOTATION_FIELDS} }
  }
`;

export const GET_DELETED_QUOTATIONS = gql`
  query GetDeletedQuotations($filter: QuotationFilterInput) {
    getDeletedQuotations(filter: $filter) { ${QUOTATION_FIELDS} }
  }
`;

export const GET_QUOTATION_BY_ID = gql`
  query GetQuotationById($id: ID!) {
    getQuotationById(id: $id) { ${QUOTATION_FIELDS} }
  }
`;
