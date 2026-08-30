import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type UserRole = 'party' | 'salesman' | 'deliveryboy' | 'staff';

export interface AppUser {
  id: string;
  name: string;
  mobile: string;
  role: UserRole;
  adminId?: string;
  email?: string;
  avatarUrl?: string;
  /** Account type — the app only ever signs in "customer" parties. */
  partyType?: string;
  /**
   * The party's sales channel name ("EndUser", "Retailer", …), or null when
   * the admin never assigned one. Decides which Home this party sees — see
   * utils/enduser.ts.
   */
  channelName?: string | null;
}

interface AuthState {
  token: string | null;
  user: AppUser | null;
}

const initialState: AuthState = {
  token: null,
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: AppUser; token: string }>
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;

export default authSlice.reducer;
