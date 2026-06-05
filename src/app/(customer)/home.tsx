import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export interface Vendor {
  id: string;
  businessName: string;
  image?: string | null;
  types: string[];
  isDrinkPartner?: boolean;
  averageRating?: number | null;
  reviewCount?: number;
  isOpen: boolean;
}

export default function SuperAppHome() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [view, setView] = useState<'portal' | 'food'>('portal');
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | 'FOOD' | 'SHOP'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const [selectedCampus, setSelectedCampus] = useState<{ id: string; name: string } | null>(null);
  const [campuses, setCampuses] = useState<Array<{ id: string; name: string }>>([]);
  const [showCampusModal, setShowCampusModal] = useState(false);

  // Load campuses and retrieve stored campus
  useEffect(() => {
    const loadCampuses = async () => {
      try {
        const res = await api.get('/locations/campuses');
        const list = (res.data?.data || res.data || []) as Array<{ id: string; name: string }>;
        setCampuses(list);

        const stored = await AsyncStorage.getItem('lonemmy-selected-campus');
        if (stored) {
          setSelectedCampus(JSON.parse(stored));
        } else if (list.length > 0) {
          setSelectedCampus(list[0]);
          await AsyncStorage.setItem('lonemmy-selected-campus', JSON.stringify(list[0]));
        }
      } catch (e) {
        console.error('Failed to load campuses', e);
      }
    };
    loadCampuses();
  }, []);

  // Fetch wallet balance
  const { data: walletData } = useQuery<{ balance: number | null }>({
    queryKey: ['wallet-balance'],
    queryFn: async () => {
      try {
        const response = await api.get('/orders', {
          params: { status: 'DELIVERED', limit: 100 },
        });
        const orders = response.data?.data ?? response.data ?? [];
        const total = Array.isArray(orders)
          ? orders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)
          : 0;
        return { balance: total };
      } catch {
        return { balance: null };
      }
    },
    staleTime: 1000 * 60,
    retry: false,
  });
  const walletBalance = walletData?.balance;

  // Fetch active vendors via React Query (filtered by campus!)
  const { data: vendors, isLoading, error, refetch } = useQuery<Vendor[]>({
    queryKey: ['vendors', selectedType, search, selectedCampus?.id],
    queryFn: async () => {
      const typeParam = selectedType === 'ALL' ? undefined : selectedType;
      const response = await api.get('/vendors', {
        params: {
          type: typeParam,
          search: search.trim() || undefined,
        },
      });
      const list = (response.data?.data ?? response.data ?? []) as Vendor[];
      if (selectedCampus) {
        return list.filter((v: any) => v.campusId === selectedCampus.id);
      }
      return list;
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (view === 'portal') {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.portalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.profileSection}>
              <View style={styles.avatarBorder}>
                <Ionicons name="person" size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary }]}>Welcome to Lonemmy</Text>
                <Text style={[TYPOGRAPHY.headlineLg, styles.greetingText]}>
                  {user?.name || 'Guest User'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.notificationBtn} onPress={() => router.push('/(customer)/notifications')}>
              <Ionicons name="chatbubble" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>

          {/* Campus Selector Bar */}
          <View style={styles.campusSelectorBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.mapIconBg}>
                <Ionicons name="map" size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.campusSelectorLabel}>CURRENT SITE</Text>
                <Text style={styles.campusSelectorValue}>
                  {selectedCampus ? selectedCampus.name : 'Select Campus Location'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.campusSelectorBtn}
              onPress={() => setShowCampusModal(true)}
            >
              <Text style={styles.campusSelectorBtnText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Intro Card */}
          <View style={styles.portalIntroCard}>
            <View style={styles.portalIntroTextCol}>
              <Text style={styles.portalIntroTitle}>Super App Dashboard</Text>
              <Text style={styles.portalIntroDesc}>
                Your campus companion. Order food or send/receive packages instantly.
              </Text>
            </View>
          </View>

          {/* Service grid */}
          <View style={styles.portalGrid}>
            {/* Food Delivery */}
            <TouchableOpacity
              style={[styles.portalCard, { backgroundColor: '#FF8A3D' }]}
              onPress={() => {
                if (!user) {
                  router.push('/(auth)/login');
                } else {
                  setView('food');
                }
              }}
            >
              <View style={styles.portalCardHeader}>
                <View style={styles.portalCardIconBg}>
                  <Ionicons name="fast-food" size={24} color="#FFF" />
                </View>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </View>
              <Text style={styles.portalCardTitle}>Food & Shop</Text>
              <Text style={styles.portalCardDesc}>
                Order food and convenience items to your campus room.
              </Text>
            </TouchableOpacity>

            {/* Package Delivery */}
            <TouchableOpacity
              style={[styles.portalCard, { backgroundColor: '#4F46E5' }]}
              onPress={() => {
                if (!user) {
                  router.push('/(auth)/login');
                } else {
                  router.push('/(customer)/errands/new');
                }
              }}
            >
              <View style={styles.portalCardHeader}>
                <View style={styles.portalCardIconBg}>
                  <Ionicons name="paper-plane" size={24} color="#FFF" />
                </View>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </View>
              <Text style={styles.portalCardTitle}>Send Package</Text>
              <Text style={styles.portalCardDesc}>
                Ship documents, laundry, or laptops peer-to-peer across campuses.
              </Text>
            </TouchableOpacity>

            {/* Market Store (Coming Soon) */}
            <View style={[styles.portalCard, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
              <View style={styles.portalCardHeader}>
                <View style={[styles.portalCardIconBg, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="cart" size={24} color="#94A3B8" />
                </View>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>SOON</Text>
                </View>
              </View>
              <Text style={[styles.portalCardTitle, { color: '#334155' }]}>Market Store</Text>
              <Text style={[styles.portalCardDesc, { color: '#94A3B8' }]}>
                Vast range of convenience store essentials.
              </Text>
            </View>
          </View>
        </View>

        {/* Campus Modal */}
        <Modal visible={showCampusModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Campus</Text>
                <TouchableOpacity onPress={() => setShowCampusModal(false)}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 16 }}>
                {campuses.length === 0 ? (
                  <Text style={styles.modalEmptyText}>No campuses found</Text>
                ) : (
                  campuses.map((campus) => (
                    <TouchableOpacity
                      key={campus.id}
                      style={[
                        styles.campusModalItem,
                        selectedCampus?.id === campus.id && styles.campusModalItemActive,
                      ]}
                      onPress={async () => {
                        setSelectedCampus(campus);
                        await AsyncStorage.setItem('lonemmy-selected-campus', JSON.stringify(campus));
                        setShowCampusModal(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.campusModalItemText,
                          selectedCampus?.id === campus.id && styles.campusModalItemTextActive,
                        ]}
                      >
                        {campus.name}
                      </Text>
                      {selectedCampus?.id === campus.id && (
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Back navigation */}
        <TouchableOpacity
          style={styles.backServicesBtn}
          onPress={() => setView('portal')}
        >
          <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
          <Text style={styles.backServicesText}>Back to Services</Text>
        </TouchableOpacity>

        {/* Header Greeting */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <View style={styles.avatarBorder}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary }]}>Welcome Back</Text>
              <Text style={[TYPOGRAPHY.headlineLg, styles.greetingText]}>
                {user?.name || 'Guest User'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationBtn} onPress={() => router.push('/(customer)/notifications')}>
            <Ionicons name="chatbubble" size={20} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        {/* Wallet Balance Card */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <Text style={[TYPOGRAPHY.labelMini, styles.walletLabel]}>CAMPUS WALLET BALANCE</Text>
            {walletBalance != null ? (
              <Text style={[TYPOGRAPHY.headlineXl, styles.walletBalance]}>
                ₦{walletBalance.toLocaleString()}
              </Text>
            ) : (
              <Text style={[TYPOGRAPHY.headlineXl, styles.walletBalance]}>N/A</Text>
            )}
          </View>
          <TouchableOpacity style={styles.topUpBtn}>
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={[TYPOGRAPHY.subtitle, styles.topUpText]}>
              {walletBalance != null ? 'Top Up' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Promotional Banner */}
        <View style={styles.promoBanner}>
          <View style={styles.promoTextContainer}>
            <View style={styles.promoTag}>
              <Text style={styles.promoTagText}>FREE DELIVERY ON DRINKS</Text>
            </View>
            <Text style={[TYPOGRAPHY.headlineLg, styles.promoTitle]}>Drink Partners Promo</Text>
            <Text style={[TYPOGRAPHY.body, styles.promoDesc]}>
              Order meals with Drink Partner items and pay zero delivery fees!
            </Text>
          </View>
        </View>

        {/* Premium Search & Filter Bar */}
        <View style={styles.searchSection}>
          <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Explore Campus Vendors</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={COLORS.outline} style={styles.searchIcon} />
            <TextInput
              style={[TYPOGRAPHY.body, styles.searchInput]}
              placeholder="Search cafeteria or food items..."
              placeholderTextColor={COLORS.outline}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={COLORS.outline} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Pills */}
          <View style={styles.filterBar}>
            {(['ALL', 'FOOD', 'SHOP'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterPill,
                  selectedType === type ? styles.filterPillActive : styles.filterPillInactive,
                ]}
                onPress={() => setSelectedType(type)}
              >
                <Text
                  style={[
                    TYPOGRAPHY.subtitle,
                    selectedType === type ? styles.filterTextActive : styles.filterTextInactive,
                  ]}
                >
                  {type === 'ALL' ? '🍔 All' : type === 'FOOD' ? '🍲 Food' : '🛍️ Shops'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Vendors Grid/List */}
        <View style={styles.vendorSection}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>Fetching vendors...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={32} color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.body, { color: COLORS.primary, marginTop: 8 }]}>
                Failed to load vendors. Please pull down to retry.
              </Text>
            </View>
          ) : !vendors || vendors.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food" size={32} color={COLORS.outline} />
              <Text style={[TYPOGRAPHY.subtitle, { color: COLORS.secondary, marginTop: SPACING.gutter }]}>
                No vendors found
              </Text>
              <Text style={[TYPOGRAPHY.muted, { textAlign: 'center', marginTop: 4, paddingHorizontal: 40 }]}>
                No active vendors match your filters in this campus partition.
              </Text>
            </View>
          ) : (
            <View style={styles.vendorList}>
              {vendors.map((vendor) => (
                <TouchableOpacity
                  key={vendor.id}
                  style={[styles.vendorCard, !vendor.isOpen && styles.closedCard]}
                  onPress={() => router.push(`/(customer)/vendor/${vendor.id}`)}
                >
                  {/* Vendor Image */}
                  <View style={styles.vendorImageContainer}>
                    {vendor.image ? (
                      <Image source={{ uri: vendor.image }} style={styles.vendorImage as any} />
                    ) : (
                      <View style={styles.vendorFallbackImage}>
                        <Ionicons
                          name={(vendor.types.includes('FOOD') ? 'fast-food' : 'storefront') as any}
                          size={32}
                          color={COLORS.secondary}
                        />
                      </View>
                    )}
                    
                    {/* Status Badge overlay */}
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: vendor.isOpen ? '#E6FFED' : '#FFEBE9' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: vendor.isOpen ? '#1A7F37' : '#D1242F' },
                        ]}
                      >
                        {vendor.isOpen ? 'OPEN' : 'CLOSED'}
                      </Text>
                    </View>
                  </View>

                  {/* Vendor Details */}
                  <View style={styles.vendorDetails}>
                    <View style={styles.vendorHeaderRow}>
                      <Text style={[TYPOGRAPHY.subtitle, styles.vendorName]} numberOfLines={1}>
                        {vendor.businessName}
                      </Text>
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={10} color="#FFB800" />
                        <Text style={[TYPOGRAPHY.labelMini, styles.ratingText]}>
                          {(vendor.averageRating ?? 5.0).toFixed(1)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.vendorTagsRow}>
                      <Text style={[TYPOGRAPHY.muted, styles.vendorTags]} numberOfLines={1}>
                        {vendor.types.join(' • ')} Campus Partner
                      </Text>
                    </View>

                    <View style={styles.vendorFooterRow}>
                      {vendor.isDrinkPartner && (
                        <View style={styles.drinkPartnerBadge}>
                          <Text style={styles.drinkPartnerText}>🍻 DRINKS PARTNER</Text>
                        </View>
                      )}
                      <Text style={[TYPOGRAPHY.labelMini, styles.vendorTiming]}>
                        15-25 mins delivery
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
  portalContainer: {
    flex: 1,
    padding: SPACING.pagePadding,
  },
  portalIntroCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: SHAPES.roundedCard,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.appCard,
    position: 'relative',
    overflow: 'hidden',
  },
  portalIntroTextCol: {
    gap: 4,
  },
  portalIntroTitle: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '800',
  },
  portalIntroDesc: {
    color: '#C7D2FE',
    fontSize: 12.5,
    lineHeight: 18,
    maxWidth: '85%',
  },
  portalGrid: {
    gap: 15,
  },
  portalCard: {
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.appCard,
  },
  portalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  portalCardIconBg: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  portalCardTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  portalCardDesc: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    lineHeight: 16,
  },
  comingSoonBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
  },
  campusSelectorBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...SHADOWS.appCard,
  },
  mapIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  campusSelectorLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  campusSelectorValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  campusSelectorBtn: {
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  campusSelectorBtnText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 12,
  },
  backServicesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 16,
  },
  backServicesText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    paddingBottom: 80, // Clearance for tab bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.stackLg,
    marginTop: 10,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  avatarBorder: {
    width: 48,
    height: 48,
    borderRadius: SHAPES.roundedXl,
    backgroundColor: COLORS.surfaceContainer,
    borderWidth: 2,
    borderColor: COLORS.surfaceContainerHighest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingText: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  walletCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: SHAPES.roundedXl,
    padding: SPACING.stackLg,
    marginBottom: SPACING.stackLg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  walletHeader: {
    gap: 4,
    flex: 1,
  },
  walletLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '700',
  },
  walletBalance: {
    color: COLORS.onSecondary,
    fontWeight: '800',
    fontSize: 26,
  },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: SHAPES.roundedDefault,
  },
  topUpText: {
    color: COLORS.onSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  promoBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.stackLg,
    marginBottom: SPACING.stackLg,
    ...SHADOWS.appCard,
  },
  promoTextContainer: {
    gap: SPACING.stackSm,
  },
  promoTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: SHAPES.roundedDefault,
  },
  promoTagText: {
    color: COLORS.onPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  promoTitle: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
  promoDesc: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  searchSection: {
    marginBottom: SPACING.stackLg,
  },
  sectionTitle: {
    color: COLORS.onSurface,
    fontWeight: '700',
    marginBottom: SPACING.stackSm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.onSurface,
    fontSize: 14,
    height: '100%',
  },
  clearBtn: {
    padding: 6,
  },
  filterBar: {
    flexDirection: 'row',
    gap: SPACING.stackSm,
    marginTop: SPACING.gutter,
  },
  filterPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: SHAPES.roundedCard,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  filterPillActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  filterPillInactive: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderColor: COLORS.cardBorder,
  },
  filterTextActive: {
    color: COLORS.onSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  filterTextInactive: {
    color: COLORS.secondary,
    fontWeight: '600',
    fontSize: 13,
  },
  vendorSection: {
    marginTop: 4,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorList: {
    gap: SPACING.stackMd,
  },
  vendorCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.gutter,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
    gap: SPACING.gutter,
  },
  closedCard: {
    opacity: 0.6,
  },
  vendorImageContainer: {
    width: 90,
    height: 90,
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  vendorImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  vendorFallbackImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    ...SHADOWS.appCard,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  vendorDetails: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  vendorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vendorName: {
    fontWeight: '800',
    color: COLORS.onSurface,
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: SHAPES.roundedDefault,
  },
  ratingText: {
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  vendorTagsRow: {
    marginVertical: 4,
  },
  vendorTags: {
    color: COLORS.secondary,
    fontSize: 12,
  },
  vendorFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drinkPartnerBadge: {
    backgroundColor: COLORS.secondaryContainer,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  drinkPartnerText: {
    color: COLORS.secondary,
    fontSize: 8,
    fontWeight: '900',
  },
  vendorTiming: {
    color: COLORS.outline,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '50%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  modalEmptyText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 20,
  },
  campusModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  campusModalItemActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.05)',
    borderColor: '#4F46E5',
  },
  campusModalItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  campusModalItemTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
});
