import { combineReducers } from '@reduxjs/toolkit';
import { authReducer, appReducer, tenantReducer, cartReducer } from './slices';
import { baseApi } from '../services/api';

export const rootReducer = combineReducers({
  auth:   authReducer,
  app:    appReducer,
  tenant: tenantReducer,
  cart:   cartReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;
