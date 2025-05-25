import { createSlice } from '@reduxjs/toolkit';

interface AuthState {
  name: string;
}

const initialState: AuthState = { name: '' };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    saveAuthData: (state, action) => {
        state.name = action.payload;
    },
    clearAuthData() {
      return { ...initialState };
    }
  },
});

export const { saveAuthData, clearAuthData } = authSlice.actions;
export default authSlice.reducer;
