import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Product {
  id: string;
  name: string;
  productcode: string;
  barcode: string;
  productimage: string;
  productimageurl: string;
  categoryid: string;
  productgroupnameid: string;
  modelid: string;
  brandid: string;
  sizeid: string;
  purchaseunitid: string;
  purchaserate: number;
  salesunitid: string;
  salesrate: number;
  gst: number;
  openingstock: number;
  openingstockamount: number;
  currentstock: number;
  currentstockamount: number;
  minimumstock: number;
  description: string;
  productlikecount: number;
  status: boolean;
}

interface ProductState {
  products: Product[];
}

const initialState: ProductState = {
  products: [],
};

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    addProducts: (state, action: PayloadAction<Product[]>) => {
      state.products.push(...action.payload);
    },
    clearProducts: (state) => {
      state.products = [];
    },
  },
});

export const { addProducts, clearProducts } = productSlice.actions;

export default productSlice.reducer;
