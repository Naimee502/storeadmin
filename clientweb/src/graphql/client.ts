import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

// Deliberately simple compared to client/'s ApolloClient setup — no auth
// token/header handling needed here. Browsing a public storefront and
// requesting an OTP are anonymous; nothing sensitive rides on this client.
const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: import.meta.env.VITE_GRAPHQL_ENDPOINT }),
  cache: new InMemoryCache(),
});

export default apolloClient;
