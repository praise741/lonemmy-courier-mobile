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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
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

export default function OrderHistory() {
  const router = useRouter();

  // Fetch recent orders
  const { data: orders = [], isLoading, error, refetch } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await api.get('/orders');
      return response.data?.data ?? response.data ?? [];
    },
    staleTime: 5000, // Refresh friendly
  });

  const getStatusBadgeStyle = (status: Order['status']) => {
    switch (status) {
      case 'PENDING':
        return { bg: '#FFFBE6', text: '#D46B08', label: 'Pending Accept' };
      case 'PREPARING':
        return { bg: '#E6F7FF', text: '#0050B3', label: 'Preparing Meal' };
      case 'READY':
        return { bg: '#F6FFED', text: '#389E0D', label: 'Ready for Pickup' };
      case 'IN_TRANSIT':
        return { bg: '#F9F0FF', text: '#531DAB', label: 'In Transit' };
      case 'DELIVERED':
        return { bg: '#F6FFED', text: '#237804', label: 'Delivered' };
      case 'CANCELLED':
        return { bg: '#FFF0F6', text: '#C41D7F', label: 'Cancelled' };
      default:
        return { bg: COLORS.surfaceContainer, text: COLORS.secondary, label: status };
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(customer)/home')}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Order History</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>Loading orders...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="warning" $$$ />
            <Text style={[TYPOGRAPHY.body, { color: COLORS.primary, marginTop: SPACING.gutter }]}>
              Failed to load order history
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="fast-food" $$$ />
            <Text style={[TYPOGRAPHY.subtitle, { color: COLORS.secondary, marginTop: SPACING.gutter }]}>
              No orders yet
            </Text>
            <Text style={[TYPOGRAPHY.muted, { textAlign: 'center', marginTop: 4, paddingHorizontal: 40 }]}>
              Place your first order from JABU campus cafeterias to start tracking!
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/(customer)/home')}>
              <Text style={styles.retryText}>Order Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {orders.map((order) => {
              const badge = getStatusBadgeStyle(order.status);
              const formattedDate = new Date(order.createdAt).toLocaleDateString('en-NG', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => router.push(`/(customer)/order/${order.id}`)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.vendorInfo}>
                      {order.vendor.image ? (
                        <Image source={{ uri: order.vendor.image }} style={styles.vendorImage as any} />
                      ) : (
                        <View style={styles.vendorFallback}>
                          <Ionicons name="storefront" size={20} color={COLORS.secondary} />
                        </View>
                      )}
                      <View>
                        <Text style={[TYPOGRAPHY.subtitle, styles.vendorName]}>
                          {order.vendor.businessName}
                        </Text>
                        <Text style={[TYPOGRAPHY.labelMini, styles.orderDate]}>
                          {formattedDate}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardFooter}>
                    <Text style={[TYPOGRAPHY.muted, styles.orderIdText]}>
                      ID: #{order.id.slice(-6).toUpperCase()}
                    </Text>
                    <View style={styles.priceContainer}>
                      <Text style={[TYPOGRAPHY.subtitle, styles.totalLabel]}>Total Amount</Text>
                      <Text style={[TYPOGRAPHY.headlineLg, styles.totalValue]}>
                        ₦{Number(order.total).toLocaleString()}
                      </Text>
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
    paddingBottom: 40,
  },
  centerContainer: {
    paddingVertical: 120,
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
  ordersList: {
    gap: SPACING.stackMd,
  },
  orderCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    ...SHADOWS.appCard,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  vendorImage: {
    width: 40,
    height: 40,
    borderRadius: SHAPES.roundedCard,
  },
  vendorFallback: {
    width: 40,
    height: 40,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorName: {
    fontWeight: '800',
    color: COLORS.onSurface,
    fontSize: 15,
  },
  orderDate: {
    color: COLORS.outline,
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
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdText: {
    fontSize: 11,
    color: COLORS.outline,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 10,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  totalValue: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 16,
    marginTop: 2,
  },
});
