import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface AdminStats {
  totalUsers: number;
  totalVendors: number;
  totalOrders: number;
  totalRevenue: number;
  totalCommissions: number;
  totalDeliveryFees: number;
  activeCouriers: number;
  deliveryVolume: number;
  partneredDrinkVendors: number;
  drinkRevenue: number;
  drinkCommissions: number;
  drinkOrders: number;
}

interface CourierLeaderboardItem {
  id: string;
  name: string;
  deliveries: number;
}

interface VendorLeaderboardItem {
  id: string;
  name: string;
  revenue: number;
}

interface AdminLeaderboard {
  topCouriers: CourierLeaderboardItem[];
  topVendors: VendorLeaderboardItem[];
}

const fetchAdminStats = async (): Promise<AdminStats> => {
  const response = await api.get('/analytics/admin');
  return response.data;
};

const fetchAdminLeaderboard = async (): Promise<AdminLeaderboard> => {
  const response = await api.get('/analytics/admin/leaderboard');
  return response.data;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { logout } = useAuth();

  // React Query hooks
  const { 
    data: stats, 
    isLoading: statsLoading, 
    isRefetching: statsRefetching, 
    error: statsError, 
    refetch: refetchStats 
  } = useQuery<AdminStats>({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
  });

  const { 
    data: leaderboard, 
    isLoading: leaderboardLoading, 
    isRefetching: leaderboardRefetching,
    error: leaderboardError, 
    refetch: refetchLeaderboard 
  } = useQuery<AdminLeaderboard>({
    queryKey: ['adminLeaderboard'],
    queryFn: fetchAdminLeaderboard,
  });

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchLeaderboard()]);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  const formatNaira = (value: number) => {
    return '₦' + value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const isLoading = statsLoading || leaderboardLoading;
  const isRefetching = statsRefetching || leaderboardRefetching;
  const hasError = !!(statsError || leaderboardError);

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleLogout}>
          <Ionicons name="arrow-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Admin Dashboard</Text>
        <TouchableOpacity style={styles.profileBtn} onPress={handleLogout}>
          <Ionicons name="lock-closed" size={24} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading system insights...</Text>
        </View>
      ) : hasError ? (
        <ScrollView 
          contentContainerStyle={styles.errorContainer}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} colors={[COLORS.primary]} />
          }
        >
          <View style={styles.errorIconBg}>
            <Ionicons name="warning" $$$ />
          </View>
          <Text style={[TYPOGRAPHY.subtitle, styles.errorTitle]}>Failed to load analytics</Text>
          <Text style={[TYPOGRAPHY.body, styles.errorText]}>
            Make sure your NestJS server is running and you are connected to the network.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={[TYPOGRAPHY.subtitle, styles.retryButtonText]}>Retry Connection</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} colors={[COLORS.primary]} />
          }
        >
          {/* Bento Grid Overview */}
          <View style={styles.bentoGrid}>
            {/* Revenue Card (Full width) */}
            <View style={styles.revenueCard}>
              <View style={styles.revenueLeft}>
                <Text style={[TYPOGRAPHY.labelMini, styles.revenueLabel]}>TOTAL SYSTEM VOLUME</Text>
                <Text style={[TYPOGRAPHY.headlineXl, styles.revenueVal]}>
                  {stats ? formatNaira(stats.totalRevenue) : '₦0'}
                </Text>
              </View>
              <View style={styles.revenueRightIcon}>
                <Ionicons name="cash" $$$ />
              </View>
            </View>

            {/* Mini Cards Row 1 */}
            <View style={styles.miniCardRow}>
              {/* Active Users */}
              <View style={styles.miniCard}>
                <View style={styles.cardHeader}>
                  <Ionicons name="person" $$$ />
                  <View style={styles.trendBadge}>
                    <Text style={styles.trendText}>Users</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={[TYPOGRAPHY.muted, styles.miniLabel]}>Total Registered</Text>
                  <Text style={[TYPOGRAPHY.headlineLg, styles.miniVal]}>
                    {stats?.totalUsers ?? 0}
                  </Text>
                </View>
              </View>

              {/* Online Couriers */}
              <View style={styles.miniCard}>
                <View style={styles.cardHeader}>
                  <Ionicons name="car" $$$ />
                  <View style={styles.livePulseDot} />
                </View>
                <View style={styles.cardBottom}>
                  <Text style={[TYPOGRAPHY.muted, styles.miniLabel]}>Active Couriers</Text>
                  <Text style={[TYPOGRAPHY.headlineLg, styles.miniVal]}>
                    {stats?.activeCouriers ?? 0}
                  </Text>
                </View>
              </View>
            </View>

            {/* Mini Cards Row 2 */}
            <View style={styles.miniCardRow}>
              {/* Total Orders */}
              <View style={styles.miniCard}>
                <View style={styles.cardHeader}>
                  <Ionicons name="cart" $$$ />
                  <View style={styles.trendBadge}>
                    <Text style={styles.trendText}>Orders</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={[TYPOGRAPHY.muted, styles.miniLabel]}>System Orders</Text>
                  <Text style={[TYPOGRAPHY.headlineLg, styles.miniVal]}>
                    {stats?.totalOrders ?? 0}
                  </Text>
                </View>
              </View>

              {/* System Commissions */}
              <View style={styles.miniCard}>
                <View style={styles.cardHeader}>
                  <Ionicons name="star" $$$ />
                  <View style={styles.trendBadge}>
                    <Text style={styles.trendText}>Yield</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={[TYPOGRAPHY.muted, styles.miniLabel]}>Net Commissions</Text>
                  <Text style={[TYPOGRAPHY.headlineLg, styles.miniVal, { color: '#10B981' }]}>
                    {stats ? formatNaira(stats.totalCommissions) : '₦0'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Drink Partner Initiative Card */}
          {stats && stats.partneredDrinkVendors > 0 ? (
            <View style={styles.drinkAnalyticsCard}>
              <View style={styles.drinkHeaderRow}>
                <Ionicons name="fast-food" $$$ />
                <Text style={[TYPOGRAPHY.labelMini, styles.drinkSectionLabel]}>DRINK PARTNER INITIATIVE</Text>
              </View>
              <View style={styles.drinkDivider} />
              <View style={styles.drinkStatsRow}>
                <View style={styles.drinkStatItem}>
                  <Text style={[TYPOGRAPHY.headlineLg, styles.drinkStatVal]}>{stats.partneredDrinkVendors}</Text>
                  <Text style={[TYPOGRAPHY.muted, styles.drinkStatLabel]}>Partners</Text>
                </View>
                <View style={styles.drinkStatItem}>
                  <Text style={[TYPOGRAPHY.headlineLg, styles.drinkStatVal]}>{stats.drinkOrders}</Text>
                  <Text style={[TYPOGRAPHY.muted, styles.drinkStatLabel]}>Orders</Text>
                </View>
                <View style={styles.drinkStatItem}>
                  <Text style={[TYPOGRAPHY.headlineLg, styles.drinkStatVal, { fontSize: 16 }]}>
                    {formatNaira(stats.drinkRevenue)}
                  </Text>
                  <Text style={[TYPOGRAPHY.muted, styles.drinkStatLabel]}>Revenue</Text>
                </View>
                <View style={styles.drinkStatItem}>
                  <Text style={[TYPOGRAPHY.headlineLg, styles.drinkStatVal, { fontSize: 16, color: '#10B981' }]}>
                    {formatNaira(stats.drinkCommissions)}
                  </Text>
                  <Text style={[TYPOGRAPHY.muted, styles.drinkStatLabel]}>Comms</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Leaderboards */}
          <View style={styles.leaderboardSection}>
            <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Top Performers</Text>
            
            {/* Top Vendors */}
            <View style={styles.leaderboardContainer}>
              <View style={styles.leaderboardHeader}>
                <Ionicons name="storefront" $$$ />
                <Text style={[TYPOGRAPHY.subtitle, styles.leaderboardTitle]}>Top Performing Vendors</Text>
              </View>
              <View style={styles.leaderboardList}>
                {leaderboard?.topVendors && leaderboard.topVendors.length > 0 ? (
                  leaderboard.topVendors.map((vendor, index) => (
                    <View key={vendor.id || index} style={styles.leaderboardItem}>
                      <View style={styles.leaderboardRank}>
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.leaderboardInfo}>
                        <Text style={[TYPOGRAPHY.body, styles.leaderboardName]}>{vendor.name}</Text>
                        <Text style={[TYPOGRAPHY.muted, styles.leaderboardSub]}>Premium Partner</Text>
                      </View>
                      <Text style={[TYPOGRAPHY.body, styles.leaderboardValue]}>
                        {formatNaira(vendor.revenue)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[TYPOGRAPHY.body, styles.emptyText]}>No vendor sales recorded yet</Text>
                )}
              </View>
            </View>

            {/* Top Couriers */}
            <View style={styles.leaderboardContainer}>
              <View style={styles.leaderboardHeader}>
                <Ionicons name="car" $$$ />
                <Text style={[TYPOGRAPHY.subtitle, styles.leaderboardTitle]}>Top Active Couriers</Text>
              </View>
              <View style={styles.leaderboardList}>
                {leaderboard?.topCouriers && leaderboard.topCouriers.length > 0 ? (
                  leaderboard.topCouriers.map((courier, index) => (
                    <View key={courier.id || index} style={styles.leaderboardItem}>
                      <View style={styles.leaderboardRank}>
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.leaderboardInfo}>
                        <Text style={[TYPOGRAPHY.body, styles.leaderboardName]}>{courier.name}</Text>
                        <Text style={[TYPOGRAPHY.muted, styles.leaderboardSub]}>Verified Courier</Text>
                      </View>
                      <Text style={[TYPOGRAPHY.body, styles.leaderboardValue, { color: COLORS.primary }]}>
                        {courier.deliveries} Deliveries
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[TYPOGRAPHY.body, styles.emptyText]}>No completed deliveries yet</Text>
                )}
              </View>
            </View>
          </View>

          {/* System Settings & Configuration */}
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>System Configurations</Text>
          <View style={styles.settingsList}>
            {/* Setting item 1 */}
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name="fast-food" $$$ />
                </View>
                <View>
                  <Text style={[TYPOGRAPHY.body, styles.settingName]}>Food Delivery Base Fee</Text>
                  <Text style={[TYPOGRAPHY.muted, styles.settingSub]}>Currently set to ₦200 per food pack</Text>
                </View>
              </View>
              <Text style={[TYPOGRAPHY.body, styles.settingValue]}>Edit</Text>
            </TouchableOpacity>

            {/* Setting item 2 */}
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name="storefront" $$$ />
                </View>
                <View>
                  <Text style={[TYPOGRAPHY.body, styles.settingName]}>Shop Base Delivery Fee</Text>
                  <Text style={[TYPOGRAPHY.muted, styles.settingSub]}>Currently set to ₦500 per factor-5 items</Text>
                </View>
              </View>
              <Text style={[TYPOGRAPHY.body, styles.settingValue]}>Edit</Text>
            </TouchableOpacity>

            {/* Setting item 3 */}
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name="person" $$$ />
                </View>
                <View>
                  <Text style={[TYPOGRAPHY.body, styles.settingName]}>Courier Earnings Ratio</Text>
                  <Text style={[TYPOGRAPHY.muted, styles.settingSub]}>Couriers receive 85% of delivery fee</Text>
                </View>
              </View>
              <Text style={[TYPOGRAPHY.body, styles.settingValue]}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Management */}
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Management</Text>
          <View style={styles.managementGrid}>
            <TouchableOpacity
              style={styles.managementCard}
              onPress={() => router.push('/(admin)/users')}
            >
              <View style={styles.managementIconBg}>
                <Ionicons name="person" $$$ />
              </View>
              <Text style={[TYPOGRAPHY.subtitle, styles.managementLabel]}>Users</Text>
              <Text style={[TYPOGRAPHY.muted, styles.managementSub]}>Manage accounts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.managementCard}
              onPress={() => router.push('/(admin)/vendors')}
            >
              <View style={styles.managementIconBg}>
                <Ionicons name="storefront" $$$ />
              </View>
              <Text style={[TYPOGRAPHY.subtitle, styles.managementLabel]}>Vendors</Text>
              <Text style={[TYPOGRAPHY.muted, styles.managementSub]}>Manage vendors</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.managementCard}
              onPress={() => router.push('/(admin)/couriers')}
            >
              <View style={styles.managementIconBg}>
                <Ionicons name="car" $$$ />
              </View>
              <Text style={[TYPOGRAPHY.subtitle, styles.managementLabel]}>Couriers</Text>
              <Text style={[TYPOGRAPHY.muted, styles.managementSub]}>Manage couriers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.managementCard}
              onPress={() => router.push('/(admin)/orders')}
            >
              <View style={styles.managementIconBg}>
                <Ionicons name="cart" $$$ />
              </View>
              <Text style={[TYPOGRAPHY.subtitle, styles.managementLabel]}>Orders</Text>
              <Text style={[TYPOGRAPHY.muted, styles.managementSub]}>Manage orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.managementCard}
              onPress={() => router.push('/(admin)/payouts')}
            >
              <View style={styles.managementIconBg}>
                <Ionicons name="cash" $$$ />
              </View>
              <Text style={[TYPOGRAPHY.subtitle, styles.managementLabel]}>Payouts</Text>
              <Text style={[TYPOGRAPHY.muted, styles.managementSub]}>Manage payouts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.managementCard}
              onPress={() => router.push('/(admin)/locations')}
            >
              <View style={styles.managementIconBg}>
                <Ionicons name="home" $$$ />
              </View>
              <Text style={[TYPOGRAPHY.subtitle, styles.managementLabel]}>Locations</Text>
              <Text style={[TYPOGRAPHY.muted, styles.managementSub]}>Manage locations</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.managementCard}
              onPress={() => router.push('/(admin)/settings')}
            >
              <View style={styles.managementIconBg}>
                <Ionicons name="settings" $$$ />
              </View>
              <Text style={[TYPOGRAPHY.subtitle, styles.managementLabel]}>Settings</Text>
              <Text style={[TYPOGRAPHY.muted, styles.managementSub]}>Platform config</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
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
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.secondary,
    marginTop: SPACING.stackMd,
  },
  errorContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.pagePadding,
    backgroundColor: COLORS.background,
  },
  errorIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFEBEF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.stackMd,
  },
  errorTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
    marginBottom: SPACING.stackSm,
  },
  errorText: {
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: SPACING.stackLg,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: SHAPES.roundedLg,
    ...SHADOWS.appCard,
  },
  retryButtonText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackLg,
    paddingBottom: 100,
  },
  bentoGrid: {
    gap: SPACING.gutter,
  },
  revenueCard: {
    backgroundColor: COLORS.primary,
    borderRadius: SHAPES.roundedCard,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  revenueLeft: {
    gap: 4,
  },
  revenueLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '800',
  },
  revenueVal: {
    color: COLORS.onPrimary,
    fontWeight: '900',
    fontSize: 28,
  },
  revenueRightIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardRow: {
    flexDirection: 'row',
    gap: SPACING.gutter,
  },
  miniCard: {
    flex: 1,
    height: 110,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.gutter,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendBadge: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: SHAPES.roundedDefault,
  },
  trendText: {
    fontSize: 8,
    color: COLORS.secondary,
    fontWeight: '800',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  cardBottom: {
    gap: 2,
  },
  miniLabel: {
    color: COLORS.onSurfaceVariant,
    fontSize: 11,
  },
  miniVal: {
    fontWeight: '800',
    color: COLORS.onSurface,
    fontSize: 20,
  },
  drinkAnalyticsCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  drinkHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
    marginBottom: 8,
  },
  drinkSectionLabel: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  drinkDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginBottom: 12,
  },
  drinkStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drinkStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  drinkStatVal: {
    color: COLORS.onSurface,
    fontWeight: '800',
    fontSize: 18,
  },
  drinkStatLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  leaderboardSection: {
    gap: SPACING.stackMd,
  },
  sectionTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
    marginTop: 4,
  },
  leaderboardContainer: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
    padding: SPACING.pagePadding,
    gap: SPACING.gutter,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  leaderboardTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  leaderboardList: {
    gap: 10,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  leaderboardRank: {
    width: 24,
    height: 24,
    borderRadius: SHAPES.roundedMd,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  leaderboardSub: {
    marginTop: 2,
  },
  leaderboardValue: {
    fontWeight: '800',
    color: COLORS.secondary,
  },
  emptyText: {
    color: COLORS.outline,
    textAlign: 'center',
    paddingVertical: 12,
  },
  settingsList: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.pagePadding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingName: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  settingSub: {
    color: COLORS.outline,
    marginTop: 2,
  },
  settingValue: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  managementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.gutter,
  },
  managementCard: {
    width: '30%',
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    gap: 6,
    ...SHADOWS.appCard,
  },
  managementIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  managementLabel: {
    fontWeight: '700',
    color: COLORS.onSurface,
    fontSize: 13,
    textAlign: 'center',
  },
  managementSub: {
    color: COLORS.outline,
    fontSize: 10,
    textAlign: 'center',
  },
});
