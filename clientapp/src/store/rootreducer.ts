import { combineReducers } from '@reduxjs/toolkit';
import { authReducer, appReducer } from './slices';
import { baseApi } from '../services/api';

export const rootReducer = combineReducers({
  auth: authReducer,
  app: appReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;
