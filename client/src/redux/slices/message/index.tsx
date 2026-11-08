import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface MessageState {
  message: string | null;
  type: 'success' | 'error' | null;
  /** Display time in ms; null uses the default 3s / 7s. */
  duration: number | null;
}

const initialState: MessageState = {
  message: null,
  type: null,
  duration: null,
};

const messageSlice = createSlice({
  name: 'message',
  initialState,
  reducers: {
    showMessage: (
      state,
      action: PayloadAction<{
        message: string;
        type: 'success' | 'error';
        duration?: number;
      }>
    ) => {
      state.message = action.payload.message;
      state.type = action.payload.type;
      state.duration = action.payload.duration ?? null;
    },
    clearMessage: (state) => {
      state.message = null;
      state.type = null;
      state.duration = null;
    },
  },
});

export const { showMessage, clearMessage } = messageSlice.actions;
export default messageSlice.reducer;
