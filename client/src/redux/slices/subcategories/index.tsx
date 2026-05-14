import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface SubCategory {
  id: string;
  subcategorycode: string;
  subcategoryname: string;
  category: {
    id: string;
    categoryname: string;
  };
  status: boolean;
}

interface SubCategoriesState {
  subcategories: SubCategory[];
}

const initialState: SubCategoriesState = {
  subcategories: [],
};

const subcategoriesSlice = createSlice({
  name: "subcategories",
  initialState,
  reducers: {
    addSubCategories: (state, action: PayloadAction<SubCategory[]>) => {
      state.subcategories = action.payload;
    },
    clearSubCategories: (state) => {
      state.subcategories = [];
    },
  },
});

export const { addSubCategories, clearSubCategories } = subcategoriesSlice.actions;
export default subcategoriesSlice.reducer;
