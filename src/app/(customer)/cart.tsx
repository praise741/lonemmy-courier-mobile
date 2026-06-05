import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useCartStore } from '@/stores/cartStore';
import { useDeliveryStore } from '@/stores/deliveryStore';
import { useToast } from '@/context/ToastContext';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface SavedAddress {
  id: string;
  locationId: string;
  blockId?: string | null;
  roomId?: string | null;
  roomNumber: string;
  label?: string | null;
  isDefault: boolean;
  location?: { name: string } | null;
  block?: { name: string } | null;
}

interface CampusLocation {
  id: string;
  name: string;
}

export default function CartCheckout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();

  // Zustand stores
  const cartStore = useCartStore();
  const deliveryAddress = useDeliveryStore();

  const [timing, setTiming] = useState<'ASAP' | 'Schedule'>('ASAP');
  const [scheduledDate, setScheduledDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Card' | 'Transfer' | 'Wallet'>('Card');
  
  // UI Modal controllers
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [isPayingOnline, setIsPayingOnline] = useState(false);

  // New Address form state
  const [newLocId, setNewLocId] = useState('');
  const [newBlockId, setNewBlockId] = useState('');
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);

  React.useEffect(() => {
    const getCampus = async () => {
      try {
        const stored = await AsyncStorage.getItem('lonemmy-selected-campus');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSelectedCampusId(parsed?.id || null);
        }
      } catch (e) {
        console.error(e);
      }
    };
    getCampus();
  }, []);

  // 1. Fetch saved addresses
  const { data: addressesData, isLoading: isLoadingAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const response = await api.get('/addresses');
      const data = response.data?.data ?? response.data ?? [];
      return data as SavedAddress[];
    },
    enabled: !!user,
  });

  const addressesList = addressesData || [];

  React.useEffect(() => {
    if (addressesList.length > 0 && !deliveryAddress.locationId) {
      const defaultAddr = addressesList.find((a) => a.isDefault) || addressesList[0];
      deliveryAddress.setLocationId(defaultAddr.locationId);
      deliveryAddress.setBlockId(defaultAddr.blockId || '');
      deliveryAddress.setRoomId(defaultAddr.roomId || '');
      deliveryAddress.setRoomNumber(defaultAddr.roomNumber);
      deliveryAddress.setLabel(defaultAddr.label || '');
    }
  }, [addressesList, deliveryAddress]);

  // 2. Fetch campus locations for address creation DTO
  const { data: locationsData } = useQuery({
    queryKey: ['locations', selectedCampusId],
    queryFn: async () => {
      const response = await api.get('/locations', {
        params: selectedCampusId ? { campusId: selectedCampusId } : undefined,
      });
      const data = response.data?.data ?? response.data ?? [];
      return data as CampusLocation[];
    },
    enabled: isAddingNewAddress,
  });

  const locations = locationsData || [];

  // Group cart items by vendorId for payload
  const vendorOrdersMap: Record<string, any[]> = {};
  cartStore.items.forEach((item) => {
    if (!vendorOrdersMap[item.vendorId]) {
      vendorOrdersMap[item.vendorId] = [];
    }
    vendorOrdersMap[item.vendorId].push({
      productId: item.productId,
      qty: item.quantity,
      options: (item.options || []).map((o) => ({
        groupId: o.groupId,
        choiceId: o.choiceId,
        qty: o.qty || 1,
      })),
    });
  });

  const vendorOrders = Object.entries(vendorOrdersMap).map(([vendorId, items]) => ({
    vendorId,
    items,
  }));

  const hasDeliveryDetails = !!deliveryAddress.locationId && !!deliveryAddress.roomNumber;

  // 3. Automatically fetch checkout price quote from backend
  const { data: quote, isLoading: isLoadingQuote, error: quoteError } = useQuery({
    queryKey: ['checkout-quote', deliveryAddress.locationId, deliveryAddress.roomNumber, cartStore.items],
    queryFn: async () => {
      if (!hasDeliveryDetails || cartStore.items.length === 0) return null;
      const payload = {
        locationId: deliveryAddress.locationId,
        blockId: deliveryAddress.blockId || undefined,
        roomId: deliveryAddress.roomId || undefined,
        roomNumber: deliveryAddress.roomNumber,
        vendorOrders,
      };
      const response = await api.post('/orders/checkout/quote', payload);
      return response.data?.data ?? response.data;
    },
    enabled: hasDeliveryDetails && cartStore.items.length > 0,
    retry: false,
  });

  // 4. Create address mutation
  const createAddressMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post('/addresses', payload);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setIsAddingNewAddress(false);
      
      // Select the newly created address
      const newAddr = data?.data ?? data;
      if (newAddr) {
        deliveryAddress.setLocationId(newAddr.locationId);
        deliveryAddress.setBlockId(newAddr.blockId || '');
        deliveryAddress.setRoomId(newAddr.roomId || '');
        deliveryAddress.setRoomNumber(newAddr.roomNumber);
        deliveryAddress.setLabel(newAddr.label || '');
      }
      showToast('Successfully added and selected hostel/room address.', 'success');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Could not add address.', 'error');
    },
  });

  // 5. Checkout order submission mutation
  const checkoutMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post('/orders/checkout', payload);
      return response.data?.data ?? response.data;
    },
    onSuccess: async (data) => {
      const parentRef = data?.parentReference;
      const ordersList = data?.orders || [];

      if (!parentRef || ordersList.length === 0) {
        showToast('Order checkout did not return active order tracking references.', 'error');
        return;
      }

      // If card payment is selected, initialize transaction online
      if (paymentMethod === 'Card') {
        setIsPayingOnline(true);
        try {
          const initRes = await api.post(`/payments/initialize-group/${parentRef}`);
          const { authorizationUrl, reference } = initRes.data?.data ?? initRes.data ?? {};
          
          if (authorizationUrl) {
            // Open payment link in expo-web-browser and wait for it to close
            await WebBrowser.openBrowserAsync(authorizationUrl);
            
            // Now verify reference with JABU backend
            try {
              const verifyRes = await api.get(`/payments/verify/${reference}`);
              const isVerified = verifyRes.data?.success || 
                                 verifyRes.data?.data?.status === 'success' || 
                                 verifyRes.data?.status === 'success';
              
              if (isVerified) {
                cartStore.clearCart();
                Alert.alert('Payment Successful! 🎉', 'Your order is confirmed and sent to preparation.', [
                  {
                    text: 'Continue to Tracking',
                    onPress: () => {
                      setIsPayingOnline(false);
                      router.push(`/(customer)/order/${ordersList[0].id}`);
                    }
                  }
                ]);
              } else {
                setIsPayingOnline(false);
                Alert.alert(
                  'Payment Verification Pending',
                  'We could not confirm payment immediately. If you paid, it will process shortly.',
                  [
                    {
                      text: 'View Order Tracker',
                      onPress: () => {
                        cartStore.clearCart();
                        router.push(`/(customer)/order/${ordersList[0].id}`);
                      }
                    }
                  ]
                );
              }
            } catch (verifyErr: any) {
              console.error('Verification error:', verifyErr);
              setIsPayingOnline(false);
              Alert.alert(
                'Payment Status',
                'Your transaction is being processed. You can monitor progress on the tracking screen.',
                [
                  {
                    text: 'View Order Tracker',
                    onPress: () => {
                      cartStore.clearCart();
                      router.push(`/(customer)/order/${ordersList[0].id}`);
                    }
                  }
                ]
              );
            }
          } else {
            throw new Error('Paystack authorization URL missing');
          }
        } catch (e: any) {
          setIsPayingOnline(false);
          Alert.alert(
            'Payment Setup Error',
            'Order created but payment gate failed. Order placed as CoD instead.',
            [
              {
                text: 'OK',
                onPress: () => {
                  cartStore.clearCart();
                  router.push(`/(customer)/order/${ordersList[0].id}`);
                },
              },
            ]
          );
        }
      } else {
        // CoD or Simulated checkout success
        cartStore.clearCart();
        showToast('Your campus order is now preparation pending.', 'success');
        router.push(`/(customer)/order/${ordersList[0].id}`);
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Order request failed. Verify kitchen operating hours.', 'error');
    },
  });

  const handlePlaceOrder = () => {
    if (cartStore.items.length === 0) return;
    if (!hasDeliveryDetails) {
      Alert.alert('Address Pending', 'Please add or select a delivery location before checking out.');
      return;
    }

    const payload: any = {
      locationId: deliveryAddress.locationId,
      blockId: deliveryAddress.blockId || undefined,
      roomId: deliveryAddress.roomId || undefined,
      roomNumber: deliveryAddress.roomNumber,
      paymentMethod: paymentMethod === 'Card' ? 'online' : 'pod',
      vendorOrders,
    };

    if (timing === 'Schedule' && scheduledDate.trim()) {
      payload.scheduledFor = new Date(scheduledDate.trim()).toISOString();
    }

    checkoutMutation.mutate(payload);
  };

  const handleAddNewAddressSubmit = () => {
    if (!newLocId || !newRoomNumber) {
      Alert.alert('Incomplete Form', 'Please choose a location and enter room number.');
      return;
    }
    createAddressMutation.mutate({
      locationId: newLocId,
      blockId: newBlockId || undefined,
      roomNumber: newRoomNumber,
      label: newLabel || undefined,
      isDefault: true,
    });
  };

  // Pricing calculations
  const rawSubtotal = cartStore.getSubtotal();
  const subtotal = quote ? Number(quote.subtotal) : rawSubtotal;
  const deliveryFee = quote ? Number(quote.deliveryFeeTotal) : 0;
  const platformServiceFee = 150; // JABU standard platform fee
  const totalPayable = subtotal + deliveryFee + platformServiceFee;

  const resolvedLocationName = locations.find((l) => l.id === newLocId)?.name || 'Select Location';

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Transactional Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(customer)/home')}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Checkout Basket</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {cartStore.items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cart" $$$ />
            <Text style={[TYPOGRAPHY.subtitle, { color: COLORS.secondary, marginTop: SPACING.gutter }]}>
              Your basket is empty
            </Text>
            <TouchableOpacity style={styles.shopBtn} onPress={() => router.replace('/(customer)/home')}>
              <Text style={styles.shopBtnText}>Browse Kitchens</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Timing pills selection */}
            <View style={styles.timingPills}>
              <TouchableOpacity
                style={[styles.timingBtn, timing === 'ASAP' && styles.timingBtnActive]}
                onPress={() => setTiming('ASAP')}
              >
                <Text style={[TYPOGRAPHY.subtitle, timing === 'ASAP' ? styles.timingTextActive : styles.timingTextInactive]}>
                  ASAP <Text style={styles.timingSpan}>(15-25 min)</Text>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timingBtn, timing === 'Schedule' && styles.timingBtnActive]}
                onPress={() => setTiming('Schedule')}
              >
                <Text style={[TYPOGRAPHY.subtitle, timing === 'Schedule' ? styles.timingTextActive : styles.timingTextInactive]}>
                  Schedule <Text style={styles.timingSpan}>Later</Text>
                </Text>
              </TouchableOpacity>
            </View>

            {timing === 'Schedule' && (
              <View style={styles.scheduleInput}>
                <Text style={[TYPOGRAPHY.labelMini, { color: COLORS.secondary, marginBottom: 6 }]}>
                  SCHEDULED DELIVERY DATE/TIME
                </Text>
                <TextInput
                  style={styles.scheduleTextInput}
                  placeholder="e.g. 2026-05-26 14:30"
                  placeholderTextColor={COLORS.outline}
                  value={scheduledDate}
                  onChangeText={setScheduledDate}
                />
              </View>
            )}

            {/* Address Location Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Hostel Delivery Location</Text>
                <TouchableOpacity onPress={() => { setIsAddingNewAddress(false); setIsAddressModalOpen(true); }}>
                  <Text style={[TYPOGRAPHY.muted, styles.editLink]}>Change</Text>
                </TouchableOpacity>
              </View>

              {hasDeliveryDetails ? (
                <View style={styles.addressRow}>
                  <View style={styles.addressPin}>
                    <Text style={{ fontSize: 18 }}>📍</Text>
                  </View>
                  <View style={styles.addressDetails}>
                    <Text style={[TYPOGRAPHY.body, styles.addressText]}>
                      Room {deliveryAddress.roomNumber}
                    </Text>
                    <Text style={[TYPOGRAPHY.muted, styles.addressSub]}>
                      {deliveryAddress.label || 'Saved Hostel Address'}
                    </Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.missingAddressBtn}
                  onPress={() => { setIsAddingNewAddress(true); setIsAddressModalOpen(true); }}
                >
                  <Ionicons name="add" $$$ />
                  <Text style={styles.missingAddressText}>Add Campus Address Hostel/Room</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quote details warning */}
            {!hasDeliveryDetails && (
              <View style={[styles.feeAlert, { backgroundColor: '#FFFBE6', borderColor: '#FFE58F' }]}>
                <Ionicons name="warning" $$$ />
                <Text style={[styles.feeAlertText, { color: '#D46B08' }]}>
                  Please choose a delivery location above to fetch dynamic delivery quotes from the campus servers.
                </Text>
              </View>
            )}

            {/* Cart Items Box */}
            <View style={styles.sectionCard}>
              <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle, { marginBottom: 12 }]}>
                Items in Basket
              </Text>

              <View style={styles.itemList}>
                {cartStore.items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={[TYPOGRAPHY.body, styles.itemName]}>{item.name}</Text>
                      <Text style={[TYPOGRAPHY.muted, styles.itemExtra]}>
                        from {item.vendorName}
                        {item.options && item.options.length > 0 && ` (${item.options.map(o => o.choiceLabel).join(', ')})`}
                      </Text>
                    </View>
                    <View style={styles.qtyStepperRow}>
                      <View style={styles.qtyBox}>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => cartStore.updateQuantity(item.id, item.quantity - 1)}>
                          <Ionicons name="remove" $$$ />
                        </TouchableOpacity>
                        <Text style={[TYPOGRAPHY.body, styles.qtyText]}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => cartStore.updateQuantity(item.id, item.quantity + 1)}>
                          <Ionicons name="add" $$$ />
                        </TouchableOpacity>
                      </View>
                      <Text style={[TYPOGRAPHY.body, styles.itemPrice]}>
                        ₦{((item.price + (item.options || []).reduce((s, o) => s + (o.additionalPrice || 0), 0)) * item.quantity).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Compound Fee Guidance Alert */}
            {quote && (
              <View style={styles.feeAlert}>
                <Ionicons name="warning" $$$ />
                <Text style={[TYPOGRAPHY.muted, styles.feeAlertText]}>
                  JABU campus-integrated courier fees compounded successfully across {cartStore.getItemCount()} packs/items.
                </Text>
              </View>
            )}

            {/* Payment Method Selector */}
            <View style={styles.sectionCard}>
              <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle, { marginBottom: 12 }]}>
                Payment Mode
              </Text>
              <View style={styles.paymentRow}>
                {(['Card', 'Transfer', 'Wallet'] as const).map((method) => {
                  const isDisabled = method === 'Transfer' || method === 'Wallet';
                  return (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentBtn,
                        paymentMethod === method ? styles.paymentBtnActive : styles.paymentBtnInactive,
                        isDisabled && styles.paymentBtnDisabled,
                      ]}
                      onPress={() => {
                        if (isDisabled) {
                          showToast(`${method} payment will be available in a future update.`, 'info');
                          return;
                        }
                        setPaymentMethod(method);
                      }}
                    >
                      <Text
                        style={[
                          TYPOGRAPHY.muted,
                          paymentMethod === method ? styles.paymentTextActive : styles.paymentTextInactive,
                          isDisabled && styles.paymentTextDisabled,
                        ]}
                      >
                        {method === 'Card' ? '💳 Paystack' : method === 'Transfer' ? '🏦 CoD Bank' : '📱 Wallet'}
                        {isDisabled && ' (Soon)'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Pricing Summary Breakdown */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={[TYPOGRAPHY.body, styles.summaryLabel]}>Basket Subtotal</Text>
                <Text style={[TYPOGRAPHY.body, styles.summaryVal]}>₦{subtotal.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[TYPOGRAPHY.body, styles.summaryLabel]}>Compounded Delivery Fee</Text>
                {isLoadingQuote ? (
                  <ActivityIndicator size="small" color={COLORS.secondary} />
                ) : (
                  <Text style={[TYPOGRAPHY.body, styles.summaryVal]}>₦{deliveryFee.toLocaleString()}</Text>
                )}
              </View>
              <View style={styles.summaryRow}>
                <Text style={[TYPOGRAPHY.body, styles.summaryLabel]}>Campus Platform Fee</Text>
                <Text style={[TYPOGRAPHY.body, styles.summaryVal]}>₦{platformServiceFee.toLocaleString()}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={[TYPOGRAPHY.subtitle, styles.totalLabel]}>Total Amount</Text>
                <Text style={[TYPOGRAPHY.headlineLg, styles.totalVal]}>
                  ₦{totalPayable.toLocaleString()}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Place Order CTA Footer */}
      {cartStore.items.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.payBtn, (!hasDeliveryDetails || checkoutMutation.isPending || isLoadingQuote) && styles.disabledPayBtn]}
            onPress={handlePlaceOrder}
            disabled={!hasDeliveryDetails || checkoutMutation.isPending || isLoadingQuote}
          >
            {checkoutMutation.isPending || isPayingOnline ? (
              <ActivityIndicator size="small" color={COLORS.onPrimary} />
            ) : (
              <>
                <Text style={[TYPOGRAPHY.subtitle, styles.payBtnText]}>
                  Proceed and Checkout • ₦{totalPayable.toLocaleString()}
                </Text>
                <Ionicons name="checkmark-circle" $$$ />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Address Management Drawer Modal */}
      <Modal visible={isAddressModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[TYPOGRAPHY.headlineLg, { color: COLORS.onSurface, fontWeight: '800' }]}>
                {isAddingNewAddress ? 'New Campus Address' : 'Select Hostel Address'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  if (isAddingNewAddress) {
                    setIsAddingNewAddress(false);
                  } else {
                    setIsAddressModalOpen(false);
                  }
                }}
              >
                <Ionicons name="add" $$$ />
              </TouchableOpacity>
            </View>

            {/* Adding Address Form */}
            {isAddingNewAddress ? (
              <ScrollView style={{ padding: SPACING.stackLg }} keyboardShouldPersistTaps="handled">
                <View style={styles.addressForm}>
                  {/* Select Location */}
                  <Text style={[TYPOGRAPHY.labelMini, styles.formLabel]}>CAMPUS LOCATION</Text>
                  <View style={styles.pickerReplacement}>
                    {locations.map((loc) => (
                      <TouchableOpacity
                        key={loc.id}
                        style={[
                          styles.pickerChoice,
                          newLocId === loc.id && styles.pickerChoiceActive,
                        ]}
                        onPress={() => setNewLocId(loc.id)}
                      >
                        <Text style={[styles.pickerChoiceText, newLocId === loc.id && styles.pickerChoiceTextActive]}>
                          🏢 {loc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Room Number */}
                  <Text style={[TYPOGRAPHY.labelMini, styles.formLabel, { marginTop: SPACING.gutter }]}>ROOM NUMBER</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Enter Room Number (e.g. Rm 308)"
                    value={newRoomNumber}
                    onChangeText={setNewRoomNumber}
                  />

                  {/* Label */}
                  <Text style={[TYPOGRAPHY.labelMini, styles.formLabel, { marginTop: SPACING.gutter }]}>ADDRESS LABEL / NAME</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Hostel Label (e.g. Female Hostel A, Male Hostel B)"
                    value={newLabel}
                    onChangeText={setNewLabel}
                  />

                  <TouchableOpacity
                    style={[styles.saveAddressBtn, createAddressMutation.isPending && styles.disabledPayBtn]}
                    onPress={handleAddNewAddressSubmit}
                    disabled={createAddressMutation.isPending}
                  >
                    {createAddressMutation.isPending ? (
                      <ActivityIndicator size="small" color={COLORS.onPrimary} />
                    ) : (
                      <Text style={styles.saveAddressBtnText}>Save Hostel Address</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              // List Saved Addresses
              <ScrollView style={{ padding: SPACING.stackLg }}>
                <TouchableOpacity style={styles.addAddressBtn} onPress={() => setIsAddingNewAddress(true)}>
                  <Ionicons name="add" $$$ />
                  <Text style={styles.addAddressBtnText}>Add New Hostel Address</Text>
                </TouchableOpacity>

                <View style={styles.addressList}>
                  {addressesList.map((addr: SavedAddress) => {
                    const isSelected = deliveryAddress.locationId === addr.locationId && deliveryAddress.roomNumber === addr.roomNumber;
                    return (
                      <TouchableOpacity
                        key={addr.id}
                        style={[styles.addressItemCard, isSelected && styles.addressItemCardSelected]}
                        onPress={() => {
                          deliveryAddress.setLocationId(addr.locationId);
                          deliveryAddress.setBlockId(addr.blockId || '');
                          deliveryAddress.setRoomId(addr.roomId || '');
                          deliveryAddress.setRoomNumber(addr.roomNumber);
                          deliveryAddress.setLabel(addr.label || '');
                          setIsAddressModalOpen(false);
                        }}
                      >
                        <View style={styles.addressItemLeft}>
                          <Text style={{ fontSize: 18 }}>🏢</Text>
                          <View>
                            <Text style={[TYPOGRAPHY.body, styles.addrLabelText]}>
                              {addr.label || 'Saved Location'}
                            </Text>
                            <Text style={[TYPOGRAPHY.muted, styles.addrSubText]}>
                              Room {addr.roomNumber} ({addr.location?.name || 'Campus location'})
                            </Text>
                          </View>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" $$$ />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.pagePadding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  backBtn: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
    marginLeft: 8,
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackMd,
    paddingBottom: 110,
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    ...SHADOWS.appCard,
  },
  shopBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  timingPills: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: SHAPES.roundedXl,
    padding: 4,
  },
  timingBtn: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: SHAPES.roundedCard,
  },
  timingBtnActive: {
    backgroundColor: COLORS.surfaceContainerLowest,
    ...SHADOWS.appCard,
  },
  timingTextActive: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  timingTextInactive: {
    color: COLORS.secondary,
  },
  timingSpan: {
    fontSize: 11,
    color: COLORS.outline,
    fontWeight: '400',
  },
  scheduleInput: {
    marginTop: 4,
  },
  scheduleTextInput: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    color: COLORS.onSurface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sectionCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  editLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    gap: SPACING.gutter,
    alignItems: 'center',
  },
  addressPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEBE9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressDetails: {
    flex: 1,
  },
  addressText: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  addressSub: {
    color: COLORS.outline,
    marginTop: 2,
  },
  missingAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.stackSm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: 14,
    height: 48,
  },
  missingAddressText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  itemList: {
    gap: SPACING.stackMd,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  itemExtra: {
    color: COLORS.outline,
    fontSize: 11,
    marginTop: 2,
  },
  qtyStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    padding: 3,
    gap: 6,
  },
  stepBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontWeight: '700',
    color: COLORS.onSurface,
    minWidth: 12,
    textAlign: 'center',
    fontSize: 12,
  },
  itemPrice: {
    fontWeight: '700',
    color: COLORS.onSurface,
    minWidth: 60,
    textAlign: 'right',
  },
  feeAlert: {
    flexDirection: 'row',
    gap: SPACING.stackSm,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedMd,
    padding: SPACING.gutter,
    alignItems: 'center',
  },
  feeAlertText: {
    color: COLORS.secondary,
    flex: 1,
    fontWeight: '600',
    fontSize: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: SPACING.stackSm,
  },
  paymentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  paymentBtnActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primary,
  },
  paymentBtnInactive: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderColor: COLORS.cardBorder,
  },
  paymentBtnDisabled: {
    opacity: 0.5,
  },
  paymentTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  paymentTextInactive: {
    color: COLORS.outline,
  },
  paymentTextDisabled: {
    color: COLORS.outline,
    fontStyle: 'italic',
  },
  summaryBox: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    gap: SPACING.stackSm,
    ...SHADOWS.appCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: COLORS.secondary,
  },
  summaryVal: {
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
  },
  totalLabel: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  totalVal: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: SPACING.pagePadding,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  payBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: SHAPES.roundedLg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.stackSm,
    ...SHADOWS.appCard,
  },
  disabledPayBtn: {
    opacity: 0.5,
  },
  payBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.stackLg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.stackSm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 14,
    height: 48,
    marginBottom: 20,
  },
  addAddressBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  addressList: {
    gap: SPACING.gutter,
  },
  addressItemCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.appCard,
  },
  addressItemCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryContainer,
  },
  addressItemLeft: {
    flexDirection: 'row',
    gap: SPACING.gutter,
    alignItems: 'center',
    flex: 1,
  },
  addrLabelText: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  addrSubText: {
    color: COLORS.outline,
    marginTop: 2,
    fontSize: 12,
  },
  addressForm: {
    gap: SPACING.stackMd,
  },
  formLabel: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  pickerReplacement: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.stackSm,
  },
  pickerChoice: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 14,
  },
  pickerChoiceActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primary,
  },
  pickerChoiceText: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
  pickerChoiceTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  formInput: {
    height: 48,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    color: COLORS.onSurface,
  },
  saveAddressBtn: {
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.gutter,
    ...SHADOWS.appCard,
  },
  saveAddressBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
});
