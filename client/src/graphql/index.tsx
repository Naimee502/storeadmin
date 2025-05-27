import createUploadLink from "apollo-upload-client/createUploadLink.mjs";
import { ApolloClient, InMemoryCache } from '@apollo/client';

// Create the upload link outside
const httpLink = createUploadLink({
  uri: 'http://localhost:4000/graphql',
});

// Pass it into the ApolloClient
const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

export default client;
