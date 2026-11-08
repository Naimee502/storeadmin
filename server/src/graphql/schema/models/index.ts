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
    needsReview: Boolean!
    rejected: Boolean!
  }

  type Model {

    "ISO date"

    updatedAt: String
    id: ID!
    modelcode: String!
    modelname: String!
    status: Boolean!
    admin: Admin
  }

  input ModelInput {

    "Set by offline sync so a retried save returns the same document."

    clientRequestId: String
    modelname: String!
    status: Boolean!
    admin: ID
  }

  type ModelPage {
    items: [Model!]!
    total: Int!
  }

  type Query {
    getModels(adminId: ID): [Model!]!
    getModelsPage(adminId: ID, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): ModelPage!
    getDeletedModels(adminId: ID): [Model!]!
    getModelById(id: ID!, adminId: ID): Model
  }

  type Mutation {
    addModel(input: ModelInput!): Model!
    editModel(id: ID!, input: ModelInput!, expectedUpdatedAt: String): Model!
    deleteModel(id: ID!, expectedUpdatedAt: String): Boolean!
    resetModel(id: ID!): Boolean!
  }
`;
