import { ApolloClient, InMemoryCache, HttpLink, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

// Anonymous storefront browsing (catalog, storefront info, OTP request)
// doesn't need this — but once a party account logs in (sendOTP/verifyOTP),
// requests like getAccountById/getSalesOrders/getPayments and any mutation
// that records createdby_type need the same Bearer token clientapp sends,
// otherwise the server can't tell the request came from an authenticated
// party. Mirrors clientapp/src/apollo/client.ts's token-getter pattern.
let _getToken: (() => string | null) | null = null;

export const setTokenGetter = (fn: () => string | null) => {
  _getToken = fn;
};

const httpLink = new HttpLink({ uri: import.meta.env.VITE_GRAPHQL_ENDPOINT });

const authLink = setContext((_, { headers }) => {
  const token = _getToken ? _getToken() : null;
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
});

export default apolloClient;
