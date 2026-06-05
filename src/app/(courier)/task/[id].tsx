import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';

export default function NewDeliveryTask() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  // Fetch task/order details from GET /orders/:id
  const { data: order, isLoading, error } = useQuery<any>({
    queryKey: ['orderOffer', id],
    queryFn: async () => {
      const res = await api.get(`/orders/${id}`);
      return res.data?.data ?? res.data;
    },
    enabled: !!id,
  });

  // Claim/accept delivery: Bind the accept action to PATCH /courier/claim/:id
  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await api.patch(`/courier/claim/${id}`);
      // Redirect courier to the active delivery tracker screen
      router.replace({
        pathname: '/(courier)/active',
        params: { id }
      });
    } catch (err: any) {
      console.error('Error claiming order:', err);
      const msg = err.response?.data?.message ?? 'Failed to accept delivery task. It may have already been claimed.';
      alert(msg);
    } finally {
      setIsAccepting(false);
    }
  };

  // Decline/drop delivery: Bind the decline action to PATCH /courier/orders/:id/drop
  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await api.patch(`/courier/orders/${id}/drop`);
      router.replace('/(courier)/dashboard');
    } catch (err: any) {
      console.error('Error dropping order:', err);
      // Navigate back to dashboard even if drop endpoint has a route mismatch
      router.replace('/(courier)/dashboard');
    } finally {
      setIsDeclining(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeContainer, styles.loadingCenter]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[TYPOGRAPHY.body, { color: COLORS.secondary, marginTop: SPACING.gutter }]}>
          Retrieving order details...
        </Text>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={[styles.safeContainer, styles.loadingCenter]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
        <Text style={[TYPOGRAPHY.subtitle, { color: COLORS.onSurface, fontWeight: '700' }]}>
          Failed to load offer
        </Text>
        <Text style={[TYPOGRAPHY.body, { color: COLORS.outline, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }]}>
          This task offer may have expired, been claimed by another rider, or is temporarily unavailable.
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => router.replace('/(courier)/dashboard')}
        >
          <Text style={styles.retryBtnText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Dynamic layout values
  const deliveryPayout = order.deliveryFee ?? 8500;
  const vendorName = order.vendor?.businessName ?? order.vendorName ?? 'Campus Cafe';
  const pickupAddress = order.vendor?.address ?? order.pickupAddress ?? 'Campus Cafeteria';
  const dropoffAddress = order.deliveryAddress ?? order.address ?? 'Male Hostel, Hall C';
  const items = order.items ?? [];
  const note = order.specialInstructions ?? order.notes ?? order.instruction ?? 'Keep food items upright and warm in thermal bag.';

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

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(courier)/dashboard')}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>New Task Offer</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Payout Banner */}
        <View style={styles.payoutCard}>
          <Text style={[TYPOGRAPHY.muted, styles.payoutLabel]}>GUARANTEED PAYOUT</Text>
          <Text style={[TYPOGRAPHY.headlineXl, styles.payoutVal]}>₦{deliveryPayout.toLocaleString()}.00</Text>
          <Text style={[TYPOGRAPHY.muted, styles.payoutBonus]}>Includes JABU compounding delivery fees + ₦500 tip</Text>
        </View>

        {/* Item Details Card */}
        <View style={styles.sectionCard}>
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>📦 Item Details</Text>
          <View style={styles.detailRow}>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Size Category</Text>
              <Text style={[TYPOGRAPHY.body, styles.detailValText]}>Medium Package</Text>
            </View>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Quantity</Text>
              <Text style={[TYPOGRAPHY.body, styles.detailValText]}>
                {items.length > 0 ? `${items.length} items` : '3 Cafeteria Packs'}
              </Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          {items.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.detailLabel}>Items List</Text>
              {items.map((item: any, index: number) => (
                <Text key={item.id ?? index} style={[TYPOGRAPHY.body, { color: COLORS.onSurfaceVariant, marginBottom: 4 }]}>
                  • {item.quantity ?? 1}x {item.product?.name ?? item.name ?? 'Campus Meal'}
                </Text>
              ))}
              <View style={styles.divider} />
            </View>
          )}

          <Text style={styles.detailLabel}>Special Instructions</Text>
          <Text style={[TYPOGRAPHY.body, styles.instructionsText]}>
            "{note}"
          </Text>
        </View>

        {/* Route Details Card with Stylized Map Mock */}
        <View style={styles.sectionCard}>
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>📍 Route Overview</Text>

          {/* Route Map Overview */}
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
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: vendorLat!, longitude: vendorLng! }}
                  title={vendorName}
                  description={pickupAddress}
                  pinColor="red"
                />
                <Marker
                  coordinate={{ latitude: customerLat!, longitude: customerLng! }}
                  title="Dropoff Location"
                  description={dropoffAddress}
                  pinColor="blue"
                />
                <Polyline
                  coordinates={[
                    { latitude: vendorLat!, longitude: vendorLng! },
                    { latitude: customerLat!, longitude: customerLng! },
                  ]}
                  strokeColor={COLORS.primary}
                  strokeWidth={3}
                />
              </MapView>
              <View style={styles.mapOverlay}>
                <Text style={[TYPOGRAPHY.labelMini, styles.mapRouteLabel]}>CAMPUS TASK ROUTE MAP</Text>
              </View>
            </View>
          ) : (
            <View style={styles.mapUnavailable}>
              <Ionicons name="warning" $$$ />
              <Text style={[TYPOGRAPHY.muted, styles.mapUnavailableText]}>
                Map data unavailable
              </Text>
            </View>
          )}

          {/* Route checkpoints */}
          <View style={styles.routeTimeline}>
            <View style={styles.timelineDots}>
              <View style={[styles.timelineDot, { backgroundColor: COLORS.secondary }]} />
              <View style={styles.timelineLine} />
              <View style={[styles.timelineDot, { backgroundColor: COLORS.primary }]} />
            </View>
            <View style={styles.timelineLabels}>
              <View style={styles.timelineStep}>
                <Text style={[TYPOGRAPHY.body, styles.stepTitle]}>{vendorName}</Text>
                <Text style={[TYPOGRAPHY.muted, styles.stepDesc]}>Pickup point • {pickupAddress}</Text>
              </View>
              <View style={styles.timelineStep}>
                <Text style={[TYPOGRAPHY.body, styles.stepTitle]}>{dropoffAddress}</Text>
                <Text style={[TYPOGRAPHY.muted, styles.stepDesc]}>Dropoff location</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Accept / Decline CTA Buttons Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={handleDecline}
          disabled={isAccepting || isDeclining}
        >
          {isDeclining ? (
            <ActivityIndicator size="small" color={COLORS.secondary} />
          ) : (
            <Text style={[TYPOGRAPHY.subtitle, styles.declineBtnText]}>Decline</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={handleAccept}
          disabled={isAccepting || isDeclining}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color={COLORS.onPrimary} />
          ) : (
            <>
              <Text style={[TYPOGRAPHY.subtitle, styles.acceptBtnText]}>Accept Task</Text>
              <Ionicons name="chevron-forward" $$$ />
            </>
          )}
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
  loadingCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: SHAPES.roundedLg,
  },
  retryBtnText: {
    color: COLORS.white,
    fontWeight: '800',
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
    gap: SPACING.stackMd,
    paddingBottom: 120,
  },
  payoutCard: {
    backgroundColor: COLORS.inverseSurface,
    borderRadius: SHAPES.roundedXl,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.appCard,
  },
  payoutLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '700',
  },
  payoutVal: {
    color: COLORS.inversePrimary,
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 4,
  },
  payoutBonus: {
    color: COLORS.inverseOnSurface,
    fontSize: 11,
  },
  sectionCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  sectionTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.stackMd,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.outline,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValText: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 12,
  },
  instructionsText: {
    color: COLORS.onSurfaceVariant,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  mapMock: {
    height: 120,
    backgroundColor: COLORS.divider,
    borderRadius: 14,
    marginBottom: SPACING.stackMd,
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: 'hidden',
  },
  mapUnavailable: {
    height: 120,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    marginBottom: SPACING.stackMd,
    borderWidth: 1,
    borderColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  mapUnavailableText: {
    color: COLORS.outline,
    fontWeight: '600',
    fontSize: 12,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(29, 30, 41, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  mapRouteLabel: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: '800',
  },
  routeTimeline: {
    flexDirection: 'row',
    gap: SPACING.gutter,
  },
  timelineDots: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
  },
  timelineLabels: {
    flex: 1,
    gap: 20,
  },
  timelineStep: {
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: SPACING.pagePadding,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    flexDirection: 'row',
    gap: SPACING.gutter,
  },
  declineBtn: {
    flex: 1,
    height: 52,
    borderRadius: SHAPES.roundedLg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtnText: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  acceptBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: SHAPES.roundedLg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.stackSm,
    ...SHADOWS.appCard,
  },
  acceptBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
});
