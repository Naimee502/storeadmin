import { gql } from "@apollo/client";

export const GET_PRICE_LISTS = gql`
  query GetPriceLists($adminid: ID!) {
    getPriceLists(adminid: $adminid) {
      id
      name
      description
      status
      createdAt
    }
  }
`;

export const GET_DELETED_PRICE_LISTS = gql`
  query GetDeletedPriceLists($adminid: ID!) {
    getDeletedPriceLists(adminid: $adminid) {
      id
      name
      description
      status
      createdAt
    }
  }
`;

export const GET_PRICE_LIST_BY_ID = gql`
  query GetPriceListById($id: ID!) {
    getPriceListById(id: $id) {
      id
      name
      description
      items {
        productid {
          id
          name
        }
        variantid
        unitid {
          id
          unitname
        }
        quantity
        rate
        discount
        discounttype
      }
      status
    }
  }
`;

export const GET_PRICE_ASSIGNMENTS = gql`
  query GetPriceAssignments($adminid: ID!) {
    getPriceAssignments(adminid: $adminid) {
      id
      pricelistid {
        id
        name
      }
      targettype
      targetid
      status
    }
  }
`;

export const GET_DELETED_PRICE_ASSIGNMENTS = gql`
  query GetDeletedPriceAssignments($adminid: ID!) {
    getDeletedPriceAssignments(adminid: $adminid) {
      id
      pricelistid {
        id
        name
      }
      targettype
      targetid
      status
    }
  }
`;

export const RESOLVE_PRICE = gql`
  query ResolvePrice(
    $productid: ID!
    $variantid: ID!
    $unitid: ID!
    $adminid: ID
    $accountid: ID
    $channelid: ID
    $region: String
  ) {
    resolvePrice(
      productid: $productid
      variantid: $variantid
      unitid: $unitid
      adminid: $adminid
      accountid: $accountid
      channelid: $channelid
      region: $region
    ) {
      rate
      discount
      discounttype
    }
  }
`;
