import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DeliveryState {
  ownerUserId: string;
  locationId: string;
  blockId: string;
  roomId: string;
  roomNumber: string;
  label: string;
  setOwnerUserId: (id: string) => void;
  setLocationId: (id: string) => void;
  setBlockId: (id: string) => void;
  setRoomId: (id: string) => void;
  setRoomNumber: (room: string) => void;
  setLabel: (label: string) => void;
  resetDelivery: (ownerUserId?: string) => void;
}

const emptyDeliverySelection = {
  ownerUserId: '',
  locationId: '',
  blockId: '',
  roomId: '',
  roomNumber: '',
  label: '',
};

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set) => ({
      ...emptyDeliverySelection,
      setOwnerUserId: (id) => set({ ownerUserId: id }),
      setLocationId: (id) => set({ locationId: id }),
      setBlockId: (id) => set({ blockId: id }),
      setRoomId: (id) => set({ roomId: id }),
      setRoomNumber: (room) => set({ roomNumber: room }),
      setLabel: (label) => set({ label }),
      resetDelivery: (ownerUserId = '') =>
        set({ ...emptyDeliverySelection, ownerUserId }),
    }),
    {
      name: 'lonemmy-delivery',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
