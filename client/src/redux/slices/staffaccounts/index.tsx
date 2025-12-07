import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Staff {
  id: string;
  staffcode: string;
  name: string;
  mobile: string;
  email: string;
  password: string;
  profilepicture: string;
  address: string;
  commission: string;
  target: string;
  status: boolean;
  role: string;         // ✅ Added role
}

interface StaffState {
  staff: Staff[];
}

const initialState: StaffState = {
  staff: [],
};

const staffAccountSlice = createSlice({
  name: 'staffaccount',
  initialState,
  reducers: {
    addStaff: (state, action: PayloadAction<Staff[]>) => {
      state.staff.push(...action.payload);
    },
    clearStaff: (state) => {
      state.staff = [];
    },
  },
});

export const { addStaff, clearStaff } = staffAccountSlice.actions;

export default staffAccountSlice.reducer;
