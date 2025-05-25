import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface Category {
  id: string;
  categorycode: string;
  categoryname: string;
  status: boolean;
}

interface CategoriesState {
  categories: Category[];
}

const initialState: CategoriesState = {
  categories: [],
};

const categoriesSlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    addCategories: (state, action: PayloadAction<Category[]>) => {
      state.categories = action.payload;
    },
    clearCategories: (state) => {
      state.categories = [];
    },
  },
});

export const { addCategories, clearCategories } = categoriesSlice.actions;
export default categoriesSlice.reducer;
