import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface Unit {
  id: string;
  unitcode: string;
  unitname: string;
  status: boolean;
}

interface UnitsState {
  units: Unit[];
}

const initialState: UnitsState = {
  units: [],
};

const unitsSlice = createSlice({
  name: "units",
  initialState,
  reducers: {
    addUnits: (state, action: PayloadAction<Unit[]>) => {
      state.units = action.payload;
    },
    clearUnits: (state) => {
      state.units = [];
    },
  },
});

export const { addUnits, clearUnits } = unitsSlice.actions;
export default unitsSlice.reducer;
