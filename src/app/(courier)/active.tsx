import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, ActivityIndicator, Vibration } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { playNotificationSound } from '../../utils/notificationSound';
import { useToast } from '@/context/ToastContext';


export default function ActiveDelivery() {
  const router = useRouter();
  const { id: paramId } = useLocalSearchParams();
  const { showToast } = useToast();

  // Alert overlay for simulating sound alerts
  const [showAlertOverlay, setShowAlertOverlay] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Primary stepper and mutation state variables
  const [isUpdating, setIsUpdating] = useState(false);

  // GPS / real-time courier position tracking
  const [courierPosition, setCourierPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // If no ID was explicitly passed, let's look for active orders via /courier/my-orders
  const { data: myOrders } = useQuery<any[]>({
    queryKey: ['myOrdersActiveSearch'],
    queryFn: async () => {
      const res = await api.get('/courier/my-orders');
      return res.data?.data ?? res.data ?? [];
    },
    enabled: !paramId,
  });

  const activeOrderFromList = Array.isArray(myOrders) ? myOrders.find(
    (order: any) => order.status !== 'DELIVERED' && order.status !== 'CANCELLED'
  ) : null;

  const orderId = paramId ?? activeOrderFromList?.id;

  // Query actual order detail
  const { 
    data: order, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<any>({
    queryKey: ['activeOrderDetail', orderId],
    queryFn: async () => {
      const res = await api.get(`/orders/${orderId}`);
      return res.data?.data ?? res.data;
    },
    enabled: !!orderId,
    refetchInterval: 10000, // Poll active delivery status every 10 seconds
  });

  // Sound and Haptic Playback trigger
  const playSoundChime = (message: string) => {
    setAlertMessage(message);
    setShowAlertOverlay(true);
    
    // Tactile Vibration alert chimes
    Vibration.vibrate([0, 150, 100, 200]);

    // Audio notification via expo-av
    playNotificationSound();

    setTimeout(() => {
      setShowAlertOverlay(false);
    }, 4000);
  };

  // Monitor order status transitions to dynamically play sound alerts
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  useEffect(() => {
    if (order && order.status) {
      if (lastStatus && order.status !== lastStatus) {
        playSoundChime(`Order transitioned from ${lastStatus} to ${order.status}!`);
      }
      setLastStatus(order.status);
    }
  }, [order?.status]);

  // Real GPS location tracking via expo-location
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied.');
          return;
        }

        setIsSharingLocation(true);
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (loc) => {
            setCourierPosition({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        );
      } catch (err) {
        console.error('Error starting location tracking:', err);
        setLocationError('Failed to start location tracking.');
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
        setIsSharingLocation(false);
      }
    };
  }, []);

  // Stop location sharing when delivery is complete
  useEffect(() => {
    if (order?.status === 'DELIVERED' && locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
      setIsSharingLocation(false);
    }
  }, [order?.status]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeContainer, styles.loadingCenter]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[TYPOGRAPHY.body, { color: COLORS.secondary, marginTop: SPACING.gutter }]}>
          Connecting to active GPS route...
        </Text>
      </SafeAreaView>
    );
  }

  if (error || !orderId || !order) {
    return (
      <SafeAreaView style={[styles.safeContainer, styles.loadingCenter]}>
        <Text style={{ fontSize: 44, marginBottom: 12 }}>🗺️</Text>
        <Text style={[TYPOGRAPHY.subtitle, { color: COLORS.onSurface, fontWeight: '700' }]}>
          No Active Deliveries Found
        </Text>
        <Text style={[TYPOGRAPHY.body, { color: COLORS.outline, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 }]}>
          You do not have any assigned deliveries currently in progress. Go back to claim a task offer.
        </Text>
        <TouchableOpacity
          style={styles.backHomeBtn}
          onPress={() => router.replace('/(courier)/dashboard')}
        >
          <Text style={styles.backHomeBtnText}>Return to Hub</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Parse order values
  const orderNumber = order.orderNumber ?? order.id.substring(0, 8).toUpperCase();
  const paymentMethod = order.paymentMethod ?? 'CARD';
  const totalAmount = order.total ?? order.orderTotal ?? 8500;
  const isCashPOD = paymentMethod === 'CASH' || paymentMethod === 'POD' || order.isCashOnDelivery === true;
  const isCashCollected = order.cashCollected === true || order.isCashCollected === true;

  // Map backend status to stepper stages
  // Stage statuses: CLAIMED -> PICKED_UP -> (CASH_COLLECTED if cash) -> DELIVERED
  const status = order.status; // e.g. ACCEPTED, PICKED_UP, DELIVERED
  
  let deliveryStep: 2 | 3 | 4 = 2; // Default 2: Heading to Pickup
  if (status === 'ACCEPTED' || status === 'ASSIGNED' || status === 'CLAIMED') {
    deliveryStep = 2; // At Pickup Spot
  } else if (status === 'PICKED_UP' || status === 'IN_TRANSIT' || status === 'DISPATCHED') {
    deliveryStep = 3; // In Transit
  } else if (status === 'DELIVERED') {
    deliveryStep = 4; // Completed
  }

  // Stepper Action Handlers
  const handleMarkPickup = async () => {
    setIsUpdating(true);
    try {
      await api.patch(`/courier/pickup/${orderId}`);
      playSoundChime('Success! Order items have been picked up from vendor.');
      refetch();
    } catch (err: any) {
      console.error('Error in pickup:', err);
      alert(err.response?.data?.message ?? 'Failed to update order status to Picked Up.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkCashCollected = async () => {
    setIsUpdating(true);
    try {
      await api.patch(`/courier/mark-cash-collected/${orderId}`);
      playSoundChime('Payment verified! Cash has been successfully logged.');
      refetch();
    } catch (err: any) {
      console.error('Error in cash collection:', err);
      alert(err.response?.data?.message ?? 'Failed to log cash payment collection.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkDelivered = async () => {
    setIsUpdating(true);
    try {
      await api.patch(`/courier/deliver/${orderId}`);
      playSoundChime('Congratulations! Delivery completed successfully.');
      
      Alert.alert(
        'Delivery Complete! 📦',
        `You have successfully delivered order #${orderNumber}. Payout has been deposited to your campus wallet.`,
        [
          {
            text: 'Return to Hub',
            onPress: () => router.replace('/(courier)/dashboard')
          }
        ]
      );
    } catch (err: any) {
      console.error('Error in delivery:', err);
      alert(err.response?.data?.message ?? 'Failed to update order status to Delivered.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Determine current active button action
  let primaryAction = handleMarkPickup;
  let primaryText = 'Mark as Picked Up';
  
  if (deliveryStep === 2) {
    primaryAction = handleMarkPickup;
    primaryText = 'Mark as Picked Up';
  } else if (deliveryStep === 3) {
    if (isCashPOD && !isCashCollected) {
      primaryAction = handleMarkCashCollected;
      primaryText = `Mark Cash Collected (₦${totalAmount.toLocaleString()})`;
    } else {
      primaryAction = handleMarkDelivered;
      primaryText = 'Mark as Delivered';
    }
  } else if (deliveryStep === 4) {
    primaryAction = async () => router.replace('/(courier)/dashboard');
    primaryText = 'Return to Dashboard';
  }

  const customerName = order.customer?.name ?? order.recipientName ?? 'Daniel Cole';
  const customerPhone = order.customer?.phone ?? order.phone ?? '+234-80-1234-5678';
  const customerAddress = order.deliveryAddress ?? order.address ?? 'Daniel Hall, Room 308';
  const vendorName = order.vendor?.businessName ?? order.vendorName ?? 'Varsity Grill A';
  const pickupAddress = order.vendor?.address ?? order.pickupAddress ?? 'Campus Cafeteria';
  
  const items = order.items ?? [];

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
      {/* Sound Check / Status Update Visual Glass Overlay */}
      {showAlertOverlay && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertPulse}>
              <View style={styles.alertPulseInner} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>🔔 Audio Chime Triggered</Text>
              <Text style={styles.alertDesc}>{alertMessage}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Live Map Tracking View */}
      <View style={styles.mapContainer}>
        {hasMapCoords ? (
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: (vendorLat! + customerLat!) / 2,
              longitude: (vendorLng! + customerLng!) / 2,
              latitudeDelta: Math.max(Math.abs(vendorLat! - customerLat!) * 1.8, 0.01),
              longitudeDelta: Math.max(Math.abs(vendorLng! - customerLng!) * 1.8, 0.01),
            }}
          >
            <Marker
              coordinate={{ latitude: vendorLat!, longitude: vendorLng! }}
              title={vendorName}
              description={pickupAddress}
              pinColor="red"
            />
            <Marker
              coordinate={{ latitude: customerLat!, longitude: customerLng! }}
              title={customerName}
              description={customerAddress}
              pinColor="blue"
            />
            {courierPosition && (
              <Marker
                coordinate={courierPosition}
                title="You are here"
                description="Your current location"
                pinColor="green"
              />
            )}
            <Polyline
              coordinates={
                courierPosition
                  ? [courierPosition, { latitude: customerLat!, longitude: customerLng! }]
                  : [{ latitude: vendorLat!, longitude: vendorLng! }, { latitude: customerLat!, longitude: customerLng! }]
              }
              strokeColor={courierPosition ? '#00e676' : COLORS.primary}
              strokeWidth={4}
            />
          </MapView>
        ) : (
          <View style={styles.mapUnavailable}>
            <Ionicons name="warning" $$$ />
            <Text style={[TYPOGRAPHY.muted, { fontWeight: '600', fontSize: 13 }]}>
              Map data unavailable
            </Text>
            <Text style={[TYPOGRAPHY.muted, { fontSize: 11, textAlign: 'center', paddingHorizontal: 40 }]}>
              Location coordinates are being retrieved from the campus API
            </Text>
          </View>
        )}

        {/* Location sharing indicator */}
        {isSharingLocation && (
          <View style={styles.locationSharingBadge}>
            <View style={styles.locationPulseDot} />
            <Text style={[TYPOGRAPHY.labelMini, styles.locationSharingText]}>📍 Sharing your location</Text>
          </View>
        )}

        {/* Live Badge overlay */}
        <View style={styles.liveTrackingBadge}>
          <View style={styles.pulseDot} />
          <Text style={[TYPOGRAPHY.labelMini, styles.liveBadgeText]}>LIVE NAVIGATION ACTIVE</Text>
        </View>

        {/* Back navigation */}
        <TouchableOpacity style={styles.mapBackBtn} onPress={() => router.replace('/(courier)/dashboard')}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>

        {/* Manual Sound Check Button */}
        <TouchableOpacity 
          style={styles.soundCheckBtn} 
          onPress={() => playSoundChime('Manual sound check. System Audio & Vibration alert normal!')}
        >
          <Text style={{ fontSize: 14 }}>🔊 Sound Check</Text>
        </TouchableOpacity>
      </View>

      {/* Details Sheets */}
      <ScrollView contentContainerStyle={styles.sheetContent}>
        {/* Order Identifier Header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={[TYPOGRAPHY.headlineLg, styles.orderTitle]}>Order #{orderNumber}</Text>
            <Text style={[TYPOGRAPHY.muted, styles.orderSub]}>
              Payment: {paymentMethod} • {isCashPOD ? 'Collect Cash' : 'Prepaid Wallet'}
            </Text>
          </View>
          <View style={styles.timerBadge}>
            <Ionicons name="settings" $$$ />
            <Text style={[TYPOGRAPHY.labelMini, styles.timerText]}>12 MINS</Text>
          </View>
        </View>

        {/* Customer Communication Card */}
        <View style={styles.sectionCard}>
          <View style={styles.customerRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{customerName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.customerDetails}>
              <Text style={[TYPOGRAPHY.subtitle, styles.customerName]}>{customerName}</Text>
              <Text style={[TYPOGRAPHY.muted, styles.customerSub]}>{customerAddress}</Text>
            </View>
            <View style={styles.communicationActions}>
              <TouchableOpacity 
                style={styles.actionCircleBtn} 
                onPress={() => showToast(`Calling customer ${customerName}: ${customerPhone}`, 'info')}
              >
                <Ionicons name="call" $$$ />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCircleBtn} onPress={() => router.push('/chat/conversations')}>
                <Ionicons name="chatbubble" $$$ />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.packageRow}>
            <Ionicons name="fast-food" $$$ />
            <View style={{ flex: 1 }}>
              <Text style={styles.packageLabel}>PACKAGE CONTENTS</Text>
              <Text style={[TYPOGRAPHY.body, styles.packageVal]}>
                {items.length > 0 
                  ? items.map((i: any) => `${i.quantity ?? 1}x ${i.product?.name ?? i.name}`).join(', ') 
                  : '3 Food Packs (The Varsity Grill)'
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Stepper Status Milestones */}
        <View style={styles.stepperContainer}>
          {/* Step 1: Claimed */}
          <View style={styles.stepRow}>
            <View style={styles.indicatorContainer}>
              <View style={[styles.stepCheckCircle, { backgroundColor: COLORS.secondary }]}>
                <Text style={{ color: COLORS.onSecondary, fontSize: 10 }}>✓</Text>
              </View>
              <View style={[styles.connectorLine, { backgroundColor: COLORS.secondary }]} />
            </View>
            <View style={styles.stepLabels}>
              <Text style={[TYPOGRAPHY.subtitle, styles.stepTitleDone]}>Task Claimed</Text>
              <Text style={[TYPOGRAPHY.muted, styles.stepDesc]}>Order Assigned to Courier</Text>
            </View>
          </View>

          {/* Step 2: At Pickup */}
          <View style={styles.stepRow}>
            <View style={styles.indicatorContainer}>
              <View style={[
                styles.stepCheckCircle,
                deliveryStep >= 3 ? { backgroundColor: COLORS.secondary } : { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: COLORS.background }
              ]}>
                {deliveryStep >= 3 ? (
                  <Text style={{ color: COLORS.onSecondary, fontSize: 10 }}>✓</Text>
                ) : (
                  <View style={styles.innerActiveDot} />
                )}
              </View>
              <View style={[
                styles.connectorLine,
                deliveryStep >= 3 ? { backgroundColor: COLORS.secondary } : { backgroundColor: COLORS.divider }
              ]} />
            </View>
            <View style={styles.stepLabels}>
              <Text style={[
                TYPOGRAPHY.subtitle,
                deliveryStep === 2 ? styles.stepTitleActive : deliveryStep > 2 ? styles.stepTitleDone : styles.stepTitlePending
              ]}>
                At Pickup Spot
              </Text>
              <Text style={[TYPOGRAPHY.muted, styles.stepDesc]}>Vendor: {vendorName} ({pickupAddress})</Text>
            </View>
          </View>

          {/* Step 3: In Transit */}
          <View style={styles.stepRow}>
            <View style={styles.indicatorContainer}>
              <View style={[
                styles.stepCheckCircle,
                deliveryStep >= 4 
                  ? { backgroundColor: COLORS.secondary } 
                  : (deliveryStep === 3 
                      ? { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: COLORS.background } 
                      : { borderColor: COLORS.divider, borderWidth: 2, backgroundColor: COLORS.background })
              ]}>
                {deliveryStep >= 4 ? (
                  <Text style={{ color: COLORS.onSecondary, fontSize: 10 }}>✓</Text>
                ) : deliveryStep === 3 ? (
                  <View style={styles.innerActiveDot} />
                ) : null}
              </View>
              <View style={[
                styles.connectorLine,
                deliveryStep >= 4 ? { backgroundColor: COLORS.secondary } : { backgroundColor: COLORS.divider }
              ]} />
            </View>
            <View style={styles.stepLabels}>
              <Text style={[
                TYPOGRAPHY.subtitle,
                deliveryStep === 3 ? styles.stepTitleActive : deliveryStep > 3 ? styles.stepTitleDone : styles.stepTitlePending
              ]}>
                In Transit {isCashPOD && !isCashCollected && '• Collect Cash'}
              </Text>
              <Text style={[TYPOGRAPHY.muted, styles.stepDesc]}>
                {isCashPOD 
                  ? (isCashCollected ? '✓ Cash Collected (₦' + totalAmount.toLocaleString() + ')' : '⚠️ Collect Cash: ₦' + totalAmount.toLocaleString()) 
                  : 'Prepaid order: No collection needed.'
                }
              </Text>
            </View>
          </View>

          {/* Step 4: Delivered */}
          <View style={[styles.stepRow, { paddingBottom: 0 }]}>
            <View style={styles.indicatorContainer}>
              <View style={[
                styles.stepCheckCircle,
                deliveryStep === 4 ? { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: COLORS.background } : { borderColor: COLORS.divider, borderWidth: 2, backgroundColor: COLORS.background }
              ]}>
                {deliveryStep === 4 ? <View style={styles.innerActiveDot} /> : null}
              </View>
            </View>
            <View style={styles.stepLabels}>
              <Text style={[
                TYPOGRAPHY.subtitle,
                deliveryStep === 4 ? styles.stepTitleActive : styles.stepTitlePending
              ]}>
                Delivered
              </Text>
              <Text style={[TYPOGRAPHY.muted, styles.stepDesc]}>Delivery complete check</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Primary Action Sticky CTA Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={primaryAction}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color={COLORS.onPrimary} />
          ) : (
            <>
              <Text style={[TYPOGRAPHY.subtitle, styles.actionBtnText]}>
                {primaryText}
              </Text>
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
  backHomeBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: SHAPES.roundedLg,
  },
  backHomeBtnText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  alertOverlay: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    zIndex: 9999,
    ...SHADOWS.appShell,
  },
  alertCard: {
    backgroundColor: 'rgba(20, 27, 44, 0.95)',
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  alertPulse: {
    width: 24,
    height: 24,
    borderRadius: SHAPES.roundedMd,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertPulseInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00e676',
  },
  alertTitle: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
  alertDesc: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  mapContainer: {
    height: 240,
    position: 'relative',
    backgroundColor: COLORS.surfaceContainerLow,
  },
  mapUnavailable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  mapImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveTrackingBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedCard,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.stackSm,
    ...SHADOWS.appCard,
  },
  locationSharingBadge: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: '#E6F9ED',
    borderWidth: 1,
    borderColor: '#0D7D3E',
    borderRadius: SHAPES.roundedCard,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...SHADOWS.appCard,
  },
  locationPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0D7D3E',
  },
  locationSharingText: {
    fontSize: 10,
    color: '#0D7D3E',
    fontWeight: '800',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  liveBadgeText: {
    fontSize: 9,
    color: COLORS.secondary,
    fontWeight: '800',
  },
  mapBackBtn: {
    position: 'absolute',
    top: 16,
    left: SPACING.pagePadding,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  soundCheckBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: COLORS.surfaceContainerLowest,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: SHAPES.roundedMd,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  sheetContent: {
    paddingHorizontal: SPACING.pagePadding,
    paddingTop: SPACING.stackLg,
    paddingBottom: 120,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    flexGrow: 1,
    ...SHADOWS.appShell,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.stackLg,
  },
  orderTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  orderSub: {
    color: COLORS.onSurfaceVariant,
    fontSize: 12,
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondaryContainer,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: SHAPES.roundedDefault,
    gap: 4,
  },
  timerText: {
    fontWeight: '800',
    color: COLORS.onSecondaryContainer,
  },
  sectionCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    ...SHADOWS.appCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.stackLg,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  customerSub: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  communicationActions: {
    flexDirection: 'row',
    gap: SPACING.stackSm,
  },
  actionCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 12,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  packageLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.outline,
    letterSpacing: 1,
  },
  packageVal: {
    fontWeight: '600',
    color: COLORS.onSurface,
    marginTop: 2,
    fontSize: 13,
  },
  stepperContainer: {
    paddingHorizontal: 8,
  },
  stepRow: {
    flexDirection: 'row',
    gap: SPACING.stackMd,
  },
  indicatorContainer: {
    alignItems: 'center',
    width: 28,
  },
  stepCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  innerActiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  connectorLine: {
    width: 2,
    height: 48,
    zIndex: 1,
    marginTop: -2,
    marginBottom: -2,
  },
  stepLabels: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: 20,
  },
  stepTitleDone: {
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  stepTitleActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  stepTitlePending: {
    color: COLORS.outline,
    opacity: 0.6,
  },
  stepDesc: {
    color: COLORS.outline,
    marginTop: 2,
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surfaceContainerLowest,
    paddingHorizontal: SPACING.pagePadding,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  actionBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: SHAPES.roundedLg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.stackSm,
    ...SHADOWS.appCard,
  },
  actionBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
});
