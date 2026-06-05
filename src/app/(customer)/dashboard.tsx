import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Order {
  id: string;
  vendorId: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  paymentMethod: string;
  isPaid: boolean;
  createdAt: string;
  vendor: {
    businessName: string;
    image?: string | null;
  };
}

interface Vendor {
  id: string;
  businessName: string;
  image?: string | null;
  types: string[];
  isDrinkPartner?: boolean;
  averageRating?: number | null;
  reviewCount?: number;
  isOpen: boolean;
}

function getStatusBadgeStyle(status: Order['status']) {
  switch (status) {
    case 'PENDING':
      return { bg: '#FFFBE6', text: '#D46B08', label: 'Pending' };
    case 'PREPARING':
      return { bg: '#E6F7FF', text: '#0050B3', label: 'Preparing' };
    case 'READY':
      return { bg: '#F6FFED', text: '#389E0D', label: 'Ready' };
    case 'IN_TRANSIT':
      return { bg: '#F9F0FF', text: '#531DAB', label: 'In Transit' };
    case 'DELIVERED':
      return { bg: '#F6FFED', text: '#237804', label: 'Delivered' };
    case 'CANCELLED':
      return { bg: '#FFF0F6', text: '#C41D7F', label: 'Cancelled' };
    default:
      return { bg: COLORS.surfaceContainer, text: COLORS.secondary, label: status };
  }
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await api.get('/orders');
      return response.data?.data ?? response.data ?? [];
    },
    staleTime: 5000,
  });

  const {
    data: vendors = [],
    isLoading: vendorsLoading,
  } = useQuery<Vendor[]>({
    queryKey: ['vendors', 'ALL'],
    queryFn: async () => {
      const response = await api.get('/vendors');
      return response.data?.data ?? response.data ?? [];
    },
    staleTime: 30000,
  });

  const totalOrders = orders.length;
  const activeOrders = orders.filter(
    (o) => !['DELIVERED', 'CANCELLED'].includes(o.status),
  ).length;
  const completedOrders = orders.filter((o) => o.status === 'DELIVERED').length;
  const totalSpent = orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.total), 0);

  const recentOrders = [...orders]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  const favoriteVendors = vendors.slice(0, 4);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetchOrders();
    setRefreshing(false);
  }, [refetchOrders]);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header Greeting */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <View style={styles.avatarBorder}>
              <Ionicons name="person" $$$ />
            </View>
            <View>
              <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary }]}>
                Welcome Back
              </Text>
              <Text style={[TYPOGRAPHY.headlineLg, styles.greetingText]}>
                {user?.name || 'User'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => router.push('/(customer)/notifications')}
          >
            <Ionicons name="mail" $$$ />
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        {ordersLoading ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>
              Loading dashboard...
            </Text>
          </View>
        ) : ordersError ? (
          <View style={styles.errorSection}>
            <Ionicons name="warning" $$$ />
            <Text style={[TYPOGRAPHY.body, { color: COLORS.primary, marginTop: SPACING.gutter }]}>
              Failed to load dashboard data
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetchOrders()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.statValue}>{totalOrders}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: COLORS.secondary }]}>
                <Text style={styles.statValue}>{activeOrders}</Text>
                <Text style={styles.statLabel}>Active Orders</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: COLORS.onSurface }]}>
                  {completedOrders}
                </Text>
                <Text style={[styles.statLabelAlt, { color: COLORS.secondary }]}>
                  Completed
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: COLORS.onSurface, fontSize: 22 }]}>
                  ₦{totalSpent.toLocaleString()}
                </Text>
                <Text style={[styles.statLabelAlt, { color: COLORS.secondary }]}>
                  Total Spent
                </Text>
              </View>
            </View>

            {/* Quick Reorder Button */}
            <TouchableOpacity
              style={styles.reorderBtn}
              onPress={() => router.push('/(customer)/home')}
            >
              <Ionicons name="cart" $$$ />
              <Text style={styles.reorderBtnText}>Quick Reorder</Text>
            </TouchableOpacity>

            {/* Recent Orders */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>
                  Recent Orders
                </Text>
                {orders.length > 0 && (
                  <TouchableOpacity
                    onPress={() => router.push('/(customer)/orders')}
                  >
                    <Text style={styles.viewAllLink}>View All Orders</Text>
                  </TouchableOpacity>
                )}
              </View>

              {recentOrders.length === 0 ? (
                <View style={styles.emptySection}>
                  <Ionicons name="fast-food" $$$ />
                  <Text
                    style={[
                      TYPOGRAPHY.body,
                      { color: COLORS.secondary, marginTop: 8 },
                    ]}
                  >
                    No orders yet
                  </Text>
                  <Text style={[TYPOGRAPHY.muted, { textAlign: 'center', marginTop: 4 }]}>
                    Place your first order to see it here
                  </Text>
                </View>
              ) : (
                <View style={styles.ordersList}>
                  {recentOrders.map((order) => {
                    const badge = getStatusBadgeStyle(order.status);
                    const formattedDate = new Date(order.createdAt).toLocaleDateString(
                      'en-NG',
                      {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    );

                    return (
                      <TouchableOpacity
                        key={order.id}
                        style={styles.orderCard}
                        onPress={() => router.push(`/(customer)/order/${order.id}`)}
                      >
                        <View style={styles.orderCardRow}>
                          <View style={styles.orderVendorInfo}>
                            {order.vendor.image ? (
                              <Image
                                source={{ uri: order.vendor.image }}
                                style={styles.orderVendorImage as any}
                              />
                            ) : (
                              <View style={styles.orderVendorFallback}>
                                <Ionicons name="storefront" size={16} color={COLORS.secondary} />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[TYPOGRAPHY.subtitle, styles.orderVendorName]}
                                numberOfLines={1}
                              >
                                {order.vendor.businessName}
                              </Text>
                              <Text style={[TYPOGRAPHY.muted, styles.orderDate]}>
                                {formattedDate}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: badge.bg },
                            ]}
                          >
                            <Text
                              style={[styles.statusBadgeText, { color: badge.text }]}
                            >
                              {badge.label}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.cardDivider} />

                        <View style={styles.orderCardFooter}>
                          <Text style={[TYPOGRAPHY.muted, { fontSize: 11, color: COLORS.outline }]}>
                            ID: #{order.id.slice(-6).toUpperCase()}
                          </Text>
                          <Text style={styles.orderTotal}>
                            ₦{Number(order.total).toLocaleString()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Favorite Vendors */}
            {!vendorsLoading && favoriteVendors.length > 0 && (
              <View style={styles.section}>
                <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>
                  Favorite Vendors
                </Text>
                <View style={styles.vendorsList}>
                  {favoriteVendors.map((vendor) => (
                    <TouchableOpacity
                      key={vendor.id}
                      style={styles.vendorCard}
                      onPress={() => router.push(`/(customer)/vendor/${vendor.id}`)}
                    >
                      {vendor.image ? (
                        <Image
                          source={{ uri: vendor.image }}
                          style={styles.vendorImage as any}
                        />
                      ) : (
                        <View style={styles.vendorFallbackImg}>
                          <Ionicons
                            name={vendor.types.includes('FOOD') ? 'fast-food' : 'storefront'}
                            size={24}
                            color={COLORS.secondary}
                          />
                        </View>
                      )}
                      <Text
                        style={[TYPOGRAPHY.body, styles.vendorName]}
                        numberOfLines={2}
                      >
                        {vendor.businessName}
                      </Text>
                      <View style={vendor.isOpen ? styles.openDot : styles.closedDot} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
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
  scrollContent: {
    padding: SPACING.pagePadding,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.stackLg,
    marginTop: 10,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  avatarBorder: {
    width: 48,
    height: 48,
    borderRadius: SHAPES.roundedXl,
    backgroundColor: COLORS.surfaceContainer,
    borderWidth: 2,
    borderColor: COLORS.surfaceContainerHighest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingText: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  loadingSection: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  errorSection: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    ...SHADOWS.appCard,
  },
  retryText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.stackMd,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 18,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: COLORS.onPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statLabelAlt: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.stackSm,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: SHAPES.roundedCard,
    marginBottom: SPACING.stackLg,
    ...SHADOWS.appCard,
  },
  reorderBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  section: {
    marginBottom: SPACING.stackLg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.stackSm,
  },
  sectionTitle: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  viewAllLink: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  emptySection: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  ordersList: {
    gap: SPACING.gutter,
  },
  orderCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    ...SHADOWS.appCard,
  },
  orderCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderVendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  orderVendorImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  orderVendorFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderVendorName: {
    fontWeight: '700',
    color: COLORS.onSurface,
    fontSize: 14,
  },
  orderDate: {
    color: COLORS.outline,
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: SHAPES.roundedDefault,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 10,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  vendorsList: {
    flexDirection: 'row',
    gap: 10,
  },
  vendorCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 18,
    padding: SPACING.gutter,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
    alignItems: 'center',
    gap: SPACING.stackSm,
    position: 'relative',
    maxWidth: '25%',
  },
  vendorImage: {
    width: 56,
    height: 56,
    borderRadius: SHAPES.roundedCard,
  },
  vendorFallbackImg: {
    width: 56,
    height: 56,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorName: {
    fontWeight: '600',
    color: COLORS.onSurface,
    fontSize: 11,
    textAlign: 'center',
  },
  openDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1A7F37',
    position: 'absolute',
    top: 8,
    right: 8,
  },
  closedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1242F',
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
