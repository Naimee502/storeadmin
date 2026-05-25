import { combineReducers } from '@reduxjs/toolkit';
import { authReducer, appReducer, tenantReducer } from './slices';
import { baseApi } from '../services/api';

export const rootReducer = combineReducers({
  auth:   authReducer,
  app:    appReducer,
  tenant: tenantReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;
