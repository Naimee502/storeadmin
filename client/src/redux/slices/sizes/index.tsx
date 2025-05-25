import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface Size {
  id: string;
  sizecode: string;
  sizename: string;
  status: boolean;
}

interface SizesState {
  sizes: Size[];
}

const initialState: SizesState = {
  sizes: [],
};

const sizesSlice = createSlice({
  name: "sizes",
  initialState,
  reducers: {
    addSizes: (state, action: PayloadAction<Size[]>) => {
      state.sizes = action.payload;
    },
    clearSizes: (state) => {
      state.sizes = [];
    },
  },
});

export const { addSizes, clearSizes } = sizesSlice.actions;
export default sizesSlice.reducer;
