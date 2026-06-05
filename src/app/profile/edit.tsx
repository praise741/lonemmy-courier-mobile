import React, { useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
}

interface SavedAddress {
  id: string;
  locationId: string;
  blockId?: string | null;
  roomId?: string | null;
  roomNumber: string;
  label?: string | null;
  isDefault: boolean;
  location?: { name: string } | null;
}

interface CampusLocation {
  id: string;
  name: string;
}

export default function EditProfile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const { showToast } = useToast();

  // Profile Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Address creation states
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [locId, setLocId] = useState('');
  const [roomNum, setRoomNum] = useState('');
  const [label, setLabel] = useState('');

  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);

  React.useEffect(() => {
    const getCampus = async () => {
      try {
        const stored = await AsyncStorage.getItem('lonemmy-selected-campus');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSelectedCampusId(parsed?.id || null);
        }
      } catch (e) {
        console.error(e);
      }
    };
    getCampus();
  }, []);

  // Password change states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 1. Fetch User Profile
  const { data: profile, isLoading: isLoadingProfile } = useQuery<UserProfile>({
    queryKey: ['profile-me'],
    queryFn: async () => {
      const response = await api.get('/auth/me');
      const data = response.data?.data ?? response.data;
      if (data) {
        setName(data.name);
        setPhone(data.phone || '');
      }
      return data;
    },
  });

  // 2. Fetch Saved Addresses
  const { data: addresses = [], isLoading: isLoadingAddresses } = useQuery<SavedAddress[]>({
    queryKey: ['profile-addresses'],
    queryFn: async () => {
      const response = await api.get('/addresses');
      return response.data?.data ?? response.data ?? [];
    },
  });

  // 3. Fetch Campus Locations
  const { data: locations = [] } = useQuery<CampusLocation[]>({
    queryKey: ['locations-profile', selectedCampusId],
    queryFn: async () => {
      const response = await api.get('/locations', {
        params: selectedCampusId ? { campusId: selectedCampusId } : undefined,
      });
      return response.data?.data ?? response.data ?? [];
    },
    enabled: isAddingAddress,
  });

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { name: string; phone?: string }) => {
      const response = await api.patch('/auth/profile', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-me'] });
      // Invalidate auth context if user is logged in
      showToast('Profile saved successfully', 'success');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Could not update profile.', 'error');
    },
  });

  const createAddressMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post('/addresses', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-addresses'] });
      setIsAddingAddress(false);
      setLocId('');
      setRoomNum('');
      setLabel('');
      showToast('Address saved to your profile', 'success');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Could not save address.', 'error');
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      await api.delete(`/addresses/${addressId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-addresses'] });
      showToast('Address removed successfully', 'success');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Could not delete address.', 'error');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      const response = await api.post('/auth/change-password', payload);
      return response.data;
    },
    onSuccess: () => {
      showToast('Password updated successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Could not change password.', 'error');
    },
  });

  const handleSaveProfile = () => {
    if (!name.trim()) {
      Alert.alert('Incomplete Profile', 'Name field is required.');
      return;
    }
    updateProfileMutation.mutate({ name, phone: phone || undefined });
  };

  const handleCreateAddress = () => {
    if (!locId || !roomNum) {
      Alert.alert('Incomplete Form', 'Please choose a location and room number.');
      return;
    }
    createAddressMutation.mutate({
      locationId: locId,
      roomNumber: roomNum,
      label: label || undefined,
      isDefault: addresses.length === 0,
    });
  };

  const handleChangePassword = () => {
    if (!currentPassword) {
      Alert.alert('Missing Field', 'Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Weak Password', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'New password and confirmation do not match.');
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleBack = () => {
    const role = auth.user?.role;
    switch (role) {
      case 'CUSTOMER':
        router.replace('/(customer)/home');
        break;
      case 'VENDOR':
        router.replace('/(vendor)/dashboard');
        break;
      case 'COURIER':
        router.replace('/(courier)/dashboard');
        break;
      case 'ADMIN':
        router.replace('/(admin)/dashboard');
        break;
      default:
        router.replace('/(customer)/home');
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>My Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {isLoadingProfile ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>Loading profile...</Text>
          </View>
        ) : (
          <>
            {/* Centered Avatar Picker Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {(name || 'Customer').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cameraOverlay}
                  onPress={() => showToast('Accessing device camera...', 'info')}
                >
                  <Ionicons name="camera" $$$ />
                </TouchableOpacity>
              </View>
            </View>

            {/* Profile Form Card */}
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
                />
              </View>

              {/* Email (Read Only) */}
              <View style={styles.inputGroup}>
                <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>EMAIL (READ ONLY)</Text>
                <View style={styles.disabledInputWrapper}>
                  <Ionicons name="mail" $$$ />
                  <TextInput
                    style={[TYPOGRAPHY.body, styles.textInputDisabled]}
                    value={profile?.email || 'sarah.adams@jabu.edu.ng'}
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
                  />
                </View>
              </View>

              {/* Update Button */}
              <TouchableOpacity
                style={[styles.saveBtn, updateProfileMutation.isPending && styles.disabledBtn]}
                onPress={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <>
                    <Text style={styles.saveBtnText}>Save Profile Changes</Text>
                    <Ionicons name="checkmark-circle" $$$ />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Address CRUD Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Saved Hostel Addresses</Text>
                <TouchableOpacity onPress={() => setIsAddingAddress(!isAddingAddress)}>
                  <Text style={[TYPOGRAPHY.muted, styles.addLink]}>
                    {isAddingAddress ? 'Cancel' : 'Add New'}
                  </Text>
                </TouchableOpacity>
              </View>

              {isAddingAddress && (
                <View style={styles.addressForm}>
                  {/* Select Location */}
                  <Text style={[TYPOGRAPHY.labelMini, styles.formLabel]}>CAMPUS LOCATION</Text>
                  <View style={styles.pickerReplacement}>
                    {locations.map((loc) => (
                      <TouchableOpacity
                        key={loc.id}
                        style={[
                          styles.pickerChoice,
                          locId === loc.id && styles.pickerChoiceActive,
                        ]}
                        onPress={() => setLocId(loc.id)}
                      >
                        <Text style={[styles.pickerChoiceText, locId === loc.id && styles.pickerChoiceTextActive]}>
                          🏢 {loc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Room Number */}
                  <Text style={[TYPOGRAPHY.labelMini, styles.formLabel, { marginTop: 8 }]}>ROOM NUMBER</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Rm 308"
                    value={roomNum}
                    onChangeText={setRoomNum}
                  />

                  {/* Label */}
                  <Text style={[TYPOGRAPHY.labelMini, styles.formLabel, { marginTop: 8 }]}>ADDRESS LABEL / NAME</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Female Hostel A, Block 4"
                    value={label}
                    onChangeText={setLabel}
                  />

                  <TouchableOpacity
                    style={styles.createAddressBtn}
                    onPress={handleCreateAddress}
                    disabled={createAddressMutation.isPending}
                  >
                    {createAddressMutation.isPending ? (
                      <ActivityIndicator size="small" color={COLORS.onPrimary} />
                    ) : (
                      <Text style={styles.createAddressBtnText}>Save Hostel Address</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.formDivider} />
                </View>
              )}

              {/* Saved Address List */}
              {isLoadingAddresses ? (
                <ActivityIndicator size="small" color={COLORS.secondary} />
              ) : addresses.length === 0 ? (
                <Text style={[TYPOGRAPHY.muted, styles.emptyText]}>
                  No saved addresses. Add a hostel address to enable faster deliveries.
                </Text>
              ) : (
                <View style={styles.addressList}>
                  {addresses.map((addr) => (
                    <View key={addr.id} style={styles.addressCard}>
                      <View style={styles.addressLeft}>
                        <Text style={{ fontSize: 18 }}>🏢</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[TYPOGRAPHY.body, styles.addrLabel]}>
                            {addr.label || 'Saved Location'}
                          </Text>
                          <Text style={[TYPOGRAPHY.muted, styles.addrSub]}>
                            Room {addr.roomNumber} ({addr.location?.name || 'Campus location'})
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => {
                          Alert.alert('Delete Address 🗑️', 'Remove this saved hostel address?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteAddressMutation.mutate(addr.id) },
                          ]);
                        }}
                      >
                        <Ionicons name="add" $$$ />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Logout Option */}
            <TouchableOpacity style={styles.logoutBtn} onPress={() => auth.logout()}>
              <Text style={styles.logoutBtnText}>Logout Account</Text>
              <Ionicons name="chevron-forward" $$$ />
            </TouchableOpacity>

            {/* Change Password (Collapsible) */}
            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.passwordToggleHeader}
                onPress={() => setIsChangingPassword(!isChangingPassword)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.stackSm }}>
                  <Ionicons name="lock-closed" $$$ />
                  <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" $$$ />
              </TouchableOpacity>

              {isChangingPassword && (
                <View style={styles.passwordForm}>
                  <View style={styles.inputGroup}>
                    <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>CURRENT PASSWORD</Text>
                    <TextInput
                      style={[TYPOGRAPHY.body, styles.textInput]}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Enter current password"
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>NEW PASSWORD</Text>
                    <TextInput
                      style={[TYPOGRAPHY.body, styles.textInput]}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="At least 6 characters"
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>CONFIRM NEW PASSWORD</Text>
                    <TextInput
                      style={[TYPOGRAPHY.body, styles.textInput]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Re-enter new password"
                      secureTextEntry
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.changePasswordBtn, changePasswordMutation.isPending && styles.disabledBtn]}
                    onPress={handleChangePassword}
                    disabled={changePasswordMutation.isPending}
                  >
                    {changePasswordMutation.isPending ? (
                      <ActivityIndicator size="small" color={COLORS.onPrimary} />
                    ) : (
                      <Text style={styles.changePasswordBtnText}>Update Password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
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
    gap: SPACING.stackLg,
    paddingBottom: 60,
  },
  centerContainer: {
    paddingVertical: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  avatarWrapper: {
    position: 'relative',
    width: 96,
    height: 96,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surfaceContainerHighest,
    borderWidth: 2,
    borderColor: COLORS.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surfaceContainerLowest,
    ...SHADOWS.appCard,
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
  },
  disabledInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    opacity: 0.7,
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
  passwordToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordForm: {
    gap: SPACING.stackMd,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    marginTop: 8,
  },
  changePasswordBtn: {
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: SHAPES.roundedLg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    ...SHADOWS.appCard,
  },
  changePasswordBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom: 8,
  },
  addLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingVertical: 12,
  },
  addressList: {
    gap: SPACING.gutter,
  },
  addressCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.gutter,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressLeft: {
    flexDirection: 'row',
    gap: SPACING.gutter,
    alignItems: 'center',
    flex: 1,
  },
  addrLabel: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  addrSub: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFEBE9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressForm: {
    gap: SPACING.gutter,
  },
  formLabel: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  pickerReplacement: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pickerChoice: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedMd,
  },
  pickerChoiceActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primary,
  },
  pickerChoiceText: {
    color: COLORS.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  pickerChoiceTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  formInput: {
    height: 44,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedMd,
    paddingHorizontal: 14,
    color: COLORS.onSurface,
  },
  createAddressBtn: {
    backgroundColor: COLORS.secondary,
    height: 44,
    borderRadius: SHAPES.roundedMd,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    ...SHADOWS.appCard,
  },
  createAddressBtnText: {
    color: COLORS.onSecondary,
    fontWeight: '700',
  },
  formDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 10,
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
