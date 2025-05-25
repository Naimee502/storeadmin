// src/slices/messageSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface MessageState {
  message: string | null;
  type: 'success' | 'error' | null;
}

const initialState: MessageState = {
  message: null,
  type: null,
};

const messageSlice = createSlice({
  name: 'message',
  initialState,
  reducers: {
    showMessage: (
      state,
      action: PayloadAction<{ message: string; type: 'success' | 'error' }>
    ) => {
      state.message = action.payload.message;
      state.type = action.payload.type;
    },
    clearMessage: (state) => {
      state.message = null;
      state.type = null;
    },
  },
});

export const { showMessage, clearMessage } = messageSlice.actions;
export default messageSlice.reducer;
