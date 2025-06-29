import { gql } from 'apollo-server-express';

export const modelTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    subscriptionType: String
    subscribed: Boolean
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
  }

  type Model {
    id: ID!
    modelcode: String!
    modelname: String!
    status: Boolean!
    admin: Admin
  }

  input ModelInput {
    modelname: String!
    status: Boolean!
    admin: ID
  }

  type Query {
    getModels(adminId: ID): [Model!]!
    getDeletedModels(adminId: ID): [Model!]!
    getModelById(id: ID!, adminId: ID): Model
  }

  type Mutation {
    addModel(input: ModelInput!): Model!
    editModel(id: ID!, input: ModelInput!): Model!
    deleteModel(id: ID!): Boolean!
    resetModel(id: ID!): Boolean!
  }
`;
