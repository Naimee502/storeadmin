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

    """
    Remove uploaded files that nothing points at any more. Returns how many
    were actually deleted — a url that is not ours, is still referenced by a
    record, or is already gone is skipped rather than reported as an error.
    """
    deleteImages(urls: [String!]!): Int!
  }

  type Query {
    _: Boolean
  }
`;
