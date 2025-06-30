import { gql } from '@apollo/client';

export const GET_PRODUCTS = gql`
  query GetProducts($adminId: ID, $branchid: ID) {
    getProducts(adminId: $adminId, branchid: $branchid) {
      id
      branchid
      name
      barcode
      productcode
      productimage
      imageurl
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
      admin {
        id
      }
    }
  }
`;


export const GET_DELETED_PRODUCTS = gql`
  query GetDeletedProducts($adminId: ID, $branchid: ID) {
    getDeletedProducts(adminId: $adminId, branchid: $branchid) {
      id
      branchid
      name
      barcode
      productcode
      productimage
      imageurl
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
      admin {
        id
      }
    }
  }
`;


export const GET_PRODUCT_BY_ID = gql`
  query GetProductById($id: ID!, $adminId: ID) {
    getProduct(id: $id, adminId: $adminId) {
      id
      name
      barcode
      productcode
      productimage
      imageurl
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
      admin {
        id
      }
    }
  }
`;

