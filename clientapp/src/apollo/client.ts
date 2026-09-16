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

const errorLink = onError(({ graphQLErrors, networkError }: any) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }: any) => {
      console.warn(`[GraphQL error] ${message}`, { locations, path });
    });
  }
  if (networkError) {
    console.warn('[Network error]', networkError.message);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          /**
           * Paged product lists, merged by offset instead of replaced.
           *
           * Home and Shop run the same query with the same variables, so they
           * share one cache entry — which is wanted: opening Shop after Home
           * should not refetch a catalogue already in hand. What was not wanted
           * is what happened next. `fetchMore` merged page two into that entry,
           * so a scroll on Home grew the entry to 100; then the other screen's
           * cache-and-network watcher ran its own base query, the server
           * answered with the first 50, and the whole entry was REPLACED by
           * them. Both lists visibly dropped from 100 rows back to 50, and a
           * user already scrolled past row 50 was left below the end of the
           * list.
           *
           * Keying on the filter (and the page size) gives one list per
           * search-and-category, with each response written at its own offset:
           * a refetch of page one now rewrites rows 0-49 and leaves 50-99
           * where they are. `limit` stays in the key so the screens that ask
           * for the whole catalogue in one go — product detail, order edit,
           * the salesman and staff catalogues — keep a list of their own and
           * cannot flood a paged screen with it.
           */
          /**
           * Point a by-id lookup at the entity the list already stored.
           *
           * Without this, opening a product the grid has just drawn is still a
           * round trip: Apollo has the ProductService in its cache, but nothing
           * connects the root field getProductServiceById(id: "x") to it. With
           * it, the detail screen reads straight from the cache and paints
           * immediately — and because the by-id selection matches the list's
           * exactly, that read is complete rather than a near-miss that falls
           * through to the network anyway.
           *
           * A product not in the cache (a deep link, a notification) reads as a
           * miss and is fetched normally.
           */
          getProductServiceById: {
            read(existing: any, { args, toReference, canRead }: any) {
              if (existing !== undefined) return existing;
              if (!args?.id) return undefined;
              const ref = toReference({ __typename: 'ProductService', id: args.id });
              return canRead(ref) ? ref : undefined;
            },
          },

          getProductServices: {
            keyArgs: ['filter', 'limit'],
            merge(existing: any[] = [], incoming: any[] = [], { args }: any) {
              const merged = existing.slice();
              const start = args?.offset ?? 0;
              for (let i = 0; i < incoming.length; i += 1) merged[start + i] = incoming[i];
              return merged;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
    query: { fetchPolicy: 'network-only' },
  },
});
