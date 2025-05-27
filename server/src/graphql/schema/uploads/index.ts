import { gql } from 'apollo-server-express';

export const uploadTypeDefs = gql`
  scalar Upload

  type File {
    filename: String!
    mimetype: String!
    encoding: String!
    url: String!   # URL or path to access uploaded file
  }

  type Mutation {
    uploadImage(file: Upload!): File!
  }

  type Query {
    _: Boolean
  }
`;
