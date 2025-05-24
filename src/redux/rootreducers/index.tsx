import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '../slices/auth';
import brachesReducer from '../slices/branches';

const appReducer = combineReducers({
  auth: authReducer,
  branches : brachesReducer,
});

const rootReducer = (state:any, action:any) => {
  if (action.type === 'LOGOUT') {
    state = undefined;
  }

  return appReducer(state, action);
};

export default rootReducer;
