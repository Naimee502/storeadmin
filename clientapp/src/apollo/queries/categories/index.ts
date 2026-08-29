import { gql } from '@apollo/client';

// Category images are NOT available through GET_PRODUCTS: the server populates
// a product's categoryid with `select: "id categoryname"` only (see
// server/src/graphql/resolvers/products/index.ts). Rather than depend on a
// server change, the screens that need images fetch the categories directly
// and join them to the products by id on the client.
export const GET_CATEGORIES = gql`
  query GetCategories($adminId: ID!) {
    getCategories(adminId: $adminId) {
      id
      categoryname
      image
      status
    }
  }
`;
