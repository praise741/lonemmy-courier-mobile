import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartOption {
  groupId: string;
  choiceId: string;
  groupName?: string;
  choiceLabel?: string;
  additionalPrice?: number;
  qty?: number;
}

export interface CartItem {
  id: string;
  productId: string;
  vendorId: string;
  vendorName: string;
  name: string;
  description?: string;
  image?: string;
  price: number;
  quantity: number;
  options?: CartOption[];
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => boolean;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const state = get();
        const id = `${item.productId}-${Date.now()}`;
        set({
          items: [...state.items, { ...item, id }],
        });
        return true;
      },

      removeItem: (id) => {
        const state = get();
        const next = state.items.filter((i) => i.id !== id);
        set({ items: next });
      },

      updateQuantity: (id, qty) => {
        if (qty < 1) return;
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
        }));
      },

      clearCart: () => set({ items: [] }),

      getSubtotal: () => {
        return get().items.reduce((sum, i) => {
          const optionsCost = (i.options || []).reduce(
            (s, o) => s + (o.additionalPrice || 0) * (o.qty || 1),
            0,
          );
          return sum + (i.price + optionsCost) * i.quantity;
        }, 0);
      },

      getItemCount: () => get().items.reduce((c, i) => c + i.quantity, 0),
    }),
    {
      name: 'lonemmy-cart',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
