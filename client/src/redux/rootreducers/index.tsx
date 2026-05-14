import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '../slices/auth';
import adminsettingsReducer from "../slices/adminsettings";
import permissionsReducer from "../slices/permissions";
import selectedBranchReducer from "../slices/branch";
import brachesReducer from '../slices/branches';
import categoriesReducer from "../slices/categories";
import subcategoriesReducer from "../slices/subcategories";
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
import salesorderReducer from '../slices/salesorder';
import purchaseorderReducer from '../slices/purchaseorder';

const appReducer = combineReducers({
  auth: authReducer,
  adminsettings: adminsettingsReducer,
  permissions: permissionsReducer,
  selectedBranch: selectedBranchReducer,
  branches: brachesReducer,
  categories: categoriesReducer,
  subcategories: subcategoriesReducer,
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
  salesorder: salesorderReducer,
  purchaseorder: purchaseorderReducer,
});

const rootReducer = (state: any, action: any) => {
  if (action.type === 'LOGOUT') {
    state = undefined;
  }

  return appReducer(state, action);
};

export default rootReducer;
