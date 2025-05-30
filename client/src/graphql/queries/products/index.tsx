import { gql } from '@apollo/client';

export const GET_PRODUCTS = gql`
  query GetProducts {
    getProducts {
      id
      name
      barcode
      productcode
      productimage
      categoryid
      productgroupnameid
      modelid
      brandid
      sizeid
      purchaseunitid
      purchaserate
      salesunitid
      salesrate
      gst
      openingstock
      openingstockamount
      currentstock
      currentstockamount
      minimumstock
      description
      productlikecount
      status
    }
  }
`;

export const GET_PRODUCT_BY_ID = gql`
  query GetProductById($id: ID!) {
    getProduct(id: $id) {
      id
      name
      barcode
      productcode
      productimage
      categoryid
      productgroupnameid
      modelid
      brandid
      sizeid
      purchaseunitid
      purchaserate
      salesunitid
      salesrate
      gst
      openingstock
      openingstockamount
      currentstock
      currentstockamount
      minimumstock
      description
      productlikecount
      status
    }
  }
`;
