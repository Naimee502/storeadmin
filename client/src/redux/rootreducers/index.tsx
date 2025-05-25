import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '../slices/auth';
import brachesReducer from '../slices/branches';
import loaderReducer from '../slices/loader';
import messageReducer from '../slices/message';

const appReducer = combineReducers({
  auth: authReducer,
  branches : brachesReducer,
  loader: loaderReducer,
  message: messageReducer,
});

const rootReducer = (state:any, action:any) => {
  if (action.type === 'LOGOUT') {
    state = undefined;
  }

  return appReducer(state, action);
};

export default rootReducer;
