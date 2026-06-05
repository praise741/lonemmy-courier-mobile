import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playNotificationSound } from '../../utils/notificationSound';

interface OrderItem {
  id: string;
  orderNo: string;
  dest: string;
  timeAgo: string;
  status: string;
  items: { name: string; qty: number; price: number }[];
  totalPrice: number;
}

function formatTimeAgo(dateString: string) {
  if (!dateString) return 'Just now';
  try {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return created.toLocaleDateString();
  } catch (e) {
    return 'Recently';
  }
}

export default function VendorDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [storeOpen, setStoreOpen] = useState(user?.vendorProfile?.isOpen ?? false);
  const [activeTab, setActiveTab] = useState<'incoming' | 'completed'>('incoming');
  const [refreshing, setRefreshing] = useState(false);

  // Redirect to vendor setup if profile is incomplete
  useEffect(() => {
    if (user && !user?.vendorProfile?.businessName) {
      router.replace('/(vendor)/setup');
    }
  }, [user?.vendorProfile?.businessName]);

  // Synchronize switch status state when user details load/hydrate
  useEffect(() => {
    if (user?.vendorProfile) {
      setStoreOpen(user.vendorProfile.isOpen);
    }
  }, [user?.vendorProfile?.isOpen]);

  // 1. Fetch Vendor Dashboard Analytics
  const { data: analytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['vendorAnalytics'],
    queryFn: async () => {
      const res = await api.get('/analytics/vendor/dashboard');
      return res.data?.data ?? res.data;
    },
    refetchInterval: 15000, // Background poll every 15 seconds
    enabled: !!user,
  });

  // 2. Fetch Vendor Orders
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery<any[]>({
    queryKey: ['vendorOrders'],
    queryFn: async () => {
      const res = await api.get('/orders?role=VENDOR');
      return res.data?.data ?? res.data ?? [];
    },
    refetchInterval: 15000, // Background poll every 15 seconds
    enabled: !!user,
  });

  // 3. Toggle Open/Closed Mutation
  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch('/vendors/toggle-status');
      return res.data?.data ?? res.data;
    },
    onMutate: async () => {
      // Optimistic update
      const prev = storeOpen;
      setStoreOpen(!prev);
      return { prev };
    },
    onError: (err: any, _, context) => {
      if (context) setStoreOpen(context.prev);
      showToast(err.response?.data?.message || 'Failed to update store availability.', 'error');
    },
    onSuccess: (updatedVendor) => {
      const openState = updatedVendor?.isOpen ?? updatedVendor?.vendorProfile?.isOpen ?? storeOpen;
      setStoreOpen(openState);
      queryClient.invalidateQueries({ queryKey: ['vendorAnalytics'] });
      // Refetch user context in auth if needed, but locally we display updated state
    }
  });

  // 4. Accept Order Mutation
  const acceptMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.patch(`/orders/${orderId}/accept`);
      return res.data;
    },
    onSuccess: (_, orderId) => {
      showToast('Order accepted! Preparation started.', 'success');
      queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
      queryClient.invalidateQueries({ queryKey: ['vendorAnalytics'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to accept order.', 'error');
    }
  });

  // 5. Reject/Cancel Order Mutation
  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.patch(`/orders/${orderId}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      showToast('Order cancelled successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
      queryClient.invalidateQueries({ queryKey: ['vendorAnalytics'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to cancel order.', 'error');
    }
  });

  // Detect new incoming orders via polling and play an alert sound
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const raw = Array.isArray(ordersData) ? ordersData : [];
    const currentIds = new Set(raw.map((o: any) => o.id || o._id));

    // Check for orders that are NEW in this poll cycle and are PENDING
    const newPendingOrders = raw.filter(
      (o: any) =>
        !prevOrderIdsRef.current.has(o.id || o._id) &&
        (o.status === 'PENDING' || o.status === 'NEW'),
    );

    if (newPendingOrders.length > 0) {
      playNotificationSound();
    }

    prevOrderIdsRef.current = currentIds;
  }, [ordersData]);

  const handleToggleStore = () => {
    toggleMutation.mutate();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchAnalytics(), refetchOrders()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAcceptOrder = (id: string, orderNo: string) => {
    acceptMutation.mutate(id);
  };

  const handleRejectOrder = (id: string) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to reject and cancel this campus order?',
      [
        { text: 'Keep Order', style: 'cancel' },
        { text: 'Yes, Reject', style: 'destructive', onPress: () => cancelMutation.mutate(id) }
      ]
    );
  };

  // Map orders data into localized list UI models
  const rawOrdersList = Array.isArray(ordersData) ? ordersData : [];
  const mappedOrders: OrderItem[] = rawOrdersList.map(o => {
    return {
      id: o.id || o._id,
      orderNo: o.orderNumber || o.orderNo || `#${(o.id || '').slice(-4).toUpperCase()}`,
      dest: o.deliveryAddress || o.destination || 'JABU Campus Delivery',
      timeAgo: formatTimeAgo(o.createdAt),
      status: o.status || 'PENDING',
      totalPrice: o.totalPrice || o.total || 0,
      items: (o.items || []).map((it: any) => ({
        name: it.product?.name || it.name || 'Product Item',
        qty: it.quantity || it.qty || 1,
        price: it.price || it.product?.price || 0,
      })),
    };
  });

  // Filter lists based on tab:
  // Incoming queue: orders that are NOT completed/delivered or cancelled
  const incomingOrders = mappedOrders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
  const completedOrders = mappedOrders.filter(o => o.status === 'DELIVERED');

  const ordersToDisplay = activeTab === 'incoming' ? incomingOrders : completedOrders;

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(auth)/login')}>
          <Ionicons name="arrow-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Vendor Portal</Text>
        
        <View style={styles.headerRightActions}>
          {/* Menu Management Button */}
          <TouchableOpacity style={styles.menuManageBtn} onPress={() => router.push('/(vendor)/products')}>
            <Ionicons name="storefront" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile/edit')}>
            <Ionicons name="person" $$$ />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Store Status Toggle Hero */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[TYPOGRAPHY.subtitle, styles.cardMainTitle]}>Store Availability</Text>
              <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary }]}>
                {storeOpen ? 'Accepting new campus orders' : 'Closed - preparing current orders'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                { backgroundColor: storeOpen ? COLORS.primary : COLORS.outline }
              ]}
              onPress={handleToggleStore}
              disabled={toggleMutation.isPending}
            >
              <Text style={styles.toggleText}>{storeOpen ? 'OPEN' : 'CLOSED'}</Text>
              <View style={[styles.toggleCircle, { alignSelf: storeOpen ? 'flex-end' : 'flex-start' }]} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.metricsRow}>
            <View style={styles.metricCol}>
              <Text style={[TYPOGRAPHY.muted, styles.metricLabel]}>Active Orders</Text>
              <Text style={[TYPOGRAPHY.headlineLg, styles.metricVal]}>
                {analytics?.activeOrders ?? incomingOrders.length}
              </Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={[TYPOGRAPHY.muted, styles.metricLabel]}>Sales Today</Text>
              <Text style={[TYPOGRAPHY.headlineLg, styles.metricVal]}>
                ₦{(analytics?.todayEarnings || analytics?.earnings || 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={[TYPOGRAPHY.muted, styles.metricLabel]}>Est. Prep Time</Text>
              <Text style={[TYPOGRAPHY.headlineLg, styles.metricVal]}>
                {analytics?.estPrepTime || '15m'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Headers */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'incoming' && styles.tabBtnActive]}
            onPress={() => setActiveTab('incoming')}
          >
            <Text style={[TYPOGRAPHY.subtitle, activeTab === 'incoming' ? styles.tabTextActive : styles.tabTextInactive]}>
              Incoming Queue ({incomingOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'completed' && styles.tabBtnActive]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[TYPOGRAPHY.subtitle, activeTab === 'completed' ? styles.tabTextActive : styles.tabTextInactive]}>
              Completed ({completedOrders.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Orders queue content */}
        {ordersLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>Loading campus orders...</Text>
          </View>
        ) : (
          <View style={styles.queueContainer}>
            {ordersToDisplay.length > 0 ? (
              ordersToDisplay.map(order => {
                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.orderCard}
                    onPress={() => router.push({ pathname: '/(vendor)/order/[id]', params: { id: order.id } })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.orderCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderNoLabel}>ORDER {order.orderNo}</Text>
                        <Text style={[TYPOGRAPHY.subtitle, styles.orderDest]}>{order.dest}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <View style={[styles.statusIndicator, { backgroundColor: order.status === 'PENDING' ? COLORS.primary : COLORS.secondary }]} />
                          <Text style={[TYPOGRAPHY.muted, { fontSize: 11, textTransform: 'capitalize', marginLeft: 4 }]}>
                            {order.status.toLowerCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.timeBadge}>
                        <Text style={styles.timeText}>{order.timeAgo}</Text>
                      </View>
                    </View>

                    <View style={styles.orderItemsBox}>
                      {order.items.map((item, idx) => (
                        <View key={idx} style={styles.orderItemRow}>
                          <Text style={[TYPOGRAPHY.body, styles.orderItemLabel]}>
                            {item.qty}x {item.name}
                          </Text>
                          <Text style={[TYPOGRAPHY.body, styles.orderItemPrice]}>
                            ₦{item.price.toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.totalRow}>
                      <Text style={[TYPOGRAPHY.muted, { fontWeight: '700' }]}>Total</Text>
                      <Text style={[TYPOGRAPHY.headlineLg, { color: COLORS.primary }]}>
                        ₦{order.totalPrice.toLocaleString()}
                      </Text>
                    </View>

                    {activeTab === 'incoming' && (
                      <View style={styles.orderCardFooter}>
                        {order.status === 'PENDING' ? (
                          <>
                            <TouchableOpacity
                              style={styles.rejectBtn}
                              onPress={(e) => { e.stopPropagation?.(); handleRejectOrder(order.id); }}
                              disabled={cancelMutation.isPending}
                            >
                              <Text style={[TYPOGRAPHY.subtitle, styles.rejectBtnText]}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.acceptBtn}
                              onPress={(e) => { e.stopPropagation?.(); handleAcceptOrder(order.id, order.orderNo); }}
                              disabled={acceptMutation.isPending}
                            >
                              {acceptMutation.isPending ? (
                                <ActivityIndicator size="small" color={COLORS.onPrimary} />
                              ) : (
                                <Text style={[TYPOGRAPHY.subtitle, styles.acceptBtnText]}>Accept</Text>
                              )}
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View style={styles.prepMessageCard}>
                            <Text style={styles.prepMessageText}>🧑‍🍳 Preparing and waiting for courier dispatch</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 32 }}>🍳</Text>
                <Text style={[TYPOGRAPHY.subtitle, styles.emptyText]}>
                  {activeTab === 'incoming' ? 'Queue is currently empty' : 'No completed orders yet'}
                </Text>
                <Text style={[TYPOGRAPHY.muted, styles.emptySub]}>
                  {activeTab === 'incoming' ? 'New student orders will alert here.' : 'Completed orders will list here.'}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Product FAB */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.addFab} onPress={() => router.push('/(vendor)/add-product')}>
          <Ionicons name="add" $$$ />
        </TouchableOpacity>
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pagePadding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  menuManageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackLg,
    paddingBottom: 100,
  },
  statusCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedXl,
    padding: SPACING.pagePadding,
    ...SHADOWS.appCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  cardMainTitle: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  toggleBtn: {
    width: 110,
    height: 40,
    borderRadius: SHAPES.roundedCard,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 11,
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.white,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingTop: 12,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: COLORS.secondary,
    fontWeight: '600',
    fontSize: 11,
  },
  metricVal: {
    color: COLORS.onSurface,
    fontWeight: '800',
    marginTop: 4,
    fontSize: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabBtnActive: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.primary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabTextInactive: {
    color: COLORS.secondary,
  },
  queueContainer: {
    gap: SPACING.stackMd,
  },
  orderCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedXl,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.outline,
    letterSpacing: 1,
  },
  orderDest: {
    color: COLORS.onSurface,
    fontWeight: '700',
    marginTop: 2,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timeBadge: {
    backgroundColor: COLORS.errorContainer,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: SHAPES.roundedDefault,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  orderItemsBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    padding: SPACING.gutter,
    gap: SPACING.stackSm,
    marginBottom: 12,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemLabel: {
    color: COLORS.onSurfaceVariant,
  },
  orderItemPrice: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: SPACING.stackMd,
  },
  orderCardFooter: {
    flexDirection: 'row',
    gap: SPACING.gutter,
  },
  prepMessageCard: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(20, 27, 44, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  prepMessageText: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
  rejectBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtnText: {
    color: COLORS.onSurfaceVariant,
    fontWeight: '700',
  },
  acceptBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  acceptBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: SPACING.stackSm,
  },
  emptyText: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  emptySub: {
    color: COLORS.secondary,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 999,
  },
  addFab: {
    width: 56,
    height: 56,
    borderRadius: SHAPES.roundedShell,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
});
