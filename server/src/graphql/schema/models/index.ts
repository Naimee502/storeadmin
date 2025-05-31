import { gql } from 'apollo-server-express';

export const modelTypeDefs = gql`
  type Model {
    id: ID!
    modelcode: String!
    modelname: String!
    status: Boolean!
  }

  input ModelInput {
    modelname: String!
    status: Boolean!
  }

  type Query {
    getModels: [Model!]!
    getDeletedModels: [Model!]!
    getModelById(id: ID!): Model
  }

  type Mutation {
    addModel(input: ModelInput!): Model!
    editModel(id: ID!, input: ModelInput!): Model!
    deleteModel(id: ID!): Boolean!
    resetModel(id: ID!): Boolean! 
  }
`;
