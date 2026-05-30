import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  unitId?: string;
  unitName?: string;
  unitqty?: number;
  imageUrl?: string;
  qty: number;
  rate: number;
  discount: number;
  gst: number;
  amount: number;
}

interface CartState {
  items: CartItem[];
  partyId?: string;
  partyName?: string;
}

const initialState: CartState = { items: [] };

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<CartItem>) => {
      const idx = state.items.findIndex(
        i => i.productId === action.payload.productId &&
             i.variantId === action.payload.variantId &&
             i.unitId    === action.payload.unitId
      );
      if (idx >= 0) {
        state.items[idx].qty    += action.payload.qty;
        state.items[idx].amount  = (state.items[idx].rate - (state.items[idx].discount ?? 0)) * state.items[idx].qty;
      } else {
        state.items.push(action.payload);
      }
    },
    updateQty: (state, action: PayloadAction<{ productId: string; variantId: string; unitId?: string; qty: number }>) => {
      const { productId, variantId, unitId, qty } = action.payload;
      const idx = state.items.findIndex(
        i => i.productId === productId && i.variantId === variantId && i.unitId === unitId
      );
      if (idx < 0) return;
      if (qty <= 0) {
        state.items.splice(idx, 1);
      } else {
        state.items[idx].qty    = qty;
        state.items[idx].amount = (state.items[idx].rate - (state.items[idx].discount ?? 0)) * qty;
      }
    },
    removeFromCart: (state, action: PayloadAction<{ productId: string; variantId: string; unitId?: string }>) => {
      state.items = state.items.filter(
        i => !(i.productId === action.payload.productId &&
               i.variantId === action.payload.variantId &&
               i.unitId    === action.payload.unitId)
      );
    },
    clearCart: state => {
      state.items = [];
      state.partyId   = undefined;
      state.partyName = undefined;
    },
    setCartParty: (state, action: PayloadAction<{ partyId: string; partyName: string }>) => {
      state.partyId   = action.payload.partyId;
      state.partyName = action.payload.partyName;
      state.items     = [];
    },
  },
});

export const { addToCart, updateQty, removeFromCart, clearCart, setCartParty } = cartSlice.actions;
export default cartSlice.reducer;
