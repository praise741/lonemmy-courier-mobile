import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

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
  orderNumber?: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  isPaid: boolean;
  deliveryAddressText: string;
  roomNumber?: string;
  note?: string | null;
  createdAt: string;
  items: OrderItem[];
  customer?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  courier?: {
    id: string;
    name: string;
    phone?: string;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: COLORS.primary, bg: COLORS.errorContainer },
  PREPARING: { label: 'Preparing', color: '#E67E22', bg: '#FFF3E0' },
  READY: { label: 'Ready', color: '#27AE60', bg: '#E6FFED' },
  IN_TRANSIT: { label: 'In Transit', color: '#2980B9', bg: '#EBF5FB' },
  DELIVERED: { label: 'Delivered', color: '#1A7F37', bg: '#E6FFED' },
  CANCELLED: { label: 'Cancelled', color: '#C41D7F', bg: '#FFF0F6' },
};

export default function VendorOrderDetail() {
  const router = useRouter();
  const { id: orderId } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: order, isLoading, error } = useQuery<OrderDetail>({
    queryKey: ['vendor-order-detail', orderId],
    queryFn: async () => {
      const response = await api.get(`/orders/${orderId}`);
      return response.data?.data ?? response.data;
    },
    refetchInterval: 10000,
    enabled: !!orderId,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/orders/${orderId}/accept`);
      return res.data;
    },
    onSuccess: () => {
      showToast('Order accepted! You are now preparing this order.', 'success');
      queryClient.invalidateQueries({ queryKey: ['vendor-order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to accept order.', 'error');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/orders/${orderId}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      showToast('Order cancelled', 'success');
      queryClient.invalidateQueries({ queryKey: ['vendor-order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to cancel order.', 'error');
    },
  });

  const handleAccept = () => {
    acceptMutation.mutate();
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This cannot be undone.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(),
        },
      ]
    );
  };

  const handleCallCustomer = () => {
    if (order?.customer?.phone) {
      Linking.openURL(`tel:${order.customer.phone}`);
    }
  };

  const handleCallCourier = () => {
    if (order?.courier?.phone) {
      Linking.openURL(`tel:${order.courier.phone}`);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" $$$ />
          <Text style={[TYPOGRAPHY.body, { color: COLORS.primary, marginTop: SPACING.gutter }]}>
            Failed to load order details
          </Text>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
  const isPending = order.status === 'PENDING';

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Order Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Order Reference Card */}
        <View style={styles.refCard}>
          <Text style={[TYPOGRAPHY.labelMini, styles.refLabel]}>ORDER REFERENCE</Text>
          <Text style={[TYPOGRAPHY.headlineLg, styles.refId]}>
            {order.orderNumber || `#${order.id.slice(-6).toUpperCase()}`}
          </Text>
          <View style={styles.statusBadgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[TYPOGRAPHY.labelMini, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            <Text style={[TYPOGRAPHY.muted, styles.dateText]}>
              {new Date(order.createdAt).toLocaleDateString('en-NG', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>

        {/* Customer Info Card */}
        {order.customer && (
          <View style={styles.detailsCard}>
            <Text style={[TYPOGRAPHY.subtitle, styles.cardTitle]}>Customer</Text>
            <View style={styles.customerRow}>
              <View style={styles.customerAvatar}>
                <Ionicons name="person" $$$ />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[TYPOGRAPHY.subtitle, styles.customerName]}>
                  {order.customer.name}
                </Text>
                {order.customer.phone && (
                  <TouchableOpacity onPress={handleCallCustomer}>
                    <Text style={[TYPOGRAPHY.muted, styles.phoneText]}>
                      📞 {order.customer.phone}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {order.customer.phone && (
                <TouchableOpacity style={styles.callBtn} onPress={handleCallCustomer}>
                  <Ionicons name="call" $$$ />
                  <Text style={styles.callText}>Call</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.addressRow}>
              <Text style={{ fontSize: 18 }}>📍</Text>
              <View style={{ flex: 1 }}>
                {order.roomNumber && (
                  <Text style={[TYPOGRAPHY.body, styles.addressText]}>
                    Room {order.roomNumber}
                  </Text>
                )}
                <Text style={[TYPOGRAPHY.muted, styles.addressDetailsText]}>
                  {order.deliveryAddressText}
                </Text>
              </View>
            </View>

            {order.note && (
              <View style={styles.noteBox}>
                <Text style={[TYPOGRAPHY.labelMini, { color: COLORS.secondary, fontWeight: '700' }]}>
                  CUSTOMER NOTE:
                </Text>
                <Text style={[TYPOGRAPHY.body, styles.noteText]}>{order.note}</Text>
              </View>
            )}
          </View>
        )}

        {/* Order Items */}
        <View style={styles.detailsCard}>
          <Text style={[TYPOGRAPHY.subtitle, styles.cardTitle]}>Order Items</Text>

          <View style={styles.itemsList}>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[TYPOGRAPHY.body, styles.itemName]}>
                    {item.productName}{' '}
                    <Text style={{ color: COLORS.primary }}>x{item.qty}</Text>
                  </Text>
                  {item.options && item.options.length > 0 && (
                    <Text style={[TYPOGRAPHY.muted, styles.itemOptionsText]}>
                      {item.options.map((o) => `${o.groupName}: ${o.choiceLabel}`).join(', ')}
                    </Text>
                  )}
                </View>
                <Text style={[TYPOGRAPHY.body, styles.itemLinePrice]}>
                  N{Number(item.lineTotal).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.pricingBreakdown}>
            <View style={styles.priceRow}>
              <Text style={[TYPOGRAPHY.body, styles.priceLabel]}>Subtotal</Text>
              <Text style={[TYPOGRAPHY.body, styles.priceValue]}>
                N{Number(order.subtotal).toLocaleString()}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[TYPOGRAPHY.body, styles.priceLabel]}>Delivery Fee</Text>
              <Text style={[TYPOGRAPHY.body, styles.priceValue]}>
                N{Number(order.deliveryFee).toLocaleString()}
              </Text>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.priceRow}>
              <Text style={[TYPOGRAPHY.subtitle, styles.totalLabel]}>Total ({order.paymentMethod?.toUpperCase() || 'N/A'})</Text>
              <Text style={[TYPOGRAPHY.headlineLg, styles.totalVal]}>
                N{Number(order.total).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Courier Info */}
        {order.courier ? (
          <View style={styles.detailsCard}>
            <Text style={[TYPOGRAPHY.subtitle, styles.cardTitle]}>Assigned Courier</Text>
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
          !isPending && order.status !== 'CANCELLED' && (
            <View style={styles.noCourierCard}>
              <ActivityIndicator size="small" color={COLORS.secondary} />
              <Text style={[TYPOGRAPHY.muted, styles.noCourierText]}>
                Searching for available courier...
              </Text>
            </View>
          )
        )}

        {/* Action Buttons for PENDING */}
        {isPending && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.cancelOrderBtn}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator size="small" color={COLORS.onSurfaceVariant} />
              ) : (
                <Text style={[TYPOGRAPHY.subtitle, styles.cancelOrderText]}>Cancel Order</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptOrderBtn}
              onPress={handleAccept}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <ActivityIndicator size="small" color={COLORS.onPrimary} />
              ) : (
                <>
                  <Text style={[TYPOGRAPHY.subtitle, styles.acceptOrderText]}>Accept Order</Text>
                  <Ionicons name="checkmark-circle" $$$ />
                </>
              )}
            </TouchableOpacity>
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
    color: COLORS.primary,
    fontWeight: '800',
    marginLeft: 8,
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackMd,
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: COLORS.background,
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
  statusBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: SHAPES.roundedDefault,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dateText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
  },
  detailsCard: {
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
    marginBottom: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: SHAPES.roundedXl,
    backgroundColor: COLORS.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerName: {
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  phoneText: {
    marginTop: 2,
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
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 14,
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
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.gutter,
  },
  cancelOrderBtn: {
    flex: 1,
    height: 52,
    borderRadius: SHAPES.roundedLg,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cancelOrderText: {
    color: COLORS.onSurfaceVariant,
    fontWeight: '700',
  },
  acceptOrderBtn: {
    flex: 1,
    height: 52,
    borderRadius: SHAPES.roundedLg,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.stackSm,
    ...SHADOWS.appCard,
  },
  acceptOrderText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
});
