import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface Brand {
  id: string;
  brandcode: string;
  brandname: string;
  status: boolean;
}

interface BrandsState {
  brands: Brand[];
}

const initialState: BrandsState = {
  brands: [],
};

const brandsSlice = createSlice({
  name: "brands",
  initialState,
  reducers: {
    addBrands: (state, action: PayloadAction<Brand[]>) => {
      state.brands = action.payload;
    },
    clearBrands: (state) => {
      state.brands = [];
    },
  },
});

export const { addBrands, clearBrands } = brandsSlice.actions;
export default brandsSlice.reducer;
