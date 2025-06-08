// client/apolloClient.ts
import { ApolloClient, InMemoryCache, ApolloLink } from '@apollo/client';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import { setContext } from '@apollo/client/link/context';

// Create the upload link
const httpLink = createUploadLink({
  uri: import.meta.env.VITE_GRAPHQL_ENDPOINT,
});

// Set custom header
const authLink = setContext((_, { headers }) => {
  const branchid = localStorage.getItem('branchid');
  return {
    headers: {
      ...headers,
      'x-branch-id': branchid ?? '',
    },
  };
});

// Combine auth and upload links
const client = new ApolloClient({
  link: ApolloLink.from([authLink, httpLink]),
  cache: new InMemoryCache(),
});

export default client;
