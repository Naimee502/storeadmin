import { gql } from "@apollo/client";

const ROW = `id branchid branchname productid productname variantid variantname batchno expirydate mfgdate qty daysleft`;

export const GET_BATCHES = gql`query GetBatches($filter: BatchFilter) { getBatches(filter: $filter) { ${ROW} } }`;
export const GET_PRODUCT_BATCHES = gql`
  query GetProductBatches($productid: ID!, $variantid: ID, $branchid: ID!) {
    getProductBatches(productid: $productid, variantid: $variantid, branchid: $branchid) { ${ROW} }
  }
`;
export const GET_UNBATCHED_STOCK = gql`
  query GetUnbatchedStock($branchid: ID) {
    getUnbatchedStock(branchid: $branchid) { branchid branchname productid productname variantid variantname stock inbatches unbatched }
  }
`;
export const ADD_OPENING_BATCH = gql`mutation AddOpeningBatch($input: OpeningBatchInput!) { addOpeningBatch(input: $input) { ${ROW} } }`;
export const EDIT_BATCH = gql`mutation EditBatch($id: ID!, $expirydate: String, $mfgdate: String) { editBatch(id: $id, expirydate: $expirydate, mfgdate: $mfgdate) { ${ROW} } }`;
