import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface ProductGroup {
  id: string;
  productgroupcode: string;
  productgroupname: string;
  status: boolean;
}

interface ProductGroupsState {
  productgroups: ProductGroup[];
}

const initialState: ProductGroupsState = {
  productgroups: [],
};

const productGroupsSlice = createSlice({
  name: "productgroups",
  initialState,
  reducers: {
    addProductGroups: (state, action: PayloadAction<ProductGroup[]>) => {
      state.productgroups = action.payload;
    },
    clearProductGroups: (state) => {
      state.productgroups = [];
    },
  },
});

export const { addProductGroups, clearProductGroups } = productGroupsSlice.actions;
export default productGroupsSlice.reducer;
