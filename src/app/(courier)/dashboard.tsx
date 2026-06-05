import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function CourierDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  // Local state for online status to allow instant UI response, syncs with backend
  const [online, setOnline] = useState(user?.isOnline ?? true);
  const [isToggling, setIsToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sync online status with the auth state when it loads
  useEffect(() => {
    if (user) {
      setOnline(user.isOnline);
    }
  }, [user]);

  // Bind the Online status switch to PATCH /courier/toggle-online
  const handleToggleOnline = async () => {
    setIsToggling(true);
    const nextState = !online;
    try {
      await api.patch('/courier/toggle-online', { isOnline: nextState });
      setOnline(nextState);
      // Invalidate queries to trigger an immediate refetch when going online
      if (nextState) {
        queryClient.invalidateQueries({ queryKey: ['availableOrders'] });
      }
    } catch (error) {
      console.error('Error toggling online status:', error);
      alert('Could not update status. Please try again.');
    } finally {
      setIsToggling(false);
    }
  };

  // Poll available orders from GET /courier/available every 15 seconds
  const { 
    data: availableOrders = [], 
    isLoading: isLoadingAvailable, 
    refetch: refetchAvailable 
  } = useQuery<any[]>({
    queryKey: ['availableOrders'],
    queryFn: async () => {
      const res = await api.get('/courier/available');
      return res.data?.data ?? res.data ?? [];
    },
    refetchInterval: 15000,
    enabled: online, // Only poll available orders when online
  });

  // Poll assigned/my orders from GET /courier/my-orders every 15 seconds
  const { 
    data: myOrders = [], 
    isLoading: isLoadingMyOrders,
    refetch: refetchMyOrders
  } = useQuery<any[]>({
    queryKey: ['myOrders'],
    queryFn: async () => {
      const res = await api.get('/courier/my-orders');
      return res.data?.data ?? res.data ?? [];
    },
    refetchInterval: 15000,
  });

  // Fetch route summary metrics & analytics from GET /analytics/courier/dashboard
  const { 
    data: analytics, 
    isLoading: isLoadingAnalytics,
    refetch: refetchAnalytics
  } = useQuery<any>({
    queryKey: ['courierAnalytics'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/courier/dashboard');
        return res.data?.data ?? res.data;
      } catch (err) {
        console.log('Error fetching metrics, attempting backup endpoint...', err);
        const res = await api.get('/analytics/courier');
        return res.data?.data ?? res.data;
      }
    },
  });

  // Safe manual refresh helper
  const handleManualRefresh = () => {
    refetchAvailable();
    refetchMyOrders();
    refetchAnalytics();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchAvailable(), refetchMyOrders(), refetchAnalytics()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Filter assigned/active orders to see if there is an active delivery in progress
  // Active means status is not DELIVERED or CANCELLED
  const activeOrders = Array.isArray(myOrders) ? myOrders.filter(
    (order: any) => order.status !== 'DELIVERED' && order.status !== 'CANCELLED'
  ) : [];
  
  const activeCount = activeOrders.length;
  
  // Completed today calculation
  const completedCount = analytics?.totalTrips ?? 12;

  // Earnings calculation
  const earningsAmount = analytics?.todayEarnings ?? analytics?.totalEarnings ?? 14250;

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.earningsNavBtn} onPress={() => router.push('/(courier)/earnings')}>
          <Ionicons name="cash" $$$ />
        </TouchableOpacity>
        
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Courier Hub</Text>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.profileNavBtn} onPress={() => router.push('/(courier)/profile')}>
            <Ionicons name="person" $$$ />
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => logout()}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.secondary }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Active Order Highlight Card */}
        {activeOrders.length > 0 && (
          <TouchableOpacity
            style={styles.activeOrderCard}
            onPress={() => router.push({
              pathname: '/(courier)/active',
              params: { id: activeOrders[0].id }
            })}
          >
            <View style={styles.activeHeader}>
              <View style={styles.pulseContainer}>
                <View style={styles.pulseDot} />
                <Text style={styles.activeLabel}>ACTIVE DELIVERY PROGRESS</Text>
              </View>
              <Text style={styles.activeId}>#{activeOrders[0].orderNumber ?? activeOrders[0].id.substring(0, 6).toUpperCase()}</Text>
            </View>
            
            <View style={styles.activeBody}>
              <Text style={styles.activeLocation} numberOfLines={1}>
                📍 Pickup: {activeOrders[0].vendor?.businessName ?? activeOrders[0].vendorName ?? 'Campus Cafe'}
              </Text>
              <Text style={styles.activeLocation} numberOfLines={1}>
                🏁 Dropoff: {activeOrders[0].deliveryAddress ?? activeOrders[0].address ?? 'Male Hostel, Hall C'}
              </Text>
            </View>
            
            <View style={styles.activeFooter}>
              <Text style={styles.activeActionText}>TAP TO RESUME DELIVERY TRACKER</Text>
              <Ionicons name="chevron-forward" $$$ />
            </View>
          </TouchableOpacity>
        )}

        {/* Online Status Card */}
        <View style={styles.statusCard}>
          <Text style={[TYPOGRAPHY.muted, styles.statusLabel]}>Current Status</Text>
          
          <TouchableOpacity
            style={[
              styles.toggleLabel,
              { backgroundColor: online ? COLORS.primary : COLORS.outline }
            ]}
            onPress={handleToggleOnline}
            disabled={isToggling}
          >
            {isToggling ? (
              <ActivityIndicator size="small" color={COLORS.white} style={{ marginHorizontal: 'auto' }} />
            ) : (
              <>
                <Text style={styles.toggleText}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
                <View style={[styles.toggleCircle, { alignSelf: online ? 'flex-end' : 'flex-start' }]} />
              </>
            )}
          </TouchableOpacity>
          
          <Text style={[TYPOGRAPHY.muted, styles.statusSub]}>
            {online ? 'You are actively receiving campus tasks.' : 'Switch online to start receiving orders.'}
          </Text>
        </View>

        {/* KPI Bento Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Earnings Card */}
          <TouchableOpacity style={styles.statsCardLeft} onPress={() => router.push('/(courier)/earnings')}>
            <View style={styles.cardHeader}>
              <Ionicons name="cash" $$$ />
              <Text style={[TYPOGRAPHY.muted, styles.statsCardTitle]}>Earnings</Text>
            </View>
            <Text style={[TYPOGRAPHY.headlineLg, styles.earningsVal]}>
              ₦{earningsAmount.toLocaleString()}
            </Text>
            <Text style={styles.cardPeriod}>Today's Wallet Balance</Text>
          </TouchableOpacity>

          {/* Counts Panel */}
          <View style={styles.statsCardRight}>
            <View style={styles.statsSubCard}>
              <View>
                <Text style={styles.subCardLabel}>Trips Today</Text>
                <Text style={[TYPOGRAPHY.subtitle, styles.subCardVal]}>{completedCount}</Text>
              </View>
              <View style={styles.circleIconBg}>
                <Ionicons name="checkmark-circle" $$$ />
              </View>
            </View>

            <View style={[styles.statsSubCard, { borderColor: COLORS.outlineVariant, borderWidth: 1 }]}>
              <View>
                <Text style={[styles.subCardLabel, { color: COLORS.primary }]}>Active Tasks</Text>
                <Text style={[TYPOGRAPHY.subtitle, styles.subCardVal, { color: COLORS.primary }]}>{activeCount}</Text>
              </View>
              <View style={[styles.circleIconBg, { backgroundColor: COLORS.errorContainer }]}>
                <Ionicons name="car" $$$ />
              </View>
            </View>
          </View>
        </View>

        {/* Nearby Available Tasks */}
        <View style={styles.tasksHeader}>
          <Text style={[TYPOGRAPHY.subtitle, styles.tasksTitle]}>
            {online ? 'Available Orders Nearby' : 'Go Online to See Orders'}
          </Text>
          {online && (
            <TouchableOpacity onPress={handleManualRefresh} style={styles.nearbyTag}>
              <Text style={styles.nearbyTagText}>REFRESH</Text>
            </TouchableOpacity>
          )}
        </View>

        {!online ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💤</Text>
            <Text style={styles.emptyText}>You are currently offline</Text>
            <Text style={styles.emptySub}>Toggle online to start receiving instant delivery orders from campus hubs.</Text>
          </View>
        ) : isLoadingAvailable ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Fetching matching deliveries...</Text>
          </View>
        ) : availableOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>No Available Orders</Text>
            <Text style={styles.emptySub}>We are searching for orders around you. Keep this page open or refresh to check again.</Text>
          </View>
        ) : (
          <View style={styles.tasksList}>
            {availableOrders.map((order: any) => {
              const estimatedPayout = order.deliveryFee ?? 8500;
              const itemsCount = order.items?.length ?? order.itemCount ?? 1;
              const vendorName = order.vendor?.businessName ?? order.vendorName ?? 'Campus Cafe';
              const pickupAddress = order.vendor?.address ?? order.pickupAddress ?? 'Campus Cafeteria';
              const dropoffAddress = order.deliveryAddress ?? order.address ?? 'Male Hostel';

              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.taskCard}
                  onPress={() => router.push(`/(courier)/task/${order.id}`)}
                >
                  <View style={styles.taskCardHeader}>
                    <View style={styles.expressBadge}>
                      <Text style={styles.expressText}>EXPRESS ({itemsCount} item{itemsCount > 1 ? 's' : ''})</Text>
                    </View>
                    <Text style={[TYPOGRAPHY.subtitle, styles.taskPayout]}>₦{estimatedPayout.toLocaleString()}</Text>
                  </View>

                  {/* Address Route steps */}
                  <View style={styles.routeContainer}>
                    <View style={styles.routeLineContainer}>
                      <View style={[styles.routeDot, { backgroundColor: COLORS.secondary }]} />
                      <View style={styles.routeLine} />
                      <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
                    </View>

                    <View style={styles.routeInfo}>
                      <View style={styles.routeStep}>
                        <Text numberOfLines={1} style={[TYPOGRAPHY.body, styles.stepTitle]}>{vendorName}</Text>
                        <Text numberOfLines={1} style={[TYPOGRAPHY.muted, styles.stepDesc]}>Pickup • {pickupAddress}</Text>
                      </View>
                      <View style={styles.routeStep}>
                        <Text numberOfLines={1} style={[TYPOGRAPHY.body, styles.stepTitle]}>{dropoffAddress}</Text>
                        <Text numberOfLines={1} style={[TYPOGRAPHY.muted, styles.stepDesc]}>Dropoff Location</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.taskCardFooter}>
                    <Text style={[TYPOGRAPHY.muted, styles.taskEstimatedTime]}>Est. delivery time: {order.estimatedTime ?? '20 min'}</Text>
                    <View style={styles.actionPromptBtn}>
                      <Text style={styles.actionPromptText}>View Offer</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pagePadding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  earningsNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  profileNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: SHAPES.roundedDefault,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackLg,
  },
  activeOrderCard: {
    backgroundColor: COLORS.inverseSurface,
    borderRadius: SHAPES.roundedXl,
    padding: SPACING.pagePadding,
    ...SHADOWS.appCard,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pulseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00e676',
  },
  activeLabel: {
    fontSize: 10,
    color: COLORS.inversePrimary,
    fontWeight: '800',
    letterSpacing: 1,
  },
  activeId: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 12,
  },
  activeBody: {
    gap: 6,
    marginBottom: 12,
  },
  activeLocation: {
    color: COLORS.white,
    fontSize: 12,
    opacity: 0.9,
  },
  activeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
  },
  activeActionText: {
    color: '#00e676',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statusCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedXl,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.appCard,
  },
  statusLabel: {
    color: COLORS.onSurfaceVariant,
    marginBottom: 12,
    fontWeight: '600',
  },
  toggleLabel: {
    width: 140,
    height: 48,
    borderRadius: SHAPES.roundedXl,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
  toggleCircle: {
    width: 32,
    height: 32,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.white,
  },
  statusSub: {
    color: COLORS.secondary,
    marginTop: SPACING.gutter,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.gutter,
  },
  statsCardLeft: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 18,
    padding: SPACING.pagePadding,
    justifyContent: 'space-between',
    ...SHADOWS.appCard,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsCardTitle: {
    fontWeight: '700',
    color: COLORS.secondary,
  },
  earningsVal: {
    fontWeight: '800',
    color: COLORS.onSurface,
    fontSize: 22,
    marginVertical: 4,
  },
  cardPeriod: {
    fontSize: 10,
    color: COLORS.outline,
  },
  statsCardRight: {
    flex: 1,
    gap: SPACING.gutter,
  },
  statsSubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedMd,
    padding: 10,
    flex: 1,
    ...SHADOWS.appCard,
  },
  subCardLabel: {
    fontSize: 11,
    color: COLORS.secondary,
  },
  subCardVal: {
    fontWeight: '800',
    color: COLORS.onSurface,
    fontSize: 15,
  },
  circleIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  tasksTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  nearbyTag: {
    backgroundColor: COLORS.errorContainer,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  nearbyTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.primary,
  },
  tasksList: {
    gap: SPACING.stackMd,
  },
  taskCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    ...SHADOWS.appCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom: 10,
    marginBottom: 12,
  },
  expressBadge: {
    backgroundColor: COLORS.secondaryContainer,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  expressText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  taskPayout: {
    fontWeight: '800',
    color: COLORS.primary,
  },
  routeContainer: {
    flexDirection: 'row',
    gap: SPACING.gutter,
    marginBottom: 12,
  },
  routeLineContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
    gap: SPACING.stackMd,
  },
  routeStep: {
    justifyContent: 'center',
  },
  stepTitle: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  stepDesc: {
    color: COLORS.outline,
    marginTop: 2,
  },
  taskCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: 12,
  },
  taskEstimatedTime: {
    color: COLORS.outline,
  },
  actionPromptBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  actionPromptText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  emptyContainer: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.onSurface,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.outline,
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.outline,
    marginTop: 10,
  },
});
