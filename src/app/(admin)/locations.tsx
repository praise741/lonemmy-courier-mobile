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

interface LocationItem {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface BlockItem {
  id: string;
  name: string;
  locationId?: string;
}

interface RoomItem {
  id: string;
  name: string;
  blockId?: string;
}

type ModalMode = 'none' | 'addLocation' | 'addBlock' | 'addRoom';

export default function AdminLocations() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [modalMode, setModalMode] = useState<ModalMode>('none');
  const [formName, setFormName] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);

  const { data: locationsData, isLoading, isRefetching, error, refetch } = useQuery<{ data: LocationItem[] }>({
    queryKey: ['adminLocations'],
    queryFn: async () => {
      const res = await api.get('/admin/locations');
      return res.data;
    },
  });

  const { data: blocksData } = useQuery<{ data: BlockItem[] }>({
    queryKey: ['adminBlocks', expandedLocation],
    queryFn: async () => {
      if (!expandedLocation) return { data: [] };
      const res = await api.get(`/admin/locations/${expandedLocation}/blocks`);
      return res.data;
    },
    enabled: !!expandedLocation,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await api.patch(`/admin/locations/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLocations'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update status.', 'error');
    },
  });

  const addLocationMutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      await api.post('/admin/locations', payload);
    },
    onSuccess: () => {
      showToast('Location added', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminLocations'] });
      setModalMode('none');
      setFormName('');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to add location.', 'error');
    },
  });

  const addBlockMutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      if (!selectedLocationId) return;
      await api.post(`/admin/locations/${selectedLocationId}/blocks`, payload);
    },
    onSuccess: () => {
      showToast('Block added', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminBlocks'] });
      setModalMode('none');
      setFormName('');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to add block.', 'error');
    },
  });

  const addRoomMutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      if (!selectedLocationId || !selectedBlockId) return;
      await api.post(`/admin/locations/${selectedLocationId}/blocks/${selectedBlockId}/rooms`, payload);
    },
    onSuccess: () => {
      showToast('Room added', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminBlocks'] });
      setModalMode('none');
      setFormName('');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to add room.', 'error');
    },
  });

  const handleSubmitForm = () => {
    if (!formName.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    const name = formName.trim();
    switch (modalMode) {
      case 'addLocation':
        addLocationMutation.mutate({ name });
        break;
      case 'addBlock':
        addBlockMutation.mutate({ name });
        break;
      case 'addRoom':
        addRoomMutation.mutate({ name });
        break;
    }
  };

  const handleToggleStatus = (item: LocationItem) => {
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert(
      'Update Status',
      `${nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate',
          onPress: () => toggleStatusMutation.mutate({ id: item.id, newStatus: nextStatus }),
        },
      ],
    );
  };

  const openModal = (mode: ModalMode, locationId?: string, blockId?: string) => {
    setModalMode(mode);
    setFormName('');
    setSelectedLocationId(locationId || null);
    setSelectedBlockId(blockId || null);
  };

  const locations = locationsData?.data ?? [];
  const blocks = blocksData?.data ?? [];

  const renderLocation = ({ item }: { item: LocationItem }) => {
    const isExpanded = expandedLocation === item.id;
    return (
      <View>
        <TouchableOpacity
          style={styles.locationCard}
          onPress={() => setExpandedLocation(isExpanded ? null : item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.locationLeft}>
            <View style={styles.avatar}>
              <Ionicons name="home" $$$ />
            </View>
            <View>
              <Text style={[TYPOGRAPHY.subtitle, styles.locationName]}>{item.name}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: item.status === 'ACTIVE' ? '#10B981' : COLORS.outline }]} />
                <Text style={[TYPOGRAPHY.labelMini, { color: item.status === 'ACTIVE' ? '#10B981' : COLORS.outline }]}>
                  {item.status}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.locationActions}>
            <TouchableOpacity
              style={styles.statusBtn}
              onPress={() => handleToggleStatus(item)}
              disabled={toggleStatusMutation.isPending}
            >
              <Ionicons
                name={item.status === 'ACTIVE' ? 'checkmark-circle' : 'warning'}
                size={16}
                color={item.status === 'ACTIVE' ? COLORS.primary : COLORS.outline}
              />
            </TouchableOpacity>
            <Ionicons
              name={isExpanded ? 'chevron-back' : 'chevron-forward'}
              size={16}
              color={COLORS.secondary}
              style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedSection}>
            <View style={styles.expandedHeader}>
              <Text style={[TYPOGRAPHY.labelMini, { color: COLORS.secondary }]}>BLOCKS</Text>
              <TouchableOpacity
                style={styles.addSmallBtn}
                onPress={() => openModal('addBlock', item.id)}
              >
                <Ionicons name="add" $$$ />
                <Text style={styles.addSmallText}>Add Block</Text>
              </TouchableOpacity>
            </View>
            {blocks.length > 0 ? (
              blocks.map((block) => (
                <View key={block.id} style={styles.blockCard}>
                  <View style={styles.blockInfo}>
                    <Ionicons name="home" $$$ />
                    <Text style={[TYPOGRAPHY.body, { color: COLORS.onSurface, fontWeight: '600' }]}>
                      {block.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addSmallBtn}
                    onPress={() => openModal('addRoom', item.id, block.id)}
                  >
                    <Ionicons name="add" $$$ />
                    <Text style={styles.addSmallText}>Room</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={[TYPOGRAPHY.muted, { color: COLORS.outline, paddingVertical: 8 }]}>
                No blocks added yet
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const getModalTitle = () => {
    switch (modalMode) {
      case 'addLocation': return 'Add Location';
      case 'addBlock': return 'Add Block';
      case 'addRoom': return 'Add Room';
      default: return '';
    }
  };

  const getPlaceholder = () => {
    switch (modalMode) {
      case 'addLocation': return 'e.g. Main Campus';
      case 'addBlock': return 'e.g. Block A';
      case 'addRoom': return 'e.g. Room 101';
      default: return '';
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(admin)/dashboard')}>
          <Ionicons name="arrow-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Locations</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading locations...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorIconBg}>
            <Ionicons name="warning" $$$ />
          </View>
          <Text style={[TYPOGRAPHY.subtitle, styles.errorTitle]}>Failed to load locations</Text>
          <Text style={[TYPOGRAPHY.body, styles.errorText]}>
            {(error as any)?.response?.data?.message || 'Check your connection and try again.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={[TYPOGRAPHY.subtitle, styles.retryButtonText]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : locations.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 44 }}>📍</Text>
          <Text style={[TYPOGRAPHY.subtitle, styles.emptyTitle]}>No locations yet</Text>
          <Text style={[TYPOGRAPHY.muted, styles.emptyText]}>Add campus delivery locations.</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => openModal('addLocation')}>
            <Text style={[TYPOGRAPHY.subtitle, styles.addBtnText]}>Add Location</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.id}
          renderItem={renderLocation}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[COLORS.primary]} />
          }
        />
      )}

      {locations.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => openModal('addLocation')}>
          <Ionicons name="add" $$$ />
        </TouchableOpacity>
      )}

      {/* Add Modal */}
      <Modal visible={modalMode !== 'none'} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setModalMode('none'); setFormName(''); }}
            >
              <Ionicons name="chevron-back" $$$ />
            </TouchableOpacity>
            <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>{getModalTitle()}</Text>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.formContent}>
              <View style={styles.formGroup}>
                <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>NAME</Text>
                <TextInput
                  style={[TYPOGRAPHY.body, styles.textInput]}
                  placeholder={getPlaceholder()}
                  placeholderTextColor={COLORS.outline}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSubmitForm}
                disabled={
                  addLocationMutation.isPending ||
                  addBlockMutation.isPending ||
                  addRoomMutation.isPending
                }
              >
                {(addLocationMutation.isPending || addBlockMutation.isPending || addRoomMutation.isPending) ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <>
                    <Text style={[TYPOGRAPHY.subtitle, styles.saveBtnText]}>Save</Text>
                    <Ionicons name="checkmark-circle" $$$ />
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
    gap: SPACING.stackSm,
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
  locationCard: {
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
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
  locationName: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  locationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  statusBtn: {
    width: 32,
    height: 32,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  expandedSection: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.gutter,
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: SPACING.stackSm,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: SHAPES.roundedDefault,
  },
  addSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  blockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
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
