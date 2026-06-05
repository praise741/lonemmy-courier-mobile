import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, FlatList,
  Alert, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

interface PaginatedResponse {
  data: UserItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const ROLES = ['ALL', 'CUSTOMER', 'VENDOR', 'COURIER', 'ADMIN'];

const statusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE': return '#10B981';
    case 'SUSPENDED': return '#F59E0B';
    case 'INACTIVE': return COLORS.outline;
    default: return COLORS.outline;
  }
};

export default function AdminUsers() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const pageSize = 15;

  const { data, isLoading, isRefetching, error, refetch } = useQuery<PaginatedResponse>({
    queryKey: ['adminUsers', page, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      const res = await api.get(`/admin/users?${params.toString()}`);
      return res.data;
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await api.patch(`/admin/users/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update user status.', 'error');
    },
  });

  const handleToggleStatus = (item: UserItem) => {
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert(
      'Update User Status',
      `${nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} user "${item.name}"?`,
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

  const renderItem = ({ item }: { item: UserItem }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[TYPOGRAPHY.subtitle, styles.cardName]} numberOfLines={1}>{item.name}</Text>
          <Text style={[TYPOGRAPHY.muted, styles.cardSub]} numberOfLines={1}>{item.email}</Text>
          <View style={styles.cardMeta}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{item.role}</Text>
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

  const users = data?.data ?? [];
  const meta = data?.meta;

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(admin)/dashboard')}>
          <Ionicons name="arrow-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Users</Text>
      </View>

      {/* Role Filter Pills */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ROLES}
          keyExtractor={(r) => r}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item: role }) => (
            <TouchableOpacity
              style={[styles.filterPill, roleFilter === role && styles.filterPillActive]}
              onPress={() => { setRoleFilter(role); setPage(1); }}
            >
              <Text style={[styles.filterPillText, roleFilter === role && styles.filterPillTextActive]}>
                {role === 'ALL' ? 'All' : role.charAt(0) + role.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading users...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorIconBg}>
            <Ionicons name="warning" $$$ />
          </View>
          <Text style={[TYPOGRAPHY.subtitle, styles.errorTitle]}>Failed to load users</Text>
          <Text style={[TYPOGRAPHY.body, styles.errorText]}>
            {(error as any)?.response?.data?.message || 'Check your connection and try again.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={[TYPOGRAPHY.subtitle, styles.retryButtonText]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 44 }}>👤</Text>
          <Text style={[TYPOGRAPHY.subtitle, styles.emptyTitle]}>No users found</Text>
          <Text style={[TYPOGRAPHY.muted, styles.emptyText]}>
            {roleFilter !== 'ALL' ? `No ${roleFilter.toLowerCase()} users registered yet.` : 'No registered users yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[COLORS.primary]} />
          }
        />
      )}

      {/* Pagination */}
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
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.secondary,
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
  roleBadge: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
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
});
