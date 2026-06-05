import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const COURIER_PROFILE_KEY = 'courier-profile';

type VehicleType = 'BICYCLE' | 'MOTORCYCLE' | 'CAR';
type IDVerificationStatus = 'VERIFIED' | 'PENDING' | 'NOT_VERIFIED';

interface CourierProfileLocal {
  vehicleType: VehicleType;
  bankAccountNumber: string;
  bankName: string;
  idVerificationStatus: IDVerificationStatus;
}

const VEHICLE_TYPES: { key: VehicleType; label: string; icon: string }[] = [
  { key: 'BICYCLE', label: 'Bicycle', icon: '🚲' },
  { key: 'MOTORCYCLE', label: 'Motorcycle', icon: '🏍️' },
  { key: 'CAR', label: 'Car', icon: '🚗' },
];

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
}

export default function CourierProfile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const { showToast } = useToast();

  // Profile form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Courier-specific local state (AsyncStorage fallback)
  const [vehicleType, setVehicleType] = useState<VehicleType>('MOTORCYCLE');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [idVerificationStatus, setIdVerificationStatus] = useState<IDVerificationStatus>('NOT_VERIFIED');
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);

  // Load courier-specific data from AsyncStorage
  useEffect(() => {
    const loadCourierProfile = async () => {
      try {
        const raw = await AsyncStorage.getItem(COURIER_PROFILE_KEY);
        if (raw) {
          const parsed: Partial<CourierProfileLocal> = JSON.parse(raw);
          if (parsed.vehicleType) setVehicleType(parsed.vehicleType);
          if (parsed.bankAccountNumber) setBankAccountNumber(parsed.bankAccountNumber);
          if (parsed.bankName) setBankName(parsed.bankName);
          if (parsed.idVerificationStatus) setIdVerificationStatus(parsed.idVerificationStatus);
        }
      } catch (err) {
        console.error('Error loading courier profile from AsyncStorage:', err);
      } finally {
        setIsLoadingLocal(false);
      }
    };
    loadCourierProfile();
  }, []);

  // Persist courier-specific data to AsyncStorage
  const saveCourierLocalProfile = async (partial: Partial<CourierProfileLocal>) => {
    try {
      const current: CourierProfileLocal = {
        vehicleType,
        bankAccountNumber,
        bankName,
        idVerificationStatus,
        ...partial,
      };
      await AsyncStorage.setItem(COURIER_PROFILE_KEY, JSON.stringify(current));
    } catch (err) {
      console.error('Error saving courier profile to AsyncStorage:', err);
    }
  };

  // Fetch user profile from backend
  const { data: profile, isLoading: isLoadingProfile } = useQuery<UserProfile>({
    queryKey: ['courier-profile-me'],
    queryFn: async () => {
      const response = await api.get('/auth/me');
      const data = response.data?.data ?? response.data;
      if (data) {
        setName(data.name || '');
        setPhone(data.phone || '');
      }
      return data;
    },
  });

  // Mutation: update name/phone via PATCH /auth/profile
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { name: string; phone?: string }) => {
      const response = await api.patch('/auth/profile', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courier-profile-me'] });
      showToast('Your profile details have been updated.', 'success');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Could not update profile.', 'error');
    },
  });

  const handleSaveProfile = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Name field is required.');
      return;
    }
    updateProfileMutation.mutate({ name, phone: phone || undefined });
  };

  const handleSaveVehicleType = (type: VehicleType) => {
    setVehicleType(type);
    saveCourierLocalProfile({ vehicleType: type });
  };

  const handleSaveBankDetails = () => {
    saveCourierLocalProfile({ bankAccountNumber, bankName });
    showToast('Your payout bank details have been saved locally.', 'success');
  };

  // ID status badge styling
  const getIDStatusStyle = (status: IDVerificationStatus) => {
    switch (status) {
      case 'VERIFIED':
        return { bg: '#E6F9ED', text: '#0D7D3E', label: 'Verified ✓' };
      case 'PENDING':
        return { bg: '#FFF3E0', text: '#E67E00', label: 'Pending Review' };
      case 'NOT_VERIFIED':
      default:
        return { bg: '#FFEBE9', text: '#D1242F', label: 'Not Verified' };
    }
  };

  if (isLoadingProfile || isLoadingLocal) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const idStatusTheme = getIDStatusStyle(idVerificationStatus);

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(courier)/dashboard')}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Courier Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(name || auth.user?.name || 'Courier').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={[TYPOGRAPHY.subtitle, styles.avatarName]}>
            {name || auth.user?.name || 'Courier'}
          </Text>
          <Text style={[TYPOGRAPHY.muted, styles.avatarRole]}>Campus Courier</Text>
        </View>

        {/* Profile Details Card */}
        <View style={styles.sectionCard}>
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Profile Details</Text>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>FULL NAME</Text>
            <TextInput
              style={[TYPOGRAPHY.body, styles.textInput]}
              value={name}
              onChangeText={setName}
              placeholder="Enter full name"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          {/* Email (Read Only) */}
          <View style={styles.inputGroup}>
            <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>EMAIL (READ ONLY)</Text>
            <View style={styles.disabledInputWrapper}>
              <Ionicons name="mail" $$$ />
              <TextInput
                style={[TYPOGRAPHY.body, styles.textInputDisabled]}
                value={profile?.email || auth.user?.email || ''}
                editable={false}
              />
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.inputGroup}>
            <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>PHONE NUMBER</Text>
            <View style={styles.phoneInputWrapper}>
              <Ionicons name="call" $$$ />
              <TextInput
                style={[TYPOGRAPHY.body, styles.phoneInput]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Save Profile Button */}
          <TouchableOpacity
            style={[styles.saveBtn, updateProfileMutation.isPending && styles.disabledBtn]}
            onPress={handleSaveProfile}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.onPrimary} />
            ) : (
              <>
                <Text style={styles.saveBtnText}>Save Profile Details</Text>
                <Ionicons name="checkmark-circle" $$$ />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Vehicle Type Card */}
        <View style={styles.sectionCard}>
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Vehicle Type</Text>
          <Text style={[TYPOGRAPHY.muted, { marginTop: -8 }]}>Select your primary delivery vehicle</Text>

          <View style={styles.vehicleOptions}>
            {VEHICLE_TYPES.map((v) => (
              <TouchableOpacity
                key={v.key}
                style={[
                  styles.vehicleChip,
                  vehicleType === v.key && styles.vehicleChipActive,
                ]}
                onPress={() => handleSaveVehicleType(v.key)}
              >
                <Text style={styles.vehicleIcon}>{v.icon}</Text>
                <Text
                  style={[
                    styles.vehicleChipLabel,
                    vehicleType === v.key && styles.vehicleChipLabelActive,
                  ]}
                >
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bank Details Card */}
        <View style={styles.sectionCard}>
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Payout Bank Details</Text>
          <Text style={[TYPOGRAPHY.muted, { marginTop: -8 }]}>Where earnings are deposited</Text>

          <View style={styles.inputGroup}>
            <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>ACCOUNT NUMBER</Text>
            <TextInput
              style={[TYPOGRAPHY.body, styles.textInput]}
              value={bankAccountNumber}
              onChangeText={setBankAccountNumber}
              keyboardType="number-pad"
              placeholder="Enter account number"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>BANK NAME</Text>
            <TextInput
              style={[TYPOGRAPHY.body, styles.textInput]}
              value={bankName}
              onChangeText={setBankName}
              placeholder="Enter bank name (e.g. Access Bank)"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSaveBankDetails}>
            <Text style={styles.secondaryBtnText}>Save Bank Details</Text>
          </TouchableOpacity>
        </View>

        {/* ID Verification Status Card */}
        <View style={styles.sectionCard}>
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>ID Verification</Text>

          <View style={styles.verificationRow}>
            <View style={[styles.statusBadge, { backgroundColor: idStatusTheme.bg }]}>
              <Text style={[styles.statusBadgeText, { color: idStatusTheme.text }]}>
                {idStatusTheme.label}
              </Text>
            </View>
            {idVerificationStatus !== 'VERIFIED' && (
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={() => {
                  setIdVerificationStatus('PENDING');
                  saveCourierLocalProfile({ idVerificationStatus: 'PENDING' });
                  Alert.alert(
                    'Verification Submitted 📄',
                    'Your ID verification request has been submitted. Admin will review your documents shortly.'
                  );
                }}
              >
                <Text style={styles.verifyBtnText}>Start Verification</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[TYPOGRAPHY.muted, styles.verificationHint]}>
            {idVerificationStatus === 'VERIFIED'
              ? 'Your identity has been verified. You can accept all delivery tasks.'
              : idVerificationStatus === 'PENDING'
              ? 'Your verification is under review. This may take 1-2 business days.'
              : 'Verify your student/staff ID to unlock full delivery access.'}
          </Text>
        </View>

        {/* Logout Option */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => auth.logout()}>
          <Text style={styles.logoutBtnText}>Logout Account</Text>
          <Ionicons name="chevron-forward" $$$ />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    paddingVertical: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.pagePadding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surfaceContainerLowest,
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackLg,
    paddingBottom: 60,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 10,
    gap: SPACING.stackSm,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceContainerHighest,
    borderWidth: 2,
    borderColor: COLORS.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
  },
  avatarName: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  avatarRole: {
    color: COLORS.secondary,
  },
  sectionCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedXl,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
    gap: SPACING.stackMd,
  },
  sectionTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
    fontSize: 16,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    color: COLORS.onSurface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  disabledInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    opacity: 0.7,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  textInputDisabled: {
    flex: 1,
    color: COLORS.onSurfaceVariant,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  phoneInput: {
    flex: 1,
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
    marginTop: 8,
    ...SHADOWS.appCard,
  },
  saveBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  vehicleOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  vehicleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.surfaceContainerLow,
    gap: 6,
  },
  vehicleChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.errorContainer,
  },
  vehicleIcon: {
    fontSize: 22,
  },
  vehicleChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.outline,
  },
  vehicleChipLabelActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: COLORS.secondary,
    height: 46,
    borderRadius: SHAPES.roundedLg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    ...SHADOWS.appCard,
  },
  secondaryBtnText: {
    color: COLORS.onSecondary,
    fontWeight: '700',
  },
  verificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: SHAPES.roundedMd,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  verifyBtn: {
    backgroundColor: COLORS.errorContainer,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: SHAPES.roundedMd,
  },
  verifyBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  verificationHint: {
    color: COLORS.outline,
    fontSize: 11,
    lineHeight: 16,
    marginTop: -4,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFEBE9',
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: '#FFD6E7',
  },
  logoutBtnText: {
    color: '#D1242F',
    fontWeight: '800',
  },
});
