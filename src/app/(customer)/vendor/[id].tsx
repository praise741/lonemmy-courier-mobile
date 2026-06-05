import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useCartStore } from '@/stores/cartStore';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '@/context/ToastContext';

const { width, height } = Dimensions.get('window');

export interface OptionChoice {
  id: string;
  label: string;
  additionalPrice: number | string;
  isAvailable: boolean;
}

export interface OptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  maxSelections: number;
  choices: OptionChoice[];
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  price: number | string;
  inStock: boolean;
  category?: string | null;
  optionGroups?: OptionGroup[];
}

export interface VendorDetail {
  id: string;
  businessName: string;
  description?: string | null;
  address: string;
  image?: string | null;
  types: string[];
  isOpen: boolean;
  isDrinkPartner?: boolean;
  averageRating?: number | null;
  reviewCount?: number;
  products: Product[];
}

export default function VendorDetailMenu() {
  const router = useRouter();
  const { id: vendorId } = useLocalSearchParams();
  const { showToast } = useToast();

  // Zustand Cart Store
  const cartStore = useCartStore();
  const [favorite, setFavorite] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  // Option Selector Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string[]>>({}); // groupId -> choiceIds[]
  const [modalQty, setModalQty] = useState(1);

  // Fetch Vendor Profile + Menu
  const { data: vendor, isLoading, error, refetch } = useQuery<VendorDetail>({
    queryKey: ['vendor', vendorId],
    queryFn: async () => {
      const response = await api.get(`/vendors/${vendorId}`);
      return response.data?.data ?? response.data;
    },
    enabled: !!vendorId,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const { data: reviewsData } = useQuery<any[]>({
    queryKey: ['vendor-reviews', vendorId],
    queryFn: async () => {
      const response = await api.get(`/reviews/vendor/${vendorId}`);
      return response.data?.data ?? response.data ?? [];
    },
    enabled: !!vendorId,
  });

  const reviews = Array.isArray(reviewsData) ? reviewsData : [];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>Loading menu...</Text>
      </View>
    );
  }

  if (error || !vendor) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" $$$ />
        <Text style={[TYPOGRAPHY.body, { color: COLORS.primary, marginTop: SPACING.gutter }]}>
          Failed to load vendor menu
        </Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/(customer)/home')}>
          <Text style={styles.backLinkText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Categories extraction
  const categories = ['All', ...new Set(vendor.products.map((p) => p.category || 'Other').filter(Boolean))];

  const filteredProducts = vendor.products.filter((p) => {
    if (activeCategory === 'All') return true;
    return (p.category || 'Other') === activeCategory;
  });

  // Calculate product counts in cart
  const getProductCountInCart = (productId: string) => {
    return cartStore.items
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Open Option Selector Modal
  const handleProductPress = (product: Product) => {
    if (!vendor.isOpen) {
      showToast('This vendor is currently closed and not accepting orders.', 'info');
      return;
    }

    if (!product.inStock) {
      showToast('This item is currently unavailable.', 'info');
      return;
    }

    setSelectedProduct(product);
    setModalQty(1);

    // Pre-populate empty selection dictionary
    const initialSelections: Record<string, string[]> = {};
    if (product.optionGroups) {
      product.optionGroups.forEach((group) => {
        initialSelections[group.id] = [];
      });
    }
    setSelectedChoices(initialSelections);
  };

  // Handle Radio/Checkbox selection toggle inside modal
  const handleChoiceSelect = (group: OptionGroup, choice: OptionChoice) => {
    setSelectedChoices((prev) => {
      const currentSelections = prev[group.id] || [];
      
      if (group.maxSelections === 1) {
        // Radio behavior: set to only this choice, or empty if toggle off
        const isSelected = currentSelections.includes(choice.id);
        return {
          ...prev,
          [group.id]: isSelected ? [] : [choice.id],
        };
      } else {
        // Checkbox behavior: toggle selection up to maxSelections limit
        const isSelected = currentSelections.includes(choice.id);
        if (isSelected) {
          return {
            ...prev,
            [group.id]: currentSelections.filter((id) => id !== choice.id),
          };
        } else {
          if (currentSelections.length >= group.maxSelections) {
            showToast(`You can select a maximum of ${group.maxSelections} options for ${group.name}.`, 'info');
            return prev;
          }
          return {
            ...prev,
            [group.id]: [...currentSelections, choice.id],
          };
        }
      }
    });
  };

  // Calculate accumulated price for selected product + options
  const calculateAccumulatedItemPrice = () => {
    if (!selectedProduct) return 0;
    const basePrice = Number(selectedProduct.price);
    let optionsCost = 0;

    if (selectedProduct.optionGroups) {
      selectedProduct.optionGroups.forEach((group) => {
        const selections = selectedChoices[group.id] || [];
        selections.forEach((choiceId) => {
          const choice = group.choices.find((c) => c.id === choiceId);
          if (choice) {
            optionsCost += Number(choice.additionalPrice);
          }
        });
      });
    }

    return basePrice + optionsCost;
  };

  // Submit to Zustand Cart Store
  const handleAddToBasket = () => {
    if (!selectedProduct) return;

    // Verify required option groups
    if (selectedProduct.optionGroups) {
      for (const group of selectedProduct.optionGroups) {
        const selections = selectedChoices[group.id] || [];
        if (group.isRequired && selections.length === 0) {
          showToast(`Please choose at least one option for ${group.name}.`, 'info');
          return;
        }
      }
    }

    // Map selections to Zustand CartOption interface
    const cartOptions: any[] = [];
    if (selectedProduct.optionGroups) {
      selectedProduct.optionGroups.forEach((group) => {
        const selections = selectedChoices[group.id] || [];
        selections.forEach((choiceId) => {
          const choice = group.choices.find((c) => c.id === choiceId);
          if (choice) {
            cartOptions.push({
              groupId: group.id,
              choiceId: choice.id,
              groupName: group.name,
              choiceLabel: choice.label,
              additionalPrice: Number(choice.additionalPrice),
              qty: 1,
            });
          }
        });
      });
    }

    // Add item to Zustand cart store
    cartStore.addItem({
      productId: selectedProduct.id,
      vendorId: vendor.id,
      vendorName: vendor.businessName,
      name: selectedProduct.name,
      description: selectedProduct.description || undefined,
      image: selectedProduct.image || undefined,
      price: Number(selectedProduct.price),
      quantity: modalQty,
      options: cartOptions,
    });

    // Reset and close modal
    setSelectedProduct(null);
    setSelectedChoices({});
    setModalQty(1);
  };

  // Add simple item direct helper
  const handleQuickAdd = (product: Product) => {
    if (!vendor.isOpen) {
      showToast('This vendor is currently closed and not accepting orders.', 'info');
      return;
    }

    if (!product.inStock) {
      showToast('This item is currently unavailable.', 'info');
      return;
    }

    // If product has option groups, redirect to customization modal
    if (product.optionGroups && product.optionGroups.length > 0) {
      handleProductPress(product);
      return;
    }

    // Add simple item directly
    cartStore.addItem({
      productId: product.id,
      vendorId: vendor.id,
      vendorName: vendor.businessName,
      name: product.name,
      description: product.description || undefined,
      image: product.image || undefined,
      price: Number(product.price),
      quantity: 1,
      options: [],
    });
  };

  // Total items in cart and total price calculations
  const vendorCartItems = cartStore.items.filter((item) => item.vendorId === vendor.id);
  const totalItemsCount = vendorCartItems.reduce((sum, item) => sum + item.quantity, 0);
  
  const totalCartPrice = vendorCartItems.reduce((sum, item) => {
    const optionsCost = (item.options || []).reduce(
      (s, o) => s + (o.additionalPrice || 0) * (o.qty || 1),
      0
    );
    return sum + (item.price + optionsCost) * item.quantity;
  }, 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Cover Image Header */}
        <View style={styles.coverContainer}>
          {vendor.image ? (
            <Image source={{ uri: vendor.image }} style={styles.coverImage as any} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="fast-food" $$$ />
            </View>
          )}

          {/* Header Buttons overlay */}
          <SafeAreaView style={styles.overlayHeader}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => router.replace('/(customer)/home')}>
              <Ionicons name="chevron-back" $$$ />
            </TouchableOpacity>

            <View style={styles.rightHeaderActions}>
              <TouchableOpacity style={styles.circleBtn} onPress={() => setFavorite(!favorite)}>
                <Text style={{ fontSize: 18, color: favorite ? COLORS.primary : COLORS.outline }}>
                  {favorite ? '❤️' : '🤍'}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* Vendor Information Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={[TYPOGRAPHY.headlineLg, styles.vendorName]}>{vendor.businessName}</Text>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" $$$ />
              <Text style={[TYPOGRAPHY.subtitle, styles.ratingText]}>
                {(vendor.averageRating ?? 5.0).toFixed(1)}
              </Text>
            </View>
          </View>

          <Text style={[TYPOGRAPHY.body, styles.vendorTags]}>
            {vendor.types.join(' • ')} Partner • {vendor.address}
          </Text>

          {vendor.isDrinkPartner && (
            <View style={styles.drinkTagBadge}>
              <Text style={styles.drinkTagText}>🍻 CAMPUS DRINK PARTNER (FREE DELIVERY PROMO)</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.infoMetaRow}>
            <View style={styles.metaCol}>
              <Ionicons name="settings" $$$ />
              <Text style={[TYPOGRAPHY.muted, styles.metaText]}>
                {vendor.isOpen ? 'Accepting Orders' : 'Offline / Closed'}
              </Text>
            </View>
            <View style={[styles.deliveryBadge, { backgroundColor: vendor.isOpen ? '#E6FFED' : '#FFEBE9' }]}>
              <Ionicons name="car" $$$ />
              <Text style={[TYPOGRAPHY.muted, styles.deliveryText, { color: vendor.isOpen ? '#1A7F37' : '#D1242F' }]}>
                {vendor.isOpen ? '15-25 min' : 'Closed'}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu Navigation Bar */}
        {categories.length > 1 && (
          <View style={styles.categoryBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryBtn,
                    activeCategory === cat ? styles.categoryBtnActive : styles.categoryBtnInactive,
                  ]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text
                    style={[
                      TYPOGRAPHY.subtitle,
                      activeCategory === cat ? styles.catTextActive : styles.catTextInactive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Menu Content list */}
        <View style={styles.menuContainer}>
          <Text style={[TYPOGRAPHY.headlineLg, styles.menuHeaderTitle]}>{activeCategory} Menu</Text>
          <View style={styles.menuList}>
            {filteredProducts.map((product) => {
              const qtyInCart = getProductCountInCart(product.id);
              return (
                <View key={product.id} style={styles.itemCard}>
                  {/* Item Image */}
                  <View style={styles.itemImageContainer}>
                    {product.image ? (
                      <Image source={{ uri: product.image }} style={styles.itemImage as any} />
                    ) : (
                      <View style={styles.itemFallbackImage}>
                        <Ionicons name="fast-food" $$$ />
                      </View>
                    )}
                  </View>

                  {/* Item Details */}
                  <View style={styles.itemDetails}>
                    <View>
                      <Text style={[TYPOGRAPHY.subtitle, styles.itemName]}>{product.name}</Text>
                      {product.description && (
                        <Text style={[TYPOGRAPHY.muted, styles.itemDesc]} numberOfLines={2}>
                          {product.description}
                        </Text>
                      )}
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={[TYPOGRAPHY.subtitle, styles.itemPrice]}>
                        ₦{Number(product.price).toLocaleString()}
                      </Text>

                      {!product.inStock ? (
                        <View style={styles.outOfStockBadge}>
                          <Text style={styles.outOfStockText}>Out of Stock</Text>
                        </View>
                      ) : qtyInCart > 0 ? (
                        <View style={styles.addedInCartBadge}>
                          <Text style={styles.addedInCartBadgeText}>{qtyInCart} in Basket</Text>
                          <TouchableOpacity
                            style={styles.addMoreBtn}
                            onPress={() => {
                              if (product.optionGroups && product.optionGroups.length > 0) {
                                handleProductPress(product);
                              } else {
                                handleQuickAdd(product);
                              }
                            }}
                          >
                            <Ionicons name="add" $$$ />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.addBtn} onPress={() => handleQuickAdd(product)}>
                          <Ionicons name="add" $$$ />
                          <Text style={[TYPOGRAPHY.muted, styles.addBtnText]}>ADD</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {reviews.length > 0 && (
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={[TYPOGRAPHY.headlineLg, { color: COLORS.onSurface, fontWeight: '800' }]}>
                Reviews
              </Text>
              <View style={styles.reviewSummaryBadge}>
                <Ionicons name="star" $$$ />
                <Text style={[TYPOGRAPHY.subtitle, { color: COLORS.onSurface, fontWeight: '700' }]}>
                  {(vendor.averageRating ?? 5.0).toFixed(1)}
                </Text>
                <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary }]}>
                  ({vendor.reviewCount ?? reviews.length})
                </Text>
              </View>
            </View>

            {reviews.slice(0, 5).map((review: any, idx: number) => (
              <View key={review.id || idx} style={styles.reviewCard}>
                <View style={styles.reviewCardHeader}>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name="star"
                        size={14}
                        color={star <= (review.rating || 0) ? COLORS.primary : COLORS.outline}
                      />
                    ))}
                  </View>
                  {review.createdAt && (
                    <Text style={[TYPOGRAPHY.muted, { color: COLORS.outline, fontSize: 10 }]}>
                      {new Date(review.createdAt).toLocaleDateString('en-NG', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  )}
                </View>
                {review.comment && (
                  <Text style={[TYPOGRAPHY.body, { color: COLORS.onSurfaceVariant, marginTop: 4 }]}>
                    {review.comment}
                  </Text>
                )}
                {review.customer?.name && (
                  <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary, marginTop: 4 }]}>
                    — {review.customer.name}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating View Basket FAB */}
      {totalItemsCount > 0 && (
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.cartFab} onPress={() => router.push('/(customer)/cart')}>
            <View style={styles.fabLeft}>
              <View style={styles.fabIconBadgeContainer}>
                <Ionicons name="cart" $$$ />
                <View style={styles.fabBadge}>
                  <Text style={styles.fabBadgeText}>{totalItemsCount}</Text>
                </View>
              </View>
              <Text style={[TYPOGRAPHY.subtitle, styles.fabText]}>View Basket</Text>
            </View>
            <View style={styles.fabRight}>
              <View style={styles.fabDivider} />
              <Text style={[TYPOGRAPHY.subtitle, styles.fabPrice]}>₦{totalCartPrice.toLocaleString()}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Option Selection Drawer / Modal */}
      {selectedProduct && (
        <Modal
          visible={!!selectedProduct}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedProduct(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[TYPOGRAPHY.headlineLg, styles.modalItemName]}>
                    {selectedProduct.name}
                  </Text>
                  <Text style={[TYPOGRAPHY.body, styles.modalItemPrice]}>
                    ₦{Number(selectedProduct.price).toLocaleString()} base price
                  </Text>
                </View>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedProduct(null)}>
                  <Ionicons name="add" $$$ />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 40 }}>
                {selectedProduct.description && (
                  <View style={styles.modalDescContainer}>
                    <Text style={[TYPOGRAPHY.body, styles.modalItemDesc]}>
                      {selectedProduct.description}
                    </Text>
                  </View>
                )}

                {/* Option Groups Mapping */}
                {selectedProduct.optionGroups && selectedProduct.optionGroups.map((group) => {
                  const selections = selectedChoices[group.id] || [];
                  return (
                    <View key={group.id} style={styles.optionGroupContainer}>
                      <View style={styles.optionGroupHeader}>
                        <View>
                          <Text style={[TYPOGRAPHY.subtitle, styles.optionGroupName]}>
                            {group.name}
                          </Text>
                          <Text style={[TYPOGRAPHY.muted, styles.optionGroupHint]}>
                            {group.maxSelections === 1 ? 'Select one choice' : `Select up to ${group.maxSelections} choices`}
                          </Text>
                        </View>
                        {group.isRequired ? (
                          <View style={styles.requiredPill}>
                            <Text style={styles.requiredPillText}>REQUIRED</Text>
                          </View>
                        ) : (
                          <View style={styles.optionalPill}>
                            <Text style={styles.optionalPillText}>OPTIONAL</Text>
                          </View>
                        )}
                      </View>

                      {/* Choice items */}
                      <View style={styles.choiceList}>
                        {group.choices.map((choice) => {
                          const isSelected = selections.includes(choice.id);
                          return (
                            <TouchableOpacity
                              key={choice.id}
                              style={[
                                styles.choiceItemRow,
                                isSelected && styles.choiceItemRowSelected,
                              ]}
                              onPress={() => handleChoiceSelect(group, choice)}
                            >
                              <View style={styles.choiceLeft}>
                                <View
                                  style={[
                                    group.maxSelections === 1 ? styles.radioOuter : styles.checkboxOuter,
                                    isSelected && styles.optionSelectedBorder,
                                  ]}
                                >
                                  {isSelected && (
                                    <View
                                      style={group.maxSelections === 1 ? styles.radioInner : styles.checkboxInner}
                                    />
                                  )}
                                </View>
                                <Text style={[TYPOGRAPHY.body, styles.choiceLabel]}>
                                  {choice.label}
                                </Text>
                              </View>
                              {Number(choice.additionalPrice) > 0 && (
                                <Text style={[TYPOGRAPHY.subtitle, styles.choiceAdditionalPrice]}>
                                  + ₦{Number(choice.additionalPrice).toLocaleString()}
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Modal Footer Controls */}
              <View style={styles.modalFooter}>
                <View style={styles.modalQtySection}>
                  <Text style={[TYPOGRAPHY.subtitle, styles.modalQtyLabel]}>Quantity</Text>
                  <View style={styles.modalQtyStepper}>
                    <TouchableOpacity
                      style={styles.modalStepperBtn}
                      onPress={() => setModalQty(Math.max(1, modalQty - 1))}
                    >
                      <Ionicons name="remove" $$$ />
                    </TouchableOpacity>
                    <Text style={[TYPOGRAPHY.headlineLg, styles.modalQtyText]}>{modalQty}</Text>
                    <TouchableOpacity
                      style={styles.modalStepperBtn}
                      onPress={() => setModalQty(modalQty + 1)}
                    >
                      <Ionicons name="add" $$$ />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.modalAddBtn} onPress={handleAddToBasket}>
                  <Text style={[TYPOGRAPHY.subtitle, styles.modalAddBtnText]}>
                    Add to Basket • ₦{(calculateAccumulatedItemPrice() * modalQty).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  coverContainer: {
    height: 220,
    width: '100%',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayHeader: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pagePadding,
  },
  rightHeaderActions: {
    flexDirection: 'row',
    gap: SPACING.stackSm,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  infoCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedXl,
    marginHorizontal: SPACING.pagePadding,
    marginTop: -40,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appShell,
    gap: SPACING.stackSm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vendorName: {
    color: COLORS.onSurface,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainerHigh,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: SHAPES.roundedDefault,
  },
  ratingText: {
    fontWeight: '700',
    color: COLORS.onSurface,
    fontSize: 12,
  },
  vendorTags: {
    color: COLORS.secondary,
    lineHeight: 18,
  },
  drinkTagBadge: {
    backgroundColor: COLORS.secondaryContainer,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: SHAPES.roundedDefault,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  drinkTagText: {
    fontSize: 9,
    color: COLORS.secondary,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
  },
  infoMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: COLORS.onSurfaceVariant,
    fontSize: 13,
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: SHAPES.roundedDefault,
  },
  deliveryText: {
    fontWeight: '700',
    fontSize: 12,
  },
  categoryBar: {
    marginTop: SPACING.stackLg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom: 10,
  },
  categoryScroll: {
    paddingHorizontal: SPACING.pagePadding,
    gap: 10,
  },
  categoryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: SHAPES.roundedCard,
  },
  categoryBtnActive: {
    backgroundColor: COLORS.secondary,
    ...SHADOWS.appCard,
  },
  categoryBtnInactive: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  catTextActive: {
    color: COLORS.onSecondary,
    fontWeight: '700',
  },
  catTextInactive: {
    color: COLORS.secondary,
  },
  menuContainer: {
    paddingHorizontal: SPACING.pagePadding,
    marginTop: SPACING.stackLg,
  },
  menuHeaderTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
    marginBottom: SPACING.stackMd,
  },
  menuList: {
    gap: SPACING.stackMd,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.gutter,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
    gap: SPACING.gutter,
  },
  itemImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  itemFallbackImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    color: COLORS.onSurface,
    fontWeight: '700',
    fontSize: 15,
  },
  itemDesc: {
    color: COLORS.onSurfaceVariant,
    fontSize: 12,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  itemPrice: {
    fontWeight: '800',
    color: COLORS.onSurface,
    fontSize: 15,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: SHAPES.roundedCard,
  },
  addBtnText: {
    fontWeight: '700',
    color: COLORS.primary,
    fontSize: 11,
  },
  outOfStockBadge: {
    backgroundColor: '#FFEBE9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: SHAPES.roundedCard,
    borderWidth: 1,
    borderColor: '#FFD6E7',
  },
  outOfStockText: {
    color: '#D1242F',
    fontWeight: '700',
    fontSize: 11,
  },
  addedInCartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: SHAPES.roundedCard,
  },
  addedInCartBadgeText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
    fontSize: 11,
  },
  addMoreBtn: {
    width: 16,
    height: 16,
    borderRadius: SHAPES.roundedDefault,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    left: SPACING.pagePadding,
    right: SPACING.pagePadding,
    zIndex: 999,
  },
  cartFab: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: SHAPES.roundedShell,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 8,
  },
  fabLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  fabIconBadgeContainer: {
    position: 'relative',
  },
  fabBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: COLORS.surfaceContainerLowest,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabBadgeText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '900',
  },
  fabText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
  fabRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  fabDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  fabPrice: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  backLink: {
    marginTop: 20,
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: SHAPES.roundedMd,
  },
  backLinkText: {
    color: COLORS.onSecondary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.85,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.stackLg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalItemName: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  modalItemPrice: {
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    padding: SPACING.stackLg,
  },
  modalDescContainer: {
    marginBottom: 20,
  },
  modalItemDesc: {
    color: COLORS.secondary,
    lineHeight: 20,
  },
  optionGroupContainer: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 20,
    ...SHADOWS.appCard,
  },
  optionGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  optionGroupName: {
    fontWeight: '800',
    color: COLORS.onSurface,
    fontSize: 16,
  },
  optionGroupHint: {
    fontSize: 12,
    marginTop: 2,
  },
  requiredPill: {
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  requiredPillText: {
    fontSize: 9,
    color: COLORS.primary,
    fontWeight: '900',
  },
  optionalPill: {
    backgroundColor: COLORS.surfaceContainerHigh,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  optionalPillText: {
    fontSize: 9,
    color: COLORS.secondary,
    fontWeight: '900',
  },
  choiceList: {
    gap: SPACING.stackSm,
  },
  choiceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: SHAPES.roundedMd,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  choiceItemRowSelected: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primary,
  },
  choiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
    flex: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.outline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  checkboxOuter: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.outline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  optionSelectedBorder: {
    borderColor: COLORS.primary,
  },
  choiceLabel: {
    fontWeight: '600',
    color: COLORS.onSurface,
    flex: 1,
  },
  choiceAdditionalPrice: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  modalFooter: {
    padding: SPACING.stackLg,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: SPACING.stackMd,
  },
  modalQtySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalQtyLabel: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  modalQtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackMd,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: SHAPES.roundedCard,
    padding: 6,
  },
  modalStepperBtn: {
    width: 32,
    height: 32,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  modalQtyText: {
    fontWeight: '800',
    color: COLORS.onSurface,
    minWidth: 24,
    textAlign: 'center',
  },
  modalAddBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: SHAPES.roundedLg,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  modalAddBtnText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  reviewsSection: {
    marginTop: SPACING.stackMd,
    paddingHorizontal: SPACING.pagePadding,
    gap: SPACING.stackMd,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainerHigh,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: SHAPES.roundedDefault,
  },
  reviewCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
});
