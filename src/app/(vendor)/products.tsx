import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, FlatList, Image, Alert, Switch, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  images: string[];
  isAvailable: boolean;
}

export default function ProductMenuManagement() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const vendorId = user?.vendorProfile?.id;

  // 1. Fetch Vendor Products
  const { data: products, isLoading, error, refetch } = useQuery<Product[]>({
    queryKey: ['vendorProducts', vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const res = await api.get(`/products/vendor/${vendorId}`);
      return res.data?.data ?? res.data ?? [];
    },
    enabled: !!vendorId,
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // 2. Delete Product Mutation
  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await api.delete(`/products/${productId}`);
      return res.data;
    },
    onSuccess: () => {
      showToast('Product deleted successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['vendorProducts', vendorId] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to delete product.', 'error');
    }
  });

  // 3. Toggle Stock Status Mutation (Available / Out of Stock)
  const toggleStockMutation = useMutation({
    mutationFn: async ({ productId, isAvailable }: { productId: string; isAvailable: boolean }) => {
      const res = await api.patch(`/products/${productId}`, { isAvailable });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorProducts', vendorId] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to toggle availability.', 'error');
    }
  });

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to permanently delete "${product.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(product.id)
        }
      ]
    );
  };

  const handleToggleStock = (product: Product, value: boolean) => {
    toggleStockMutation.mutate({ productId: product.id, isAvailable: value });
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const imageUrl = item.images && item.images.length > 0 ? item.images[0] : null;

    return (
      <View style={styles.productCard}>
        {/* Thumbnail Image */}
        <View style={styles.thumbnailContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name={item.category === 'supplies' ? 'storefront' : 'fast-food'} size={24} color={COLORS.outline} />
            </View>
          )}
        </View>

        {/* Product Details */}
        <View style={styles.detailsContainer}>
          <Text style={[TYPOGRAPHY.subtitle, styles.productName]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[TYPOGRAPHY.muted, styles.productCategory]} numberOfLines={1}>
            {item.category === 'food' ? 'Food & Drink' : 'Study Supplies'}
          </Text>
          <Text style={[TYPOGRAPHY.headlineLg, styles.productPrice]}>
            ₦{item.price.toLocaleString()}
          </Text>

          {/* Toggle Switch */}
          <View style={styles.stockToggleRow}>
            <Text style={[TYPOGRAPHY.labelMini, styles.stockLabel]}>
              {item.isAvailable ? 'IN STOCK' : 'OUT OF STOCK'}
            </Text>
            <Switch
              value={item.isAvailable}
              onValueChange={(val) => handleToggleStock(item, val)}
              trackColor={{ false: COLORS.outline, true: COLORS.primary }}
              thumbColor={COLORS.white}
              ios_backgroundColor={COLORS.outline}
            />
          </View>
        </View>

        {/* Actions Button Panel */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => router.push({ pathname: '/(vendor)/add-product', params: { id: item.id } })}
          >
            <Text style={styles.editBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDeleteProduct(item)}
            disabled={deleteMutation.isPending}
          >
            <Text style={styles.deleteBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(vendor)/dashboard')}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Menu Management</Text>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>Loading menu items...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="warning" $$$ />
          <Text style={[TYPOGRAPHY.subtitle, { marginTop: SPACING.gutter, color: COLORS.primary }]}>
            Failed to load products
          </Text>
          <Text style={[TYPOGRAPHY.muted, { textAlign: 'center', marginTop: 4, paddingHorizontal: 32 }]}>
            {(error as any).response?.data?.message || 'Check network connection and retry.'}
          </Text>
        </View>
      ) : products && products.length > 0 ? (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        />
      ) : (
        <View style={styles.centered}>
          <Text style={{ fontSize: 44 }}>🍔</Text>
          <Text style={[TYPOGRAPHY.subtitle, styles.emptyTitle]}>No products added yet</Text>
          <Text style={[TYPOGRAPHY.muted, styles.emptyText]}>
            Add items to show them to JABU students on campus.
          </Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(vendor)/add-product')}
          >
            <Text style={[TYPOGRAPHY.subtitle, styles.addBtnText]}>Add First Item</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Footer / Floating Add Product FAB */}
      {products && products.length > 0 && (
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.addFab} onPress={() => router.push('/(vendor)/add-product')}>
            <Ionicons name="add" $$$ />
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
    marginLeft: -6,
  },
  headerTitle: {
    color: COLORS.primary,
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
  productCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.gutter,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    gap: SPACING.gutter,
    ...SHADOWS.appCard,
  },
  thumbnailContainer: {
    width: 80,
    height: 80,
    borderRadius: SHAPES.roundedMd,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  productCategory: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 1,
  },
  productPrice: {
    color: COLORS.primary,
    fontWeight: '800',
    marginTop: 4,
  },
  stockToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  stockLabel: {
    color: COLORS.outline,
    fontSize: 9,
    fontWeight: '700',
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: SPACING.stackSm,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtn: {
    backgroundColor: COLORS.surfaceContainerLow,
  },
  editBtnText: {
    fontSize: 14,
  },
  deleteBtn: {
    backgroundColor: COLORS.errorContainer || 'rgba(187, 1, 20, 0.05)',
  },
  deleteBtnText: {
    fontSize: 14,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 999,
  },
  addFab: {
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
  },
});
