import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { playNotificationSound } from '../../../utils/notificationSound';
import { useToast } from '@/context/ToastContext';

interface OrderItemOption {
  id: string;
  groupName: string;
  choiceLabel: string;
  additionalPrice: number;
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string | null;
  qty: number;
  price: number;
  additionalPrice: number;
  lineTotal: number;
  options: OrderItemOption[];
}

interface OrderDetail {
  id: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  isPaid: boolean;
  deliveryAddressText: string;
  roomNumber: string;
  note?: string | null;
  createdAt: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  items: OrderItem[];
  vendor: {
    id: string;
    businessName: string;
    image?: string | null;
    address: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
  courier?: {
    id: string;
    name: string;
    phone?: string;
  } | null;
}

export default function OrderTracking() {
  const router = useRouter();
  const { id: orderId } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Fetch Order Details with 5-second polling interval for real-time tracking updates
  const { data: order, isLoading, error } = useQuery<OrderDetail>({
    queryKey: ['order-detail', orderId],
    queryFn: async () => {
      const response = await api.get(`/orders/${orderId}`);
      return response.data?.data ?? response.data;
    },
    refetchInterval: 5000, // 5 seconds polling
    enabled: !!orderId,
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        orderId,
        vendorId: order?.vendor?.id,
        rating,
      };
      if (reviewComment.trim()) {
        payload.comment = reviewComment.trim();
      }
      const res = await api.post('/reviews', payload);
      return res.data;
    },
    onSuccess: () => {
      setReviewSubmitted(true);
      showToast('Thank you for rating your experience!', 'success');
      queryClient.invalidateQueries({ queryKey: ['vendor', order?.vendor?.id] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to submit review.', 'error');
    },
  });

  // Play subtle sound when order status changes during polling
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (order?.status) {
      if (prevStatusRef.current && prevStatusRef.current !== order.status) {
        playNotificationSound();
      }
      prevStatusRef.current = order.status;
    }
  }, [order?.status]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>Fetching tracker data...</Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" $$$ />
        <Text style={[TYPOGRAPHY.body, { color: COLORS.primary, marginTop: SPACING.gutter }]}>
          Failed to load tracker details
        </Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/(customer)/home')}>
          <Text style={styles.backLinkText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const milestones = [
    { key: 'PLACED', label: 'Order Placed', desc: 'Received by kitchen', icon: 'check_circle' },
    { key: 'PREPARING', label: 'Preparing Meal', desc: 'Kitchen preparing your order', icon: 'food' },
    { key: 'READY', label: 'Ready for Pickup', desc: 'Awaiting campus courier', icon: 'shop' },
    { key: 'IN_TRANSIT', label: 'Out for Delivery', desc: 'Courier on their way to room', icon: 'delivery' },
    { key: 'DELIVERED', label: 'Delivered', desc: 'Package arrived at room', icon: 'check_circle' },
  ];

  const getMilestoneIndex = (status: OrderDetail['status']) => {
    switch (status) {
      case 'PENDING':
        return 0;
      case 'PREPARING':
        return 1;
      case 'READY':
        return 2;
      case 'IN_TRANSIT':
        return 3;
      case 'DELIVERED':
        return 4;
      default:
        return 0;
    }
  };

  const currentMilestoneIndex = getMilestoneIndex(order.status);
  const isCancelled = order.status === 'CANCELLED';

  const handleCallCourier = () => {
    if (order.courier?.phone) {
      Linking.openURL(`tel:${order.courier.phone}`);
    }
  };

  // Derive coordinates from API response; null if unavailable
  const vendorLatRaw = order.vendor?.latitude;
  const vendorLngRaw = order.vendor?.longitude;
  const customerLatRaw = order.latitude;
  const customerLngRaw = order.longitude;

  const vendorLat = vendorLatRaw != null ? Number(vendorLatRaw) : null;
  const vendorLng = vendorLngRaw != null ? Number(vendorLngRaw) : null;
  const customerLat = customerLatRaw != null ? Number(customerLatRaw) : null;
  const customerLng = customerLngRaw != null ? Number(customerLngRaw) : null;

  const hasMapCoords =
    vendorLat != null && vendorLng != null &&
    customerLat != null && customerLng != null &&
    !isNaN(vendorLat) && !isNaN(vendorLng) &&
    !isNaN(customerLat) && !isNaN(customerLng);

  let courierLat: number | null = vendorLat;
  let courierLng: number | null = vendorLng;

  if (hasMapCoords) {
    if (order.status === 'IN_TRANSIT') {
      courierLat = vendorLat! + (customerLat! - vendorLat!) * 0.6;
      courierLng = vendorLng! + (customerLng! - vendorLng!) * 0.6;
    } else if (order.status === 'DELIVERED') {
      courierLat = customerLat;
      courierLng = customerLng;
    }
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(customer)/orders')}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Live Order Tracker</Text>
        <TouchableOpacity style={styles.historyLink} onPress={() => router.replace('/(customer)/orders')}>
          <Text style={styles.historyLinkText}>History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Tracking Reference Info */}
        <View style={styles.refCard}>
          <Text style={[TYPOGRAPHY.labelMini, styles.refLabel]}>ORDER ID REFERENCE</Text>
          <Text style={[TYPOGRAPHY.headlineLg, styles.refId]}>#{order.id.toUpperCase()}</Text>
          <Text style={[TYPOGRAPHY.muted, styles.refDate]}>
            Placed on {new Date(order.createdAt).toLocaleDateString('en-NG', {
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Live Courier Tracking Map */}
        {!isCancelled && (
          <View style={styles.mapCard}>
            <Text style={[TYPOGRAPHY.subtitle, styles.cardTitle, { marginBottom: 12 }]}>
              Live Courier Tracking
            </Text>
            {hasMapCoords ? (
              <View style={styles.mapMock}>
                <MapView
                  style={StyleSheet.absoluteFill}
                  initialRegion={{
                    latitude: (vendorLat! + customerLat!) / 2,
                    longitude: (vendorLng! + customerLng!) / 2,
                    latitudeDelta: Math.max(Math.abs(vendorLat! - customerLat!) * 1.8, 0.01),
                    longitudeDelta: Math.max(Math.abs(vendorLng! - customerLng!) * 1.8, 0.01),
                  }}
                >
                  <Marker
                    coordinate={{ latitude: vendorLat!, longitude: vendorLng! }}
                    title={order.vendor.businessName}
                    description={order.vendor.address}
                    pinColor="red"
                  />
                  <Marker
                    coordinate={{ latitude: customerLat!, longitude: customerLng! }}
                    title="Your Dropoff Room"
                    description={`Room ${order.roomNumber || ''}`}
                    pinColor="blue"
                  />
                  {order.courier && courierLat != null && courierLng != null && (
                    <Marker
                      coordinate={{ latitude: courierLat, longitude: courierLng }}
                      title={order.courier.name}
                      description="JABU Live Courier Position"
                    >
                      <View style={styles.courierMarker}>
                        <Text style={{ fontSize: 20 }}>🚴</Text>
                      </View>
                    </Marker>
                  )}
                  <Polyline
                    coordinates={[
                      { latitude: vendorLat!, longitude: vendorLng! },
                      { latitude: customerLat!, longitude: customerLng! }
                    ]}
                    strokeColor={COLORS.primary}
                    strokeWidth={3}
                  />
                </MapView>
              </View>
            ) : (
              <View style={styles.mapUnavailable}>
                <Ionicons name="warning" $$$ />
                <Text style={[TYPOGRAPHY.muted, styles.mapUnavailableText]}>
                  Map data unavailable
                </Text>
                <Text style={[TYPOGRAPHY.muted, { fontSize: 11, textAlign: 'center' }]}>
                  Location coordinates are being retrieved from the campus API
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Cancellation Alert */}
        {isCancelled && (
          <View style={styles.cancelledCard}>
            <Ionicons name="warning" $$$ />
            <View style={{ flex: 1 }}>
              <Text style={[TYPOGRAPHY.subtitle, styles.cancelledTitle]}>Order Cancelled</Text>
              <Text style={[TYPOGRAPHY.body, styles.cancelledDesc]}>
                This order was rejected or cancelled by the kitchen/payout system. Contact support.
              </Text>
            </View>
          </View>
        )}

        {/* Dynamic tracking stepper */}
        {!isCancelled && (
          <View style={styles.stepperCard}>
            <Text style={[TYPOGRAPHY.subtitle, styles.cardTitle]}>Delivery Tracker Progress</Text>
            
            <View style={styles.stepperContainer}>
              {milestones.map((milestone, idx) => {
                const isCompleted = idx <= currentMilestoneIndex;
                const isActive = idx === currentMilestoneIndex;
                const showLine = idx < milestones.length - 1;

                return (
                  <View key={milestone.key} style={styles.stepRow}>
                    <View style={styles.indicatorCol}>
                      <View
                        style={[
                          styles.dotCircle,
                          isCompleted ? styles.dotCircleCompleted : styles.dotCirclePending,
                          isActive && styles.dotCircleActive,
                        ]}
                      >
                        <Ionicons
                          name={milestone.icon as any}
                          size={12}
                          color={isCompleted ? COLORS.onPrimary : COLORS.outline}
                        />
                      </View>
                      {showLine && (
                        <View
                          style={[
                            styles.lineConnector,
                            idx < currentMilestoneIndex ? styles.lineCompleted : styles.linePending,
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.stepDetails}>
                      <Text
                        style={[
                          TYPOGRAPHY.body,
                          styles.stepLabel,
                          isCompleted && styles.stepLabelCompleted,
                          isActive && styles.stepLabelActive,
                        ]}
                      >
                        {milestone.label}
                      </Text>
                      <Text style={[TYPOGRAPHY.muted, styles.stepDesc]}>
                        {milestone.desc}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Assigned Courier Runner Profile card */}
        {order.courier ? (
          <View style={styles.courierCard}>
            <Text style={[TYPOGRAPHY.subtitle, styles.cardTitle, { marginBottom: 12 }]}>
              Campus Courier Runner
            </Text>
            <View style={styles.courierRow}>
              <View style={styles.courierAvatar}>
                <Ionicons name="person" $$$ />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[TYPOGRAPHY.subtitle, styles.courierName]}>
                  {order.courier.name}
                </Text>
                <Text style={[TYPOGRAPHY.muted, styles.courierRole]}>
                  Lonemmy Courier Dispatcher
                </Text>
              </View>
              {order.courier.phone && (
                <TouchableOpacity style={styles.callBtn} onPress={handleCallCourier}>
                  <Ionicons name="call" $$$ />
                  <Text style={styles.callText}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          !isCancelled && (
            <View style={styles.noCourierCard}>
              <ActivityIndicator size="small" color={COLORS.secondary} />
              <Text style={[TYPOGRAPHY.muted, styles.noCourierText]}>
                Searching for closest available JABU courier...
              </Text>
            </View>
          )
        )}

        {/* Order Details & Summary Breakdown */}
        <View style={styles.detailsCard}>
          <Text style={[TYPOGRAPHY.subtitle, styles.cardTitle, { marginBottom: 12 }]}>
            Summary Breakdown
          </Text>

          <View style={styles.vendorHeader}>
            <Ionicons name="storefront" size={16} color={COLORS.secondary} />
            <Text style={[TYPOGRAPHY.subtitle, styles.vendorNameTitle]}>
              {order.vendor.businessName}
            </Text>
          </View>

          <View style={styles.itemsList}>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[TYPOGRAPHY.body, styles.itemName]}>
                    {item.productName} <Text style={{ color: COLORS.primary }}>x{item.qty}</Text>
                  </Text>
                  {item.options && item.options.length > 0 && (
                    <Text style={[TYPOGRAPHY.muted, styles.itemOptionsText]}>
                      {item.options.map((o) => `${o.groupName}: ${o.choiceLabel}`).join(', ')}
                    </Text>
                  )}
                </View>
                <Text style={[TYPOGRAPHY.body, styles.itemLinePrice]}>
                  ₦{Number(item.lineTotal).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.pricingBreakdown}>
            <View style={styles.priceRow}>
              <Text style={[TYPOGRAPHY.body, styles.priceLabel]}>Basket Subtotal</Text>
              <Text style={[TYPOGRAPHY.body, styles.priceValue]}>
                ₦{Number(order.subtotal).toLocaleString()}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[TYPOGRAPHY.body, styles.priceLabel]}>Compounded Delivery Fee</Text>
              <Text style={[TYPOGRAPHY.body, styles.priceValue]}>
                ₦{Number(order.deliveryFee).toLocaleString()}
              </Text>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.priceRow}>
              <Text style={[TYPOGRAPHY.subtitle, styles.totalLabel]}>Total Paid ({order.paymentMethod.toUpperCase()})</Text>
              <Text style={[TYPOGRAPHY.headlineLg, styles.totalVal]}>
                ₦{Number(order.total).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Hostel Address Information card */}
        <View style={styles.detailsCard}>
          <Text style={[TYPOGRAPHY.subtitle, styles.cardTitle, { marginBottom: 8 }]}>
            Delivery Address
          </Text>
          <View style={styles.addressRow}>
            <Text style={{ fontSize: 18 }}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={[TYPOGRAPHY.body, styles.addressText]}>
                Room {order.roomNumber || ' Hostel Room'}
              </Text>
              <Text style={[TYPOGRAPHY.muted, styles.addressDetailsText]}>
                {order.deliveryAddressText}
              </Text>
            </View>
          </View>
          {order.note && (
            <View style={styles.noteBox}>
              <Text style={[TYPOGRAPHY.labelMini, { color: COLORS.secondary, fontWeight: '700' }]}>
                CUSTOMER INSTRUCTION NOTE:
              </Text>
              <Text style={[TYPOGRAPHY.body, styles.noteText]}>{order.note}</Text>
            </View>
          )}
        </View>

        {order.status === 'DELIVERED' && (
          <View style={styles.detailsCard}>
            <Text style={[TYPOGRAPHY.subtitle, styles.cardTitle]}>
              {reviewSubmitted ? 'Review Submitted' : 'Rate this vendor'}
            </Text>

            {reviewSubmitted ? (
              <View style={styles.reviewThanksRow}>
                <Text style={[TYPOGRAPHY.muted, { color: COLORS.primary, textAlign: 'center' }]}>
                  Thank you for your feedback! Your review helps improve campus delivery experience.
                </Text>
              </View>
            ) : (
              <View style={{ gap: SPACING.stackMd }}>
                <View style={styles.starRatingRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRating(star)}
                      style={styles.starBtn}
                    >
                      <Ionicons name="star" $$$ />
                    </TouchableOpacity>
                  ))}
                </View>
                {rating > 0 && (
                  <Text style={[TYPOGRAPHY.muted, { textAlign: 'center', color: COLORS.secondary }]}>
                    {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Okay' : 'Poor'} ({rating}/5)
                  </Text>
                )}

                <TextInput
                  style={[TYPOGRAPHY.body, styles.reviewInput]}
                  placeholder="Share your experience (optional)..."
                  placeholderTextColor={COLORS.outline}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={styles.submitReviewBtn}
                  onPress={() => {
                    if (rating === 0) {
                      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
                      return;
                    }
                    reviewMutation.mutate();
                  }}
                  disabled={reviewMutation.isPending}
                >
                  {reviewMutation.isPending ? (
                    <ActivityIndicator size="small" color={COLORS.onPrimary} />
                  ) : (
                    <Text style={[TYPOGRAPHY.subtitle, styles.submitReviewText]}>
                      Submit Review
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
    flex: 1,
  },
  historyLink: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  historyLinkText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackMd,
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  backLink: {
    marginTop: 20,
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: SHAPES.roundedMd,
  },
  backLinkText: {
    color: COLORS.onSecondary,
    fontWeight: '700',
  },
  refCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: SHAPES.roundedXl,
    padding: 20,
    ...SHADOWS.appCard,
  },
  mapCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedXl,
    padding: 20,
    ...SHADOWS.appCard,
  },
  mapMock: {
    height: 180,
    backgroundColor: COLORS.divider,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.divider,
    position: 'relative',
  },
  mapUnavailable: {
    height: 180,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.stackSm,
    paddingHorizontal: 20,
  },
  mapUnavailableText: {
    color: COLORS.outline,
    fontWeight: '600',
    fontSize: 13,
  },
  courierMarker: {
    backgroundColor: COLORS.white,
    padding: 4,
    borderRadius: SHAPES.roundedCard,
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  refLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '700',
  },
  refId: {
    color: COLORS.onSecondary,
    fontWeight: '800',
    fontSize: 22,
    marginTop: 4,
  },
  refDate: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    fontSize: 12,
  },
  cancelledCard: {
    flexDirection: 'row',
    gap: SPACING.gutter,
    backgroundColor: '#FFF0F6',
    borderWidth: 1,
    borderColor: '#FFD6E7',
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    alignItems: 'center',
  },
  cancelledTitle: {
    color: '#C41D7F',
    fontWeight: '800',
  },
  cancelledDesc: {
    color: '#C41D7F',
    marginTop: 2,
    fontSize: 12,
  },
  stepperCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedXl,
    padding: 20,
    ...SHADOWS.appCard,
  },
  cardTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  stepperContainer: {
    marginTop: 20,
    paddingLeft: 8,
  },
  stepRow: {
    flexDirection: 'row',
    gap: SPACING.stackMd,
    minHeight: 64,
  },
  indicatorCol: {
    alignItems: 'center',
  },
  dotCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  dotCircleCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dotCirclePending: {
    backgroundColor: COLORS.surfaceContainer,
    borderColor: COLORS.outlineVariant,
  },
  dotCircleActive: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lineConnector: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  lineCompleted: {
    backgroundColor: COLORS.primary,
  },
  linePending: {
    backgroundColor: COLORS.outlineVariant,
  },
  stepDetails: {
    flex: 1,
    paddingTop: 3,
  },
  stepLabel: {
    fontWeight: '700',
    color: COLORS.outline,
  },
  stepLabelCompleted: {
    color: COLORS.onSurface,
  },
  stepLabelActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  stepDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  courierCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedXl,
    padding: 20,
    ...SHADOWS.appCard,
  },
  courierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  courierAvatar: {
    width: 48,
    height: 48,
    borderRadius: SHAPES.roundedXl,
    backgroundColor: COLORS.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courierName: {
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  courierRole: {
    fontSize: 11,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: SHAPES.roundedMd,
    ...SHADOWS.appCard,
  },
  callText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  noCourierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.stackSm,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedCard,
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  noCourierText: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
  detailsCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedXl,
    padding: 20,
    ...SHADOWS.appCard,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
    marginBottom: SPACING.stackMd,
  },
  vendorNameTitle: {
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  itemsList: {
    gap: SPACING.stackMd,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  itemOptionsText: {
    fontSize: 11,
    marginTop: 2,
  },
  itemLinePrice: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 14,
  },
  pricingBreakdown: {
    gap: SPACING.stackSm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    color: COLORS.secondary,
  },
  priceValue: {
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  totalLabel: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  totalVal: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  addressRow: {
    flexDirection: 'row',
    gap: SPACING.gutter,
    alignItems: 'center',
  },
  addressText: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  addressDetailsText: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  noteBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    padding: SPACING.gutter,
    marginTop: SPACING.gutter,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  noteText: {
    color: COLORS.onSurfaceVariant,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  starRatingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.stackSm,
  },
  starBtn: {
    padding: 4,
  },
  reviewThanksRow: {
    paddingVertical: 16,
  },
  reviewInput: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedMd,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.onSurface,
    minHeight: 80,
  },
  submitReviewBtn: {
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: SHAPES.roundedLg,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  submitReviewText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
});
