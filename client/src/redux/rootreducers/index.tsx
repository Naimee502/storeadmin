import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '../slices/auth';
import selectedBranchReducer from "../slices/branch";
import brachesReducer from '../slices/branches';
import categoriesReducer from "../slices/categories";
import unitsReducer from "../slices/units";
import sizesReducer from "../slices/sizes";
import brandsReducer from "../slices/brands";
import modelsReducer from "../slices/models";
import productgroupsReducer from "../slices/productgroups";
import accountgroupsReducer from "../slices/accountgroups";
import accountledgersReducer from "../slices/accountledgers";
import accountsReducer from "../slices/accounts";
import staffAccountReducer from "../slices/staffaccounts";
import productsReducer from "../slices/products";
import salesinvoiceReducer from "../slices/salesinvoice"
import purchaseInvoiceReducer from '../slices/purchaseinvoice';
import transferStockReducer from '../slices/transferstock';
import loaderReducer from '../slices/loader';
import messageReducer from '../slices/message';

const appReducer = combineReducers({
  auth: authReducer,
  selectedBranch: selectedBranchReducer,
  branches: brachesReducer,
  categories: categoriesReducer,
  units: unitsReducer,
  sizes: sizesReducer,
  brands: brandsReducer,
  models: modelsReducer,
  productgroups: productgroupsReducer,
  accountgroups: accountgroupsReducer,
  accountledgers: accountledgersReducer,
  accounts: accountsReducer,
  staffaccount: staffAccountReducer, 
  products: productsReducer,
  salesinvoice: salesinvoiceReducer,
  purchaseinvoice: purchaseInvoiceReducer,
  transferStock: transferStockReducer,  
  loader: loaderReducer,
  message: messageReducer,
});

const rootReducer = (state: any, action: any) => {
  if (action.type === 'LOGOUT') {
    state = undefined;
  }

  return appReducer(state, action);
};

export default rootReducer;
