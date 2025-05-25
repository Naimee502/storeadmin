import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface Model {
  id: string;
  modelcode: string;
  modelname: string;
  status: boolean;
}

interface ModelsState {
  models: Model[];
}

const initialState: ModelsState = {
  models: [],
};

const modelsSlice = createSlice({
  name: "models",
  initialState,
  reducers: {
    addModels: (state, action: PayloadAction<Model[]>) => {
      state.models = action.payload;
    },
    clearModels: (state) => {
      state.models = [];
    },
  },
});

export const { addModels, clearModels } = modelsSlice.actions;
export default modelsSlice.reducer;
