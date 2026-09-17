// src/slices/messageSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface MessageState {
  message: string | null;
  type: 'success' | 'error' | null;
  /**
   * How long to keep it on screen, in ms. Left out, the Message component
   * picks its usual 3s / 7s. Set it when a message is an INSTRUCTION rather
   * than a receipt — the WhatsApp share tells the user to paste a number
   * into a window that has not opened yet, and three seconds is gone before
   * they get there.
   */
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
