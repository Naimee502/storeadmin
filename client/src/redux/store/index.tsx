import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import rootReducer from '../rootreducers';

const persistConfig = {
  key: 'root',
  storage,
  // selectedBranch is not persisted: the "branchid" key is its only source, so other tabs can't overwrite it.
  // Document lists are fetched per page; persisting them overflowed localStorage.
  blacklist: ['selectedBranch', 'salesinvoice', 'purchaseinvoice', 'salesorder', 'purchaseorder'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
