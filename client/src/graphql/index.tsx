// client/apolloClient.ts
import { ApolloClient, InMemoryCache, ApolloLink, from, Observable } from '@apollo/client';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Create the upload link
const httpLink = createUploadLink({
  uri: import.meta.env.VITE_GRAPHQL_ENDPOINT,
});

// Set custom headers
const authLink = setContext((_, { headers }) => {
  const branchid = localStorage.getItem('branchid');
  const accessToken = localStorage.getItem('accessToken');
  
  return {
    headers: {
      ...headers,
      'x-branch-id': branchid ?? '',
      authorization: accessToken ? `Bearer ${accessToken}` : '',
    },
  };
});

// Handle Token Refresh on Error
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    for (let err of graphQLErrors) {
      if (err.extensions?.code === 'UNAUTHENTICATED' || err.message === 'Not authenticated') {
        // Handle token refresh - simplified example
        // In a real app, you'd call /refresh_token here
        return new Observable(observer => {
          fetch("/refresh_token", { method: "POST", credentials: "include" })
            .then(res => res.json())
            .then(data => {
              if (data.ok && data.accessToken) {
                localStorage.setItem("accessToken", data.accessToken);
                
                // Retry the failed operation
                const oldHeaders = operation.getContext().headers;
                operation.setContext({
                  headers: {
                    ...oldHeaders,
                    authorization: `Bearer ${data.accessToken}`,
                  },
                });

                const subscriber = {
                  next: observer.next.bind(observer),
                  error: observer.error.bind(observer),
                  complete: observer.complete.bind(observer),
                };

                forward(operation).subscribe(subscriber);
              } else {
                observer.error(err);
              }
            })
            .catch(error => {
              observer.error(error);
            });
        });
      }
    }
  }
});

// Combine links
const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});

export default client;
