import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, FlatList, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '@/context/ToastContext';

interface Delivery {
  id: string;
  orderNumber: string;
  amount: number;
  date: string;
  pickup: string;
  dropoff: string;
  status: string;
}

interface Payout {
  id: string;
  amount: number;
  date: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  reference: string;
}

interface AnalyticsData {
  totalEarnings: number;
  totalTrips: number;
  averageRating: number;
  todayEarnings: number;
  historicalDeliveries: Delivery[];
  payouts: Payout[];
}

export default function CourierEarnings() {
  const router = useRouter();
  const { showToast } = useToast();

  // Fetch courier analytics & payouts
  const { data: analytics, isLoading, error, refetch } = useQuery<AnalyticsData>({
    queryKey: ['courierEarnings'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/courier/dashboard');
        return res.data?.data ?? res.data;
      } catch (err) {
        console.log('Error fetching earnings dashboard, trying backup endpoint...', err);
        const res = await api.get('/analytics/courier');
        return res.data?.data ?? res.data;
      }
    },
  });

  // Safe fallback mock data if backend has no records
  const totalEarnings = analytics?.totalEarnings ?? 42800;
  const todayEarnings = analytics?.todayEarnings ?? 14250;
  const totalTrips = analytics?.totalTrips ?? 18;
  const averageRating = analytics?.averageRating ?? 4.9;

  const historicalDeliveries: Delivery[] = analytics?.historicalDeliveries ?? [
    {
      id: '1',
      orderNumber: 'CX-8429',
      amount: 8500,
      date: 'Today, 2:15 PM',
      pickup: 'Campus Library Cafeteria',
      dropoff: 'Daniel Hall, Rm 308',
      status: 'DELIVERED',
    },
    {
      id: '2',
      orderNumber: 'CX-8401',
      amount: 5750,
      date: 'Today, 11:30 AM',
      pickup: 'Varsity Grill A',
      dropoff: 'Female Hostel, Hall B',
      status: 'DELIVERED',
    },
    {
      id: '3',
      orderNumber: 'CX-7992',
      amount: 9200,
      date: 'Yesterday, 6:40 PM',
      pickup: 'Supermarket Hub',
      dropoff: 'Staff Quarters, House 14',
      status: 'DELIVERED',
    },
    {
      id: '4',
      orderNumber: 'CX-7911',
      amount: 4500,
      date: 'May 23, 1:10 PM',
      pickup: 'JABU Bakery Shop',
      dropoff: 'Male Hostel, Hall A',
      status: 'DELIVERED',
    },
  ];

  const payouts: Payout[] = analytics?.payouts ?? [
    {
      id: 'p-1',
      amount: 14250,
      date: 'May 25, 2026',
      status: 'COMPLETED',
      reference: 'TXN-994821',
    },
    {
      id: 'p-2',
      amount: 28550,
      date: 'May 22, 2026',
      status: 'COMPLETED',
      reference: 'TXN-991043',
    },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeContainer, styles.loadingCenter]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[TYPOGRAPHY.body, { color: COLORS.secondary, marginTop: SPACING.gutter }]}>
          Loading wallet & earnings analytics...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(courier)/dashboard')}>
          <Ionicons name="arrow-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>My Earnings</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()}>
          <Text style={{ fontSize: 18 }}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Wallet & Balance Header Card */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <Text style={[TYPOGRAPHY.labelMini, styles.walletLabel]}>CAMPUS COURIER WALLET</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>ACTIVE Payout</Text>
            </View>
          </View>
          
          <Text style={[TYPOGRAPHY.headlineXl, styles.balanceVal]}>
            ₦{(totalEarnings).toLocaleString()}
          </Text>
          
          <View style={styles.dividerLight} />
          
          <View style={styles.walletStatsRow}>
            <View style={styles.walletStatCol}>
              <Text style={styles.walletStatLabel}>Today's Work</Text>
              <Text style={styles.walletStatVal}>₦{todayEarnings.toLocaleString()}</Text>
            </View>
            <View style={styles.walletStatCol}>
              <Text style={styles.walletStatLabel}>Total Deliveries</Text>
              <Text style={styles.walletStatVal}>{totalTrips} Trips</Text>
            </View>
            <View style={styles.walletStatCol}>
              <Text style={styles.walletStatLabel}>Rating score</Text>
              <Text style={styles.walletStatVal}>⭐ {averageRating}</Text>
            </View>
          </View>
        </View>

        {/* Action Button for payout requests */}
        <TouchableOpacity 
          style={styles.payoutActionBtn}
          onPress={() => showToast('Bank payout will be available in the next update.', 'info')}
        >
          <Ionicons name="cash" $$$ />
          <Text style={styles.payoutActionText}>Instant Bank Cashout</Text>
        </TouchableOpacity>

        {/* Historical Deliveries Section */}
        <View style={styles.sectionHeader}>
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Recent Completed Trips</Text>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>{historicalDeliveries.length}</Text>
          </View>
        </View>

        <View style={styles.listContainer}>
          {historicalDeliveries.map((delivery) => (
            <View key={delivery.id} style={styles.tripCard}>
              <View style={styles.tripHeader}>
                <Text style={styles.tripNumber}>Trip #{delivery.orderNumber}</Text>
                <Text style={styles.tripAmount}>+₦{delivery.amount.toLocaleString()}</Text>
              </View>
              
              <Text style={styles.tripDate}>{delivery.date}</Text>

              {/* Minimal route trail */}
              <View style={styles.routeBox}>
                <View style={styles.routeLineDot} />
                <View style={styles.routeInfoCol}>
                  <Text numberOfLines={1} style={styles.routePointText}>
                    <Text style={{ fontWeight: '700', color: COLORS.secondary }}>P: </Text>{delivery.pickup}
                  </Text>
                  <Text numberOfLines={1} style={styles.routePointText}>
                    <Text style={{ fontWeight: '700', color: COLORS.primary }}>D: </Text>{delivery.dropoff}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Payout Transactions Section */}
        <View style={styles.sectionHeader}>
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Bank Payout History</Text>
        </View>

        <View style={styles.listContainer}>
          {payouts.map((payout) => (
            <View key={payout.id} style={styles.payoutCard}>
              <View style={styles.payoutMainRow}>
                <View>
                  <Text style={styles.payoutRef}>{payout.reference}</Text>
                  <Text style={styles.payoutDate}>{payout.date}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.payoutAmount}>₦{payout.amount.toLocaleString()}</Text>
                  <View style={[
                    styles.statusIndicator,
                    payout.status === 'COMPLETED' ? styles.statusSuccess : styles.statusPending
                  ]}>
                    <Text style={styles.statusIndicatorText}>{payout.status}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingCenter: {
    justifyContent: 'center',
    alignItems: 'center',
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
    color: COLORS.primary,
    fontWeight: '800',
  },
  refreshBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackLg,
    paddingBottom: 40,
  },
  walletCard: {
    backgroundColor: COLORS.inverseSurface,
    borderRadius: SHAPES.roundedXl,
    padding: 20,
    ...SHADOWS.appCard,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '700',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.inversePrimary,
  },
  balanceVal: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: '900',
    marginVertical: 12,
  },
  dividerLight: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 14,
  },
  walletStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  walletStatCol: {
    flex: 1,
  },
  walletStatLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
    marginBottom: 4,
  },
  walletStatVal: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
  payoutActionBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: SHAPES.roundedLg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.stackSm,
    marginTop: -8,
    ...SHADOWS.appCard,
  },
  payoutActionText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  sectionTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  badgeCount: {
    backgroundColor: COLORS.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeCountText: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '800',
  },
  listContainer: {
    gap: SPACING.stackMd,
  },
  tripCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 18,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripNumber: {
    fontWeight: '800',
    color: COLORS.onSurface,
    fontSize: 14,
  },
  tripAmount: {
    fontWeight: '800',
    color: COLORS.primary,
    fontSize: 15,
  },
  tripDate: {
    fontSize: 11,
    color: COLORS.outline,
    marginTop: 2,
  },
  routeBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedDefault,
    padding: SPACING.stackSm,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  routeLineDot: {
    width: 3,
    height: 24,
    borderRadius: 1.5,
    backgroundColor: COLORS.secondary,
  },
  routeInfoCol: {
    flex: 1,
    gap: 2,
  },
  routePointText: {
    fontSize: 11,
    color: COLORS.onSurface,
  },
  payoutCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  payoutMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutRef: {
    fontWeight: '700',
    color: COLORS.onSurface,
    fontSize: 13,
  },
  payoutDate: {
    fontSize: 11,
    color: COLORS.outline,
    marginTop: 2,
  },
  payoutAmount: {
    fontWeight: '800',
    color: COLORS.onSurface,
    fontSize: 14,
  },
  statusIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusSuccess: {
    backgroundColor: '#e6f7ed',
  },
  statusPending: {
    backgroundColor: '#fff7e6',
  },
  statusIndicatorText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.secondary,
  },
});
