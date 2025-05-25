import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '../slices/auth';
import brachesReducer from '../slices/branches';
import categoriesReducer from "../slices/categories";
import sizesReducer from "../slices/sizes";
import brandsReducer from "../slices/brands";
import modelsReducer from "../slices/models";
import productgroupsReducer from "../slices/productgroups";
import loaderReducer from '../slices/loader';
import messageReducer from '../slices/message';


const appReducer = combineReducers({
  auth: authReducer,
  branches : brachesReducer,
  categories: categoriesReducer,
  sizes: sizesReducer,
  brands: brandsReducer,
  models: modelsReducer,
  productgroups: productgroupsReducer,
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
