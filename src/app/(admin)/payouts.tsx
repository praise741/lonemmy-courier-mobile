import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface CourierPayout {
  id: string;
  courier?: { name: string };
  amount: number;
  status: string;
  period?: string;
}

interface VendorPayout {
  id: string;
  vendor?: { businessName: string };
  amount: number;
  status: string;
  period?: string;
}

interface PendingSettlement {
  id: string;
  entityName: string;
  type: 'COURIER' | 'VENDOR';
  amount: number;
  period?: string;
}

type Tab = 'courier' | 'vendor' | 'pending';

export default function AdminPayouts() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('courier');

  const { data: courierPayouts, isLoading: courierLoading, isRefetching: courierRefetch, error: courierError, refetch: refetchCourier } = useQuery<{ data: CourierPayout[] }>({
    queryKey: ['adminCourierPayouts'],
    queryFn: async () => {
      const res = await api.get('/admin/payouts/couriers');
      return res.data;
    },
    enabled: activeTab === 'courier',
  });

  const { data: vendorPayouts, isLoading: vendorLoading, isRefetching: vendorRefetch, error: vendorError, refetch: refetchVendor } = useQuery<{ data: VendorPayout[] }>({
    queryKey: ['adminVendorPayouts'],
    queryFn: async () => {
      const res = await api.get('/admin/payouts/vendors');
      return res.data;
    },
    enabled: activeTab === 'vendor',
  });

  const { data: pendingSettlements, isLoading: pendingLoading, isRefetching: pendingRefetch, error: pendingError, refetch: refetchPending } = useQuery<{ data: PendingSettlement[] }>({
    queryKey: ['adminPendingSettlements'],
    queryFn: async () => {
      const res = await api.get('/admin/payouts/pending');
      return res.data;
    },
    enabled: activeTab === 'pending',
  });

  const formatNaira = (value: number) => {
    return '₦' + value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const renderCourierPayout = ({ item }: { item: CourierPayout }) => (
    <View style={styles.payoutCard}>
      <View style={styles.payoutAvatar}>
        <Ionicons name="car" size={18} color={COLORS.secondary} />
      </View>
      <View style={styles.payoutInfo}>
        <Text style={[TYPOGRAPHY.subtitle, styles.payoutName]}>{item.courier?.name || 'Unknown'}</Text>
        <View style={styles.payoutMeta}>
          <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary }]}>
            {item.status}{item.period ? ` · ${item.period}` : ''}
          </Text>
        </View>
      </View>
      <Text style={[TYPOGRAPHY.headlineLg, styles.payoutAmount]}>{formatNaira(item.amount)}</Text>
    </View>
  );

  const renderVendorPayout = ({ item }: { item: VendorPayout }) => (
    <View style={styles.payoutCard}>
      <View style={styles.payoutAvatar}>
        <Ionicons name="storefront" size={18} color={COLORS.secondary} />
      </View>
      <View style={styles.payoutInfo}>
        <Text style={[TYPOGRAPHY.subtitle, styles.payoutName]}>{item.vendor?.businessName || 'Unknown'}</Text>
        <View style={styles.payoutMeta}>
          <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary }]}>
            {item.status}{item.period ? ` · ${item.period}` : ''}
          </Text>
        </View>
      </View>
      <Text style={[TYPOGRAPHY.headlineLg, styles.payoutAmount]}>{formatNaira(item.amount)}</Text>
    </View>
  );

  const renderPendingSettlement = ({ item }: { item: PendingSettlement }) => (
    <View style={styles.payoutCard}>
      <View style={styles.payoutAvatar}>
        <Ionicons name={item.type === 'COURIER' ? 'car' : 'storefront'} size={18} color={COLORS.secondary} />
      </View>
      <View style={styles.payoutInfo}>
        <Text style={[TYPOGRAPHY.subtitle, styles.payoutName]}>{item.entityName}</Text>
        <View style={styles.payoutMeta}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.type}</Text>
          </View>
          {item.period && (
            <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary }]}>{item.period}</Text>
          )}
        </View>
      </View>
      <Text style={[TYPOGRAPHY.headlineLg, styles.payoutAmount, { color: '#F59E0B' }]}>
        {formatNaira(item.amount)}
      </Text>
    </View>
  );

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'courier', label: 'Courier', icon: 'car' },
    { key: 'vendor', label: 'Vendor', icon: 'store' },
    { key: 'pending', label: 'Pending', icon: 'cash' },
  ];

  const getCurrentData = () => {
    switch (activeTab) {
      case 'courier': return courierPayouts?.data ?? [];
      case 'vendor': return vendorPayouts?.data ?? [];
      case 'pending': return pendingSettlements?.data ?? [];
      default: return [];
    }
  };

  const getRenderFn = () => {
    switch (activeTab) {
      case 'courier': return renderCourierPayout;
      case 'vendor': return renderVendorPayout;
      case 'pending': return renderPendingSettlement;
      default: return renderCourierPayout;
    }
  };

  const isLoading = activeTab === 'courier' ? courierLoading : activeTab === 'vendor' ? vendorLoading : pendingLoading;
  const isRefetching = activeTab === 'courier' ? courierRefetch : activeTab === 'vendor' ? vendorRefetch : pendingRefetch;
  const tabError = activeTab === 'courier' ? courierError : activeTab === 'vendor' ? vendorError : pendingError;
  const refetchFn = activeTab === 'courier' ? refetchCourier : activeTab === 'vendor' ? refetchVendor : refetchPending;

  const currentData = getCurrentData();
  const renderFn = getRenderFn();

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(admin)/dashboard')}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Payouts</Text>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={activeTab === tab.key ? COLORS.onPrimary : COLORS.secondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading payouts...</Text>
        </View>
      ) : tabError ? (
        <View style={styles.centered}>
          <View style={styles.errorIconBg}>
            <Ionicons name="warning" size={40} color={COLORS.primary} />
          </View>
          <Text style={[TYPOGRAPHY.subtitle, styles.errorTitle]}>Failed to load payouts</Text>
          <Text style={[TYPOGRAPHY.body, styles.errorText]}>
            {(tabError as any)?.response?.data?.message || 'Check your connection and try again.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetchFn()}>
            <Text style={[TYPOGRAPHY.subtitle, styles.retryButtonText]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : currentData.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 44 }}>💰</Text>
          <Text style={[TYPOGRAPHY.subtitle, styles.emptyTitle]}>No payouts yet</Text>
          <Text style={[TYPOGRAPHY.muted, styles.emptyText]}>
            {activeTab === 'pending'
              ? 'No pending settlements at this time.'
              : `No ${activeTab} payouts have been processed yet.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentData as any[]}
          keyExtractor={(item) => item.id}
          renderItem={renderFn as any}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetchFn} colors={[COLORS.primary]} />
          }
        />
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
    marginLeft: 8,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingHorizontal: SPACING.pagePadding,
    paddingVertical: 8,
    gap: SPACING.stackSm,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  tabTextActive: {
    color: COLORS.onPrimary,
  },
  listContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackMd,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: SPACING.stackSm,
  },
  loadingText: {
    color: COLORS.secondary,
    marginTop: SPACING.stackMd,
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
  emptyTitle: {
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 8,
  },
  emptyText: {
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: SPACING.stackMd,
  },
  payoutCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    gap: SPACING.gutter,
    ...SHADOWS.appCard,
  },
  payoutAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payoutInfo: {
    flex: 1,
    gap: 2,
  },
  payoutName: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  payoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  typeBadge: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  payoutAmount: {
    fontWeight: '800',
    color: COLORS.primary,
  },
});
