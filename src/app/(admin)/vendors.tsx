import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, FlatList,
  Alert, ActivityIndicator, RefreshControl, TextInput,
  Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface VendorItem {
  id: string;
  businessName: string;
  types: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

interface PaginatedResponse {
  data: VendorItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const VENDOR_TYPES = ['FOOD', 'SHOP'];

const statusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE': return '#10B981';
    case 'SUSPENDED': return '#F59E0B';
    case 'INACTIVE': return COLORS.outline;
    default: return COLORS.outline;
  }
};

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function AdminVendors() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const pageSize = 15;

  // Add vendor form state
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formBusinessName, setFormBusinessName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formTypes, setFormTypes] = useState<string[]>(['FOOD']);

  const { data, isLoading, isRefetching, error, refetch } = useQuery<PaginatedResponse>({
    queryKey: ['adminVendors', page],
    queryFn: async () => {
      const res = await api.get(`/admin/vendors?page=${page}&pageSize=${pageSize}`);
      return res.data;
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await api.patch(`/admin/vendors/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminVendors'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update vendor status.', 'error');
    },
  });

  const addVendorMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await api.post('/admin/vendors', payload);
    },
    onSuccess: () => {
      showToast('Vendor created successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminVendors'] });
      resetForm();
      setShowAddModal(false);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to create vendor.', 'error');
    },
  });

  const resetForm = () => {
    setFormEmail('');
    setFormPassword('');
    setFormName('');
    setFormBusinessName('');
    setFormAddress('');
    setFormTypes(['FOOD']);
  };

  const handleToggleStatus = (item: VendorItem) => {
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert(
      'Update Vendor Status',
      `${nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} vendor "${item.businessName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate',
          style: nextStatus === 'ACTIVE' ? 'default' : 'destructive',
          onPress: () => toggleStatusMutation.mutate({ id: item.id, newStatus: nextStatus }),
        },
      ],
    );
  };

  const handleToggleType = (type: string) => {
    setFormTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleAddVendor = () => {
    if (!formEmail.trim()) { Alert.alert('Validation', 'Email is required.'); return; }
    if (!validateEmail(formEmail.trim())) { Alert.alert('Validation', 'Please enter a valid email address.'); return; }
    if (!formPassword.trim() || formPassword.length < 6) { Alert.alert('Validation', 'Password must be at least 6 characters.'); return; }
    if (!formName.trim()) { Alert.alert('Validation', 'Owner name is required.'); return; }
    if (!formBusinessName.trim()) { Alert.alert('Validation', 'Business name is required.'); return; }
    if (!formAddress.trim()) { Alert.alert('Validation', 'Address is required.'); return; }
    if (formTypes.length === 0) { Alert.alert('Validation', 'Select at least one vendor type.'); return; }

    addVendorMutation.mutate({
      email: formEmail.trim(),
      password: formPassword,
      name: formName.trim(),
      businessName: formBusinessName.trim(),
      address: formAddress.trim(),
      types: formTypes,
    });
  };

  const renderItem = ({ item }: { item: VendorItem }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Ionicons name="storefront" size={20} color={COLORS.secondary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[TYPOGRAPHY.subtitle, styles.cardName]} numberOfLines={1}>{item.businessName}</Text>
          <View style={styles.cardMeta}>
            <View style={styles.typeRow}>
              {item.types?.map((t) => (
                <View key={t} style={styles.typeBadge}>
                  <Text style={styles.typeText}>{t === 'FOOD' ? 'Food' : 'Shop'}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
            <Text style={[TYPOGRAPHY.labelMini, { color: statusColor(item.status) }]}>{item.status}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.statusBtn, item.status === 'ACTIVE' ? styles.statusBtnActive : styles.statusBtnInactive]}
        onPress={() => handleToggleStatus(item)}
        disabled={toggleStatusMutation.isPending}
      >
        <Ionicons
          name={item.status === 'ACTIVE' ? 'checkmark-circle' : 'warning'}
          size={14}
          color={item.status === 'ACTIVE' ? COLORS.onPrimary : COLORS.primary}
        />
      </TouchableOpacity>
    </View>
  );

  const vendors = data?.data ?? [];
  const meta = data?.meta;

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(admin)/dashboard')}>
          <Ionicons name="arrow-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Vendors</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading vendors...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorIconBg}>
            <Ionicons name="warning" $$$ />
          </View>
          <Text style={[TYPOGRAPHY.subtitle, styles.errorTitle]}>Failed to load vendors</Text>
          <Text style={[TYPOGRAPHY.body, styles.errorText]}>
            {(error as any)?.response?.data?.message || 'Check your connection and try again.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={[TYPOGRAPHY.subtitle, styles.retryButtonText]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : vendors.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 44 }}>🛍️</Text>
          <Text style={[TYPOGRAPHY.subtitle, styles.emptyTitle]}>No vendors found</Text>
          <Text style={[TYPOGRAPHY.muted, styles.emptyText]}>Add a vendor to get started.</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Text style={[TYPOGRAPHY.subtitle, styles.addBtnText]}>Add Vendor</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={vendors}
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

      {vendors.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" $$$ />
        </TouchableOpacity>
      )}

      {/* Add Vendor Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => { setShowAddModal(false); resetForm(); }}>
              <Ionicons name="chevron-back" $$$ />
            </TouchableOpacity>
            <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Add Vendor</Text>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.formContent}>
              <View style={styles.formGroup}>
                <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>EMAIL</Text>
                <TextInput
                  style={[TYPOGRAPHY.body, styles.textInput]}
                  placeholder="vendor@example.com"
                  placeholderTextColor={COLORS.outline}
                  value={formEmail}
                  onChangeText={setFormEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>PASSWORD</Text>
                <TextInput
                  style={[TYPOGRAPHY.body, styles.textInput]}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={COLORS.outline}
                  value={formPassword}
                  onChangeText={setFormPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>OWNER NAME</Text>
                <TextInput
                  style={[TYPOGRAPHY.body, styles.textInput]}
                  placeholder="Full name"
                  placeholderTextColor={COLORS.outline}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>BUSINESS NAME</Text>
                <TextInput
                  style={[TYPOGRAPHY.body, styles.textInput]}
                  placeholder="e.g. Campus Bites"
                  placeholderTextColor={COLORS.outline}
                  value={formBusinessName}
                  onChangeText={setFormBusinessName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>ADDRESS</Text>
                <TextInput
                  style={[TYPOGRAPHY.body, styles.textInput]}
                  placeholder="Campus location address"
                  placeholderTextColor={COLORS.outline}
                  value={formAddress}
                  onChangeText={setFormAddress}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>VENDOR TYPES</Text>
                <View style={styles.typeSelection}>
                  {VENDOR_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeSelectPill,
                        formTypes.includes(type) && styles.typeSelectPillActive,
                      ]}
                      onPress={() => handleToggleType(type)}
                    >
                      <Ionicons
                        name={type === 'FOOD' ? 'fast-food' : 'storefront'}
                        size={14}
                        color={formTypes.includes(type) ? COLORS.onPrimary : COLORS.secondary}
                      />
                      <Text style={[
                        styles.typeSelectText,
                        formTypes.includes(type) && styles.typeSelectTextActive,
                      ]}>
                        {type === 'FOOD' ? 'Food' : 'Shop'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAddVendor}
                disabled={addVendorMutation.isPending}
              >
                {addVendorMutation.isPending ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <>
                    <Text style={[TYPOGRAPHY.subtitle, styles.saveBtnText]}>Create Vendor</Text>
                    <Ionicons name="add" $$$ />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
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
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: SHAPES.roundedMd,
    ...SHADOWS.appCard,
  },
  addBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.appCard,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.gutter,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  typeBadge: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBtnActive: {
    backgroundColor: COLORS.primary,
  },
  statusBtnInactive: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: SHAPES.roundedShell,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 999,
  },
  // Modal styles
  modalSafe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  formContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackMd,
    paddingBottom: 40,
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
  typeSelection: {
    flexDirection: 'row',
    gap: 10,
  },
  typeSelectPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedMd,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  typeSelectPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeSelectText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  typeSelectTextActive: {
    color: COLORS.onPrimary,
  },
  footer: {
    backgroundColor: COLORS.surfaceContainerLowest,
    paddingHorizontal: SPACING.pagePadding,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
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
