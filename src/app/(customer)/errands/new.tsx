import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function NewErrandScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const isAuthenticated = !!user;

  // Form states
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [packageSize, setPackageSize] = useState<'Small' | 'Medium' | 'Large'>('Medium');
  const [packageDescription, setPackageDescription] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [selectedCampus, setSelectedCampus] = useState<{ id: string; name: string } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load campus & check guest redirect
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }

    const loadCampus = async () => {
      try {
        const stored = await AsyncStorage.getItem('lonemmy-selected-campus');
        if (stored) {
          setSelectedCampus(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load selected campus', e);
      }
    };
    loadCampus();
  }, [isAuthenticated, router]);

  const getPrice = () => {
    if (packageSize === 'Small') return 500;
    if (packageSize === 'Large') return 1200;
    return 800; // Medium
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }

    if (!pickupAddress.trim() || !dropoffAddress.trim() || !recipientName.trim() || !recipientPhone.trim()) {
      setFormError('Please fill in all required fields.');
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      // 1. Create ErrandOrder
      const errandRes = await api.post('/errands', {
        pickupAddress: pickupAddress.trim(),
        dropoffAddress: dropoffAddress.trim(),
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        packageSize,
        packageDescription: packageDescription.trim() || undefined,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        campusId: selectedCampus?.id || undefined,
      });

      const errand = errandRes.data?.data || errandRes.data;

      // 2. Initialize Paystack checkout
      const paymentRes = await api.post(`/payments/initialize-errand/${errand.id}`);
      const { authorizationUrl, reference } = paymentRes.data?.data || paymentRes.data || {};

      if (authorizationUrl) {
        setIsSubmitting(false);
        // Open payment link in expo-web-browser and wait for it to close
        await WebBrowser.openBrowserAsync(authorizationUrl);

        // Verify transaction reference
        setIsSubmitting(true);
        try {
          const verifyRes = await api.get(`/payments/verify/${reference}`);
          const isVerified = verifyRes.data?.success || 
                             verifyRes.data?.data?.status === 'success' || 
                             verifyRes.data?.status === 'success';

          if (isVerified) {
            Alert.alert('Payment Successful! 🎉', 'Your package delivery is confirmed and couriers have been notified.', [
              {
                text: 'Continue to Orders',
                onPress: () => {
                  router.replace('/(customer)/orders');
                }
              }
            ]);
          } else {
            Alert.alert(
              'Payment Verification Pending',
              'We could not confirm payment immediately. If you completed payment, it will process shortly.',
              [
                {
                  text: 'View Orders',
                  onPress: () => {
                    router.replace('/(customer)/orders');
                  }
                }
              ]
            );
          }
        } catch (verifyErr) {
          console.error('Errand payment verification failed:', verifyErr);
          Alert.alert(
            'Payment Verification Issue',
            'Your payment session closed. If completed, your delivery status will update shortly.',
            [
              {
                text: 'View Orders',
                onPress: () => {
                  router.replace('/(customer)/orders');
                }
              }
            ]
          );
        }
      } else {
        throw new Error('Paystack authorization URL missing');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || 'Failed to book package delivery. Please try again.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(customer)/home')}>
          <Ionicons name="chevron-back" size={24} color={COLORS.onBackground} />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Book Errand</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Intro */}
        <View style={styles.introSection}>
          <View style={styles.packageIconBg}>
            <Ionicons name="cube" size={24} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Package Delivery</Text>
            <Text style={styles.introDesc}>
              Send documents, laptops, laundry, or store purchases peer-to-peer across the campus.
            </Text>
          </View>
        </View>

        {/* Guest boundary block */}
        {!isAuthenticated && (
          <View style={styles.guestBlock}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={styles.lockIconBg}>
                <Ionicons name="lock-closed" size={20} color="#4F46E5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guestTitle}>Authentication Required</Text>
                <Text style={styles.guestDesc}>
                  You can view the form details, but you must be logged in to book an errand.
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.guestLoginBtn} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.guestLoginBtnText}>Log In or Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Form Error */}
        {formError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        )}

        {/* Campus Notice */}
        <View style={styles.campusCard}>
          <Ionicons name="pin" size={18} color={COLORS.primary} />
          <Text style={styles.campusLabel}>Campus Sector:</Text>
          <Text style={styles.campusValue}>{selectedCampus ? selectedCampus.name : 'Not selected'}</Text>
        </View>

        {/* Size Selection */}
        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles" size={16} color={COLORS.primary} />
          <Text style={styles.sectionTitleLabel}>SELECT PACKAGE SIZE</Text>
        </View>

        <View style={styles.sizeGrid}>
          {/* Small */}
          <TouchableOpacity
            style={[styles.sizeCard, packageSize === 'Small' && styles.sizeCardActive]}
            onPress={() => setPackageSize('Small')}
          >
            <Text style={[styles.sizeCardTitle, packageSize === 'Small' && styles.sizeTextActive]}>Small</Text>
            <Text style={styles.sizeCardDesc}>Keys, Documents</Text>
            <Text style={[styles.sizeCardPrice, packageSize === 'Small' && styles.sizePriceActive]}>₦500</Text>
          </TouchableOpacity>

          {/* Medium */}
          <TouchableOpacity
            style={[styles.sizeCard, packageSize === 'Medium' && styles.sizeCardActive]}
            onPress={() => setPackageSize('Medium')}
          >
            <Text style={[styles.sizeCardTitle, packageSize === 'Medium' && styles.sizeTextActive]}>Medium</Text>
            <Text style={styles.sizeCardDesc}>Food, Books</Text>
            <Text style={[styles.sizeCardPrice, packageSize === 'Medium' && styles.sizePriceActive]}>₦800</Text>
          </TouchableOpacity>

          {/* Large */}
          <TouchableOpacity
            style={[styles.sizeCard, packageSize === 'Large' && styles.sizeCardActive]}
            onPress={() => setPackageSize('Large')}
          >
            <Text style={[styles.sizeCardTitle, packageSize === 'Large' && styles.sizeTextActive]}>Large</Text>
            <Text style={styles.sizeCardDesc}>Laundry, Laptop</Text>
            <Text style={[styles.sizeCardPrice, packageSize === 'Large' && styles.sizePriceActive]}>₦1200</Text>
          </TouchableOpacity>
        </View>

        {/* Route Details */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardHeaderTitle}>📍 Route Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Pickup Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Block A Room 202, Hall 1"
              placeholderTextColor="#94A3B8"
              value={pickupAddress}
              onChangeText={setPickupAddress}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Dropoff / Destination Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Faculty of Science Lab 3"
              placeholderTextColor="#94A3B8"
              value={dropoffAddress}
              onChangeText={setDropoffAddress}
            />
          </View>
        </View>

        {/* Recipient Details */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardHeaderTitle}>👤 Recipient Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Recipient's Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Daniel Praise"
              placeholderTextColor="#94A3B8"
              value={recipientName}
              onChangeText={setRecipientName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Recipient's Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 08060588718"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={recipientPhone}
              onChangeText={setRecipientPhone}
            />
          </View>
        </View>

        {/* Package Details */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardHeaderTitle}>📦 Package Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Package Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Blue HP Laptop with its charger in a bag"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={packageDescription}
              onChangeText={setPackageDescription}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Instructions for Driver (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Please handle with care, screen is fragile"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={deliveryInstructions}
              onChangeText={setDeliveryInstructions}
            />
          </View>
        </View>

        {/* Pricing & Checkout Summary */}
        <View style={styles.checkoutFooter}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total Fee:</Text>
            <Text style={styles.priceValue}>₦{getPrice().toLocaleString()}.00</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              isSubmitting && styles.submitBtnDisabled,
              !isAuthenticated && styles.submitBtnGuest
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={16} color="#FFF" />
                <Text style={styles.submitBtnText}>
                  {isAuthenticated ? 'Pay Online & Book Errand' : 'Log In to Place Order'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.securedNotice}>
            <Ionicons name="shield-checkmark" size={14} color="#94A3B8" />
            <Text style={styles.securedNoticeText}>Payments processed securely by Paystack</Text>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.pagePadding,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: 8,
    color: COLORS.onBackground,
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    paddingBottom: 40,
  },
  introSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: 16,
    borderRadius: SHAPES.roundedCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  packageIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(230, 46, 45, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.onBackground,
    fontFamily: 'Outfit',
  },
  introDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 2,
    fontFamily: 'Inter',
  },
  guestBlock: {
    backgroundColor: '#EEF2F6',
    borderRadius: SHAPES.roundedCard,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DDE5F0',
    marginBottom: 20,
    ...SHADOWS.appCard,
  },
  lockIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1B4B',
    fontFamily: 'Outfit',
  },
  guestDesc: {
    fontSize: 12.5,
    color: '#4B5563',
    lineHeight: 18,
    marginTop: 2,
    fontFamily: 'Inter',
  },
  guestLoginBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    ...SHADOWS.appCard,
  },
  guestLoginBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  errorBanner: {
    backgroundColor: '#FFEBE9',
    borderColor: '#FFD3D1',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#D1242F',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  campusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: 14,
    borderRadius: SHAPES.roundedDefault,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 20,
    gap: 8,
  },
  campusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    fontFamily: 'Inter',
  },
  campusValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.onBackground,
    fontFamily: 'Inter',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitleLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#94A3B8',
    fontFamily: 'Inter',
    letterSpacing: 0.8,
  },
  sizeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  sizeCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 110,
    ...SHADOWS.appCard,
  },
  sizeCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(230, 46, 45, 0.04)',
  },
  sizeCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onBackground,
    fontFamily: 'Outfit',
  },
  sizeCardDesc: {
    fontSize: 9.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  sizeCardPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 8,
    fontFamily: 'Outfit',
  },
  sizeTextActive: {
    color: COLORS.primary,
  },
  sizePriceActive: {
    color: COLORS.primary,
  },
  cardContainer: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 18,
    marginBottom: 20,
    gap: 14,
    ...SHADOWS.appCard,
  },
  cardHeaderTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.onBackground,
    fontFamily: 'Outfit',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    paddingBottom: 8,
    marginBottom: 2,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    fontFamily: 'Inter',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: COLORS.onBackground,
    fontSize: 13.5,
    fontFamily: 'Inter',
  },
  textArea: {
    height: 70,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  checkoutFooter: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 18,
    gap: 12,
    ...SHADOWS.appCard,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.onBackground,
    fontFamily: 'Outfit',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
    fontFamily: 'Outfit',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...SHADOWS.appCard,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnGuest: {
    backgroundColor: '#4F46E5',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter',
  },
  securedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  securedNoticeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'Inter',
  },
});
