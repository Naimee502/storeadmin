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
import { startOffline } from './offline/boot';

// Restore the saved branch before first render; the slice itself starts empty so logout can't revive it.
const savedBranchId = localStorage.getItem('branchid');
if (savedBranchId) store.dispatch(setBranchId(savedBranchId));

const renderApp = () =>
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

// Offline billing starts or stays idle on its own once the persisted settings load.
startOffline(client);
renderApp();
