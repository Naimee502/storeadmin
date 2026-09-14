import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { Provider } from 'react-redux';
import { persistor, store } from './redux/store/index.tsx';
import { PersistGate } from 'redux-persist/integration/react';
import { ApolloProvider } from '@apollo/client';
import client from './graphql/index.tsx';
import { setBranchId } from './redux/slices/branch';

// Restore the branch the user last picked, before anything renders. This is the
// ONE place the saved value is read; the slice itself starts empty so a logout
// can never resurrect a stale branch. Keeping it here (rather than inside the
// slice's initialState) also means the Redux value and the "branchid" key that
// the Apollo link sends as x-branch-id are identical from the first render.
const savedBranchId = localStorage.getItem('branchid');
if (savedBranchId) store.dispatch(setBranchId(savedBranchId));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ApolloProvider client={client}>
          <App />
        </ApolloProvider>
      </PersistGate>
    </Provider>
  </StrictMode>
);
