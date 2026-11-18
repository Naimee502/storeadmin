import { gql } from "@apollo/client";

// Same shape the mobile app's party Catalog screen uses (GET_PRODUCTS in
// clientapp/src/apollo/queries/accounts) — kept identical on purpose so the
// website and the app always show the same default (non-party-specific)
// pricing. Party/channel-specific pricing is resolved separately via
// resolvePrice, once login is wired in (see contexts/tenant + useCatalog).
export const GET_STORE_PRODUCTS = gql`
  query GetStoreProducts($adminid: ID!, $limit: Int, $offset: Int) {
    getProductServices(filter: { adminid: $adminid, instockfirst: true }, limit: $limit, offset: $offset) {
      id
      name
      description
      imageurl
      imageurls
      status
      createdAt
      categoryid { id categoryname }
      brandid { id brandname }
      productvariants {
        id
        name
        gst
        liveprice
        currentstock
        unitconversions {
          factor
          unitid { id }
        }
        unitprices {
          mrp
          salesrate
          offerprice
          discount
          discounttype
          quantity
          unitid { id unitname }
        }
      }
    }
  }
`;

// One page (or a picked set) of the storefront catalog; same fields as GET_STORE_PRODUCTS.
export const GET_STORE_PRODUCTS_PAGE = gql`
  query GetStoreProductsPage($filter: ProductServiceFilterInput!, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id
      name
      description
      imageurl
      imageurls
      status
      createdAt
      categoryid { id categoryname }
      brandid { id brandname }
      productvariants {
        id
        name
        gst
        liveprice
        currentstock
        unitconversions {
          factor
          unitid { id }
        }
        unitprices {
          mrp
          salesrate
          offerprice
          discount
          discounttype
          quantity
          unitid { id unitname }
        }
      }
    }
  }
`;

// Product count per category without loading the products.
export const GET_STORE_CATEGORY_COUNTS = gql`
  query GetStoreCategoryCounts($adminid: ID) {
    getStoreCategoryCounts(adminid: $adminid) {
      categoryid
      count
    }
  }
`;

export const GET_STORE_CATEGORIES = gql`
  query GetStoreCategories($adminId: ID) {
    getCategories(adminId: $adminId) {
      id
      categoryname
      image
      status
    }
  }
`;

// Resolves a party/channel-specific price for one product+variant+unit —
// returns null when there's no assignment for this buyer, in which case the
// caller should keep showing the default salesrate/offerprice. Not used yet
// (party login/register comes next) but queried from the same place so the
// switch-over later is a one-line change, not a rewrite.
export const RESOLVE_STORE_PRICE = gql`
  query ResolveStorePrice(
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
