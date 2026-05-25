import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { API_CONFIG } from '../config';

let _getToken: (() => string | null) | null = null;

export const setTokenGetter = (fn: () => string | null) => {
  _getToken = fn;
};

const httpLink = createHttpLink({
  uri: API_CONFIG.GRAPHQL_URL,
});

const authLink = setContext((_, { headers }) => {
  const token = _getToken ? _getToken() : null;
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.warn(`[GraphQL error] ${message}`, { locations, path });
    });
  }
  if (networkError) {
    console.warn('[Network error]', networkError.message);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
    query: { fetchPolicy: 'network-only' },
  },
});
