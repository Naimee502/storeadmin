// mutations/products.ts

import { gql } from '@apollo/client';

export const ADD_PRODUCT = gql`
  mutation AddProduct($input: ProductInput!) {
    addProduct(input: $input) {
      id
      name
      productimage
      productimageurl
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

export const EDIT_PRODUCT = gql`
  mutation EditProduct($id: ID!, $input: ProductInput!) {
    editProduct(id: $id, input: $input) {
      id
      name
      productimage
      productimageurl
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

export const DELETE_PRODUCT = gql`
  mutation DeleteProduct($id: ID!) {
    deleteProduct(id: $id)
  }
`;

export const RESET_PRODUCT = gql`
  mutation ResetProduct($id: ID!) {
    resetProduct(id: $id)
  }
`;
