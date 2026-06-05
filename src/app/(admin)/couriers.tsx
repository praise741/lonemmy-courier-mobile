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

interface CourierItem {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

interface PaginatedResponse {
  data: CourierItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const statusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE': return '#10B981';
    case 'SUSPENDED': return '#F59E0B';
    case 'INACTIVE': return COLORS.outline;
    default: return COLORS.outline;
  }
};

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function AdminCouriers() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const pageSize = 15;

  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');

  const { data, isLoading, isRefetching, error, refetch } = useQuery<PaginatedResponse>({
    queryKey: ['adminCouriers', page],
    queryFn: async () => {
      const res = await api.get(`/admin/couriers?page=${page}&pageSize=${pageSize}`);
      return res.data;
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await api.patch(`/admin/couriers/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCouriers'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update courier status.', 'error');
    },
  });

  const addCourierMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await api.post('/admin/couriers', payload);
    },
    onSuccess: () => {
      showToast('Courier created successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminCouriers'] });
      setFormEmail('');
      setFormPassword('');
      setFormName('');
      setShowAddModal(false);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to create courier.', 'error');
    },
  });

  const handleToggleStatus = (item: CourierItem) => {
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert(
      'Update Courier Status',
      `${nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} courier "${item.name}"?`,
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

  const handleAddCourier = () => {
    if (!formEmail.trim()) { Alert.alert('Validation', 'Email is required.'); return; }
    if (!validateEmail(formEmail.trim())) { Alert.alert('Validation', 'Please enter a valid email address.'); return; }
    if (!formPassword.trim() || formPassword.length < 6) { Alert.alert('Validation', 'Password must be at least 6 characters.'); return; }
    if (!formName.trim()) { Alert.alert('Validation', 'Name is required.'); return; }

    addCourierMutation.mutate({
      email: formEmail.trim(),
      password: formPassword,
      name: formName.trim(),
    });
  };

  const renderItem = ({ item }: { item: CourierItem }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Ionicons name="car" $$$ />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[TYPOGRAPHY.subtitle, styles.cardName]} numberOfLines={1}>{item.name}</Text>
          <Text style={[TYPOGRAPHY.muted, styles.cardSub]} numberOfLines={1}>{item.email}</Text>
          <View style={styles.cardMeta}>
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

  const couriers = data?.data ?? [];
  const meta = data?.meta;

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(admin)/dashboard')}>
          <Ionicons name="arrow-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Couriers</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading couriers...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorIconBg}>
            <Ionicons name="warning" $$$ />
          </View>
          <Text style={[TYPOGRAPHY.subtitle, styles.errorTitle]}>Failed to load couriers</Text>
          <Text style={[TYPOGRAPHY.body, styles.errorText]}>
            {(error as any)?.response?.data?.message || 'Check your connection and try again.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={[TYPOGRAPHY.subtitle, styles.retryButtonText]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : couriers.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 44 }}>🚚</Text>
          <Text style={[TYPOGRAPHY.subtitle, styles.emptyTitle]}>No couriers found</Text>
          <Text style={[TYPOGRAPHY.muted, styles.emptyText]}>Add a courier to get started.</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Text style={[TYPOGRAPHY.subtitle, styles.addBtnText]}>Add Courier</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={couriers}
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

      {couriers.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" $$$ />
        </TouchableOpacity>
      )}

      {/* Add Courier Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => { setShowAddModal(false); setFormEmail(''); setFormPassword(''); setFormName(''); }}>
              <Ionicons name="chevron-back" $$$ />
            </TouchableOpacity>
            <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Add Courier</Text>
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
                  placeholder="courier@example.com"
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
                <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>FULL NAME</Text>
                <TextInput
                  style={[TYPOGRAPHY.body, styles.textInput]}
                  placeholder="Full name"
                  placeholderTextColor={COLORS.outline}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAddCourier}
                disabled={addCourierMutation.isPending}
              >
                {addCourierMutation.isPending ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <>
                    <Text style={[TYPOGRAPHY.subtitle, styles.saveBtnText]}>Create Courier</Text>
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
  cardSub: {
    color: COLORS.secondary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
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
