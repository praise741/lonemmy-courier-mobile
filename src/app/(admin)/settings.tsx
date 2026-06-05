import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface SettingsData {
  deliveryFees?: { food?: number; shop?: number };
  courierEarnings?: { percent?: number };
  commissionRate?: number;
  adminWhatsapp?: string;
}

export default function AdminSettings() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [foodDeliveryFee, setFoodDeliveryFee] = useState('');
  const [shopDeliveryFee, setShopDeliveryFee] = useState('');
  const [courierPercent, setCourierPercent] = useState('');
  const [commission, setCommission] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const { data: settings, isLoading, error, refetch } = useQuery<SettingsData>({
    queryKey: ['adminSettings'],
    queryFn: async () => {
      const res = await api.get('/admin/settings');
      return res.data?.data ?? res.data;
    },
  });

  useEffect(() => {
    if (settings) {
      setFoodDeliveryFee(String(settings.deliveryFees?.food ?? ''));
      setShopDeliveryFee(String(settings.deliveryFees?.shop ?? ''));
      setCourierPercent(String(settings.courierEarnings?.percent ?? ''));
      setCommission(String(settings.commissionRate ?? ''));
      setWhatsapp(settings.adminWhatsapp ?? '');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      payload.deliveryFees = {
        food: parseFloat(foodDeliveryFee) || 0,
        shop: parseFloat(shopDeliveryFee) || 0,
      };
      payload.courierEarnings = {
        percent: parseFloat(courierPercent) || 0,
      };
      payload.commissionRate = parseFloat(commission) || 0;
      payload.adminWhatsapp = whatsapp.trim();

      await api.patch('/admin/settings', payload);
    },
    onSuccess: () => {
      showToast('Platform settings updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update settings.', 'error');
    },
  });

  const handleSave = () => {
    if (!foodDeliveryFee.trim() || isNaN(parseFloat(foodDeliveryFee))) {
      Alert.alert('Validation', 'Enter a valid food delivery fee.');
      return;
    }
    if (!shopDeliveryFee.trim() || isNaN(parseFloat(shopDeliveryFee))) {
      Alert.alert('Validation', 'Enter a valid shop delivery fee.');
      return;
    }
    if (!courierPercent.trim() || isNaN(parseFloat(courierPercent))) {
      Alert.alert('Validation', 'Enter a valid courier earnings percentage.');
      return;
    }
    if (!commission.trim() || isNaN(parseFloat(commission))) {
      Alert.alert('Validation', 'Enter a valid commission rate.');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(admin)/dashboard')}>
          <Ionicons name="arrow-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Settings</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading settings...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorIconBg}>
            <Ionicons name="warning" $$$ />
          </View>
          <Text style={[TYPOGRAPHY.subtitle, styles.errorTitle]}>Failed to load settings</Text>
          <Text style={[TYPOGRAPHY.body, styles.errorText]}>
            {(error as any)?.response?.data?.message || 'Check your connection and try again.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={[TYPOGRAPHY.subtitle, styles.retryButtonText]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="fast-food" $$$ />
              <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Delivery Fees</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.formGroup}>
              <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>FOOD DELIVERY FEE (₦)</Text>
              <TextInput
                style={[TYPOGRAPHY.body, styles.textInput]}
                placeholder="200"
                placeholderTextColor={COLORS.outline}
                value={foodDeliveryFee}
                onChangeText={setFoodDeliveryFee}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>SHOP DELIVERY FEE (₦)</Text>
              <TextInput
                style={[TYPOGRAPHY.body, styles.textInput]}
                placeholder="500"
                placeholderTextColor={COLORS.outline}
                value={shopDeliveryFee}
                onChangeText={setShopDeliveryFee}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="car" $$$ />
              <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Courier Earnings</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.formGroup}>
              <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>COURIER PERCENTAGE (%)</Text>
              <TextInput
                style={[TYPOGRAPHY.body, styles.textInput]}
                placeholder="85"
                placeholderTextColor={COLORS.outline}
                value={courierPercent}
                onChangeText={setCourierPercent}
                keyboardType="numeric"
              />
              <Text style={[TYPOGRAPHY.muted, { color: COLORS.outline, marginTop: 4 }]}>
                Percentage of delivery fee paid to couriers
              </Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cash" $$$ />
              <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Platform Commission</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.formGroup}>
              <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>COMMISSION RATE (%)</Text>
              <TextInput
                style={[TYPOGRAPHY.body, styles.textInput]}
                placeholder="10"
                placeholderTextColor={COLORS.outline}
                value={commission}
                onChangeText={setCommission}
                keyboardType="numeric"
              />
              <Text style={[TYPOGRAPHY.muted, { color: COLORS.outline, marginTop: 4 }]}>
                Percentage commission on vendor orders
              </Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubble" $$$ />
              <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Admin Contact</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.formGroup}>
              <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>ADMIN WHATSAPP NUMBER</Text>
              <TextInput
                style={[TYPOGRAPHY.body, styles.textInput]}
                placeholder="+234..."
                placeholderTextColor={COLORS.outline}
                value={whatsapp}
                onChangeText={setWhatsapp}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.onPrimary} />
            ) : (
              <>
                <Text style={[TYPOGRAPHY.subtitle, styles.saveBtnText]}>Save Settings</Text>
                <Ionicons name="checkmark-circle" $$$ />
              </>
            )}
          </TouchableOpacity>
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
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackMd,
    paddingBottom: 60,
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
  sectionCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: SPACING.stackMd,
    ...SHADOWS.appCard,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  sectionTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedMd,
    paddingHorizontal: 16,
    height: 48,
    color: COLORS.onSurface,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: SHAPES.roundedLg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.stackSm,
    ...SHADOWS.appCard,
  },
  saveBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
});
