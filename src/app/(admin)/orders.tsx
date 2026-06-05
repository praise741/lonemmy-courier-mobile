import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, FlatList,
  Alert, ActivityIndicator, RefreshControl, Modal, ScrollView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface OrderItem {
  id: string;
  customer?: { name: string };
  vendor?: { businessName: string };
  status: string;
  total: number;
  courier?: { id: string; name: string } | null;
}

interface PaginatedResponse {
  data: OrderItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface LocationOption {
  id: string;
  name: string;
}

interface CourierOption {
  id: string;
  name: string;
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  CONFIRMED: '#3B82F6',
  PREPARING: '#8B5CF6',
  READY: '#10B981',
  IN_TRANSIT: '#06B6D4',
  DELIVERED: '#10B981',
  CANCELLED: COLORS.error,
};

export default function AdminOrders() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [locationFilter, setLocationFilter] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [courierSearch, setCourierSearch] = useState('');
  const pageSize = 15;

  const { data, isLoading, isRefetching, error, refetch } = useQuery<PaginatedResponse>({
    queryKey: ['adminOrders', page, locationFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (locationFilter) params.append('locationId', locationFilter);
      const res = await api.get(`/admin/orders?${params.toString()}`);
      return res.data;
    },
  });

  const { data: locations } = useQuery<{ data: LocationOption[] }>({
    queryKey: ['adminLocations'],
    queryFn: async () => {
      const res = await api.get('/admin/locations');
      return res.data;
    },
  });

  const { data: couriersData } = useQuery<{ data: CourierOption[] }>({
    queryKey: ['adminCouriersList'],
    queryFn: async () => {
      const res = await api.get('/admin/couriers?pageSize=200');
      return res.data;
    },
    enabled: showAssignModal,
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await api.patch(`/admin/orders/${orderId}/cancel`);
    },
    onSuccess: () => {
      showToast('Order cancelled', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to cancel order.', 'error');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ orderId, courierId }: { orderId: string; courierId: string }) => {
      await api.patch(`/admin/orders/${orderId}/assign`, { courierId });
    },
    onSuccess: () => {
      showToast('Courier assigned', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      setShowAssignModal(false);
      setSelectedOrderId(null);
      setCourierSearch('');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to assign courier.', 'error');
    },
  });

  const handleCancelOrder = (order: OrderItem) => {
    Alert.alert(
      'Cancel Order',
      `Are you sure you want to cancel order #${order.id?.slice(0, 8)}?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate(order.id) },
      ],
    );
  };

  const handleAssignCourier = (order: OrderItem) => {
    setSelectedOrderId(order.id);
    setCourierSearch('');
    setShowAssignModal(true);
  };

  const availableCouriers = (couriersData?.data ?? []).filter(
    (c) => c.name.toLowerCase().includes(courierSearch.toLowerCase()),
  );

  const formatNaira = (value: number) => {
    return '₦' + value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const locationOptions = locations?.data ?? [];

  const renderItem = ({ item }: { item: OrderItem }) => {
    const statusColor = ORDER_STATUS_COLORS[item.status] || COLORS.outline;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.orderIdRow}>
            <Text style={[TYPOGRAPHY.labelMini, { color: COLORS.primary }]}>
              #{item.id?.slice(0, 8).toUpperCase()}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status?.replace('_', ' ')}
              </Text>
            </View>
          </View>
          <Text style={[TYPOGRAPHY.headlineLg, styles.totalText]}>{formatNaira(item.total)}</Text>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottom}>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color={COLORS.secondary} />
            <Text style={[TYPOGRAPHY.muted, styles.infoText]} numberOfLines={1}>
              {item.customer?.name || 'N/A'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="storefront" size={20} color={COLORS.secondary} />
            <Text style={[TYPOGRAPHY.muted, styles.infoText]} numberOfLines={1}>
              {item.vendor?.businessName || 'N/A'}
            </Text>
          </View>
          {item.courier && (
            <View style={styles.infoRow}>
              <Ionicons name="car" $$$ />
              <Text style={[TYPOGRAPHY.muted, styles.infoText]} numberOfLines={1}>
                {item.courier.name}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          {!item.courier && item.status !== 'CANCELLED' && item.status !== 'DELIVERED' && (
            <TouchableOpacity
              style={styles.actionBtnAssign}
              onPress={() => handleAssignCourier(item)}
            >
              <Ionicons name="car" $$$ />
              <Text style={styles.actionBtnTextWhite}>Assign</Text>
            </TouchableOpacity>
          )}
          {item.status !== 'CANCELLED' && item.status !== 'DELIVERED' && (
            <TouchableOpacity
              style={styles.actionBtnCancel}
              onPress={() => handleCancelOrder(item)}
              disabled={cancelMutation.isPending}
            >
              <Text style={styles.actionBtnTextRed}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const orders = data?.data ?? [];
  const meta = data?.meta;

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(admin)/dashboard')}>
          <Ionicons name="arrow-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Orders</Text>
      </View>

      {locationOptions.length > 0 && (
        <View style={styles.filterRow}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: '', name: 'All Locations' }, ...locationOptions]}
            keyExtractor={(loc) => loc.id}
            contentContainerStyle={styles.filterContent}
            renderItem={({ item: loc }) => (
              <TouchableOpacity
                style={[styles.filterPill, locationFilter === loc.id && styles.filterPillActive]}
                onPress={() => { setLocationFilter(loc.id); setPage(1); }}
              >
                <Text style={[
                  styles.filterPillText,
                  locationFilter === loc.id && styles.filterPillTextActive,
                ]}>
                  {loc.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorIconBg}>
            <Ionicons name="warning" $$$ />
          </View>
          <Text style={[TYPOGRAPHY.subtitle, styles.errorTitle]}>Failed to load orders</Text>
          <Text style={[TYPOGRAPHY.body, styles.errorText]}>
            {(error as any)?.response?.data?.message || 'Check your connection and try again.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={[TYPOGRAPHY.subtitle, styles.retryButtonText]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 44 }}>📦</Text>
          <Text style={[TYPOGRAPHY.subtitle, styles.emptyTitle]}>No orders found</Text>
          <Text style={[TYPOGRAPHY.muted, styles.emptyText]}>
            {locationFilter ? 'No orders for this location yet.' : 'No orders have been placed yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[COLORS.primary]} />
          }
        />
      )}

      {meta && meta.totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <Ionicons name="chevron-back" $$$ />
            <Text style={[TYPOGRAPHY.body, { color: page <= 1 ? COLORS.outline : COLORS.primary, fontWeight: '700' }]}>
              Previous
            </Text>
          </TouchableOpacity>
          <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary }]}>
            Page {meta.page} of {meta.totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.pageBtn, page >= meta.totalPages && styles.pageBtnDisabled]}
            onPress={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
          >
            <Text style={[TYPOGRAPHY.body, { color: page >= meta.totalPages ? COLORS.outline : COLORS.primary, fontWeight: '700' }]}>
              Next
            </Text>
            <Ionicons name="chevron-forward" $$$ />
          </TouchableOpacity>
        </View>
      )}

      {/* Assign Courier Modal */}
      <Modal visible={showAssignModal} animationType="slide" presentationStyle="pageSheet" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.assignModalContainer}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => { setShowAssignModal(false); setSelectedOrderId(null); }}
              >
                <Ionicons name="chevron-back" $$$ />
              </TouchableOpacity>
              <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Assign Courier</Text>
            </View>

            <View style={styles.searchBox}>
              <TextInput
                style={[TYPOGRAPHY.body, styles.searchInput]}
                placeholder="Search couriers..."
                placeholderTextColor={COLORS.outline}
                value={courierSearch}
                onChangeText={setCourierSearch}
              />
            </View>

            <FlatList
              data={availableCouriers}
              keyExtractor={(c) => c.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item: courier }) => (
                <TouchableOpacity
                  style={styles.courierCard}
                  onPress={() => {
                    if (selectedOrderId) {
                      assignMutation.mutate({ orderId: selectedOrderId, courierId: courier.id });
                    }
                  }}
                  disabled={assignMutation.isPending}
                >
                  <View style={styles.courierAvatar}>
                    <Ionicons name="car" $$$ />
                  </View>
                  <Text style={[TYPOGRAPHY.subtitle, { color: COLORS.onSurface, fontWeight: '700' }]}>
                    {courier.name}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={[TYPOGRAPHY.body, { color: COLORS.secondary }]}>No couriers available</Text>
                </View>
              }
            />
          </SafeAreaView>
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
  },
  headerTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
    marginLeft: 8,
  },
  filterRow: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingVertical: 8,
  },
  filterContent: {
    paddingHorizontal: SPACING.pagePadding,
    gap: SPACING.stackSm,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  filterPillTextActive: {
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
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 10,
    ...SHADOWS.appCard,
  },
  cardTop: {
    gap: 4,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: SHAPES.roundedDefault,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  totalText: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  cardBottom: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    color: COLORS.secondary,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.stackSm,
  },
  actionBtnAssign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnTextWhite: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  actionBtnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.errorContainer || 'rgba(187, 1, 20, 0.08)',
  },
  actionBtnTextRed: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.error,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.pagePadding,
    paddingVertical: 12,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  assignModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  searchBox: {
    paddingHorizontal: SPACING.pagePadding,
    paddingVertical: 8,
  },
  searchInput: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedMd,
    paddingHorizontal: 16,
    height: 44,
    color: COLORS.onSurface,
  },
  courierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  courierAvatar: {
    width: 40,
    height: 40,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
