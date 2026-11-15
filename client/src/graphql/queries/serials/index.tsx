import { gql } from "@apollo/client";

const UNIT = `id serialno productid productname variantid variantname branchid branchname status purchasedocid purchasebill purchasedate vendorname
  saledocid salebill saledate customername customermobile warrantytill`;

export const GET_SERIALS = gql`query GetSerials($filter: SerialFilter) { getSerials(filter: $filter) { ${UNIT} } }`;
export const GET_AVAILABLE_SERIALS = gql`query GetAvailableSerials($productid: ID!, $variantid: ID) { getAvailableSerials(productid: $productid, variantid: $variantid) { ${UNIT} } }`;
export const GET_INVOICE_SERIALS = gql`query GetInvoiceSerials($invoiceid: ID!) { getInvoiceSerials(invoiceid: $invoiceid) { ${UNIT} } }`;
export const GET_SERIAL_HISTORY = gql`query GetSerialHistory($serialno: String!) { getSerialHistory(serialno: $serialno) { action docmodel docno partyname createdAt } }`;
