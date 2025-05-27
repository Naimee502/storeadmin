declare module 'graphql-upload' {
  import { RequestHandler } from 'express';
  import { GraphQLScalarType } from 'graphql';

  export const graphqlUploadExpress: (options?: { maxFileSize?: number; maxFiles?: number }) => RequestHandler;
  export const GraphQLUpload: GraphQLScalarType;
}