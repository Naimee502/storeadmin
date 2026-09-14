import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import rootReducer from '../rootreducers';

const persistConfig = {
  key: 'root',
  storage,
  /**
   * selectedBranch is deliberately NOT persisted here.
   *
   * It used to be, and that was the bug behind "Cast to ObjectId failed for
   * value ''": the blob is written by whichever tab last touched the store, so
   * a second tab sitting on "All Branches" could overwrite the branch a first
   * tab had picked. On the next load rehydrate replaced the slice with that
   * empty value while the raw "branchid" key still held the real id — the
   * header showed a branch name and the page posted branchid: "".
   *
   * The branch now has exactly one home: the "branchid" key, read once at
   * startup (see src/index.tsx) and written by setBranchId. Nothing can
   * silently overwrite it behind the user's back.
   */
  blacklist: ['selectedBranch'],
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
