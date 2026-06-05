import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Alert, ActivityIndicator, Image, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface OptionChoice {
  localId: string;
  label: string;
  additionalPrice: string;
  isAvailable: boolean;
}

interface OptionGroup {
  localId: string;
  name: string;
  isRequired: boolean;
  maxSelections: string;
  choices: OptionChoice[];
  expanded: boolean;
}

let choiceCounter = 0;
const generateChoiceId = () => `choice_${++choiceCounter}`;
let groupCounter = 0;
const generateGroupId = () => `group_${++groupCounter}`;

function createEmptyGroup(): OptionGroup {
  return {
    localId: generateGroupId(),
    name: '',
    isRequired: false,
    maxSelections: '1',
    choices: [],
    expanded: true,
  };
}

function createEmptyChoice(): OptionChoice {
  return {
    localId: generateChoiceId(),
    label: '',
    additionalPrice: '',
    isAvailable: true,
  };
}

export default function AddProduct() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<'food' | 'supplies'>('food');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [showOptionGroups, setShowOptionGroups] = useState(false);

  // 1. Fetch existing product if in Edit Mode
  const { data: productData, isLoading: isFetchingProduct } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/products/${id}`);
      return res.data?.data ?? res.data;
    },
    enabled: isEdit,
  });

  // Populate form with product data when fetched
  useEffect(() => {
    if (productData) {
      setName(productData.name || '');
      setPrice(String(productData.price || ''));
      setCategory(productData.category === 'supplies' ? 'supplies' : 'food');
      setDescription(productData.description || '');
      setImages(productData.images || []);

      if (productData.optionGroups && productData.optionGroups.length > 0) {
        setShowOptionGroups(true);
        const loaded: OptionGroup[] = productData.optionGroups.map((og: any) => ({
          localId: og.id || generateGroupId(),
          name: og.name || '',
          isRequired: og.isRequired ?? false,
          maxSelections: String(og.maxSelections ?? 1),
          choices: (og.choices || []).map((c: any) => ({
            localId: c.id || generateChoiceId(),
            label: c.label || '',
            additionalPrice: String(c.additionalPrice ?? ''),
            isAvailable: c.isAvailable ?? true,
          })),
          expanded: false,
        }));
        setOptionGroups(loaded);
      }
    }
  }, [productData]);

  // 2. Image Picker and Upload to Server
  const handlePickImage = async () => {
    if (images.length >= 5) {
      showToast('You can upload up to 5 product images', 'info');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Permission to access camera roll is required.', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const pickedAsset = result.assets[0];
      await handleUploadImage(pickedAsset.uri);
    }
  };

  const handleUploadImage = async (uri: string) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      const uriParts = uri.split('/');
      const fileName = uriParts[uriParts.length - 1] || 'product-image.jpg';
      
      const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

      formData.append('image', {
        uri,
        name: fileName,
        type: mimeType,
      } as any);

      const res = await api.post('/products/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadedUrl = res.data?.url || res.data?.data?.url || res.data?.imageUrl || res.data?.data;
      
      if (uploadedUrl) {
        setImages(prev => [...prev, uploadedUrl]);
      } else {
        throw new Error('Image URL was not returned in response.');
      }
    } catch (error: any) {
      console.error('File upload failed:', error);
      showToast(error.response?.data?.message || error.message || 'An error occurred during file upload.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== index));
  };

  const handlePromoteToCover = (index: number) => {
    if (index === 0) return;
    setImages(prev => {
      const nextImages = [...prev];
      const target = nextImages[index];
      nextImages.splice(index, 1);
      nextImages.unshift(target); // Move to index 0 (MAIN cover)
      return nextImages;
    });
  };

  // 3. Save Mutation (POST /products or PATCH /products/:id)
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      let productRes;
      if (isEdit) {
        productRes = await api.patch(`/products/${id}`, payload);
      } else {
        productRes = await api.post('/products', payload);
      }
      const productId = productRes.data?.data?.id || productRes.data?.id || id;

      if (optionGroups.length > 0 && productId) {
        for (const group of optionGroups) {
          if (!group.name.trim()) continue;
          const groupPayload = {
            name: group.name.trim(),
            isRequired: group.isRequired,
            maxSelections: parseInt(group.maxSelections, 10) || 1,
          };
          let groupId = group.localId.startsWith('group_') ? undefined : group.localId;

          try {
            const groupRes = await api.post(`/products/${productId}/option-groups`, groupPayload);
            groupId = groupRes.data?.data?.id || groupRes.data?.id;
          } catch {
            // group may already exist if editing; skip
          }

          if (groupId && group.choices.length > 0) {
            for (const choice of group.choices) {
              if (!choice.label.trim()) continue;
              const choicePayload = {
                label: choice.label.trim(),
                additionalPrice: parseFloat(choice.additionalPrice) || 0,
                isAvailable: choice.isAvailable,
              };
              try {
                await api.post(`/products/${productId}/option-groups/${groupId}/choices`, choicePayload);
              } catch {
                // skip duplicate choices
              }
            }
          }
        }
      }

      return productRes.data;
    },
    onSuccess: () => {
      showToast(`${name} has been successfully saved.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['vendorProducts', user?.vendorProfile?.id] });
      router.replace('/(vendor)/products');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to save product details.', 'error');
    }
  });

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please specify product name.');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid base price.');
      return;
    }

    if (images.length === 0) {
      Alert.alert('Photo Required', 'Please upload at least one covers/ordered product image.');
      return;
    }

    const payload = {
      name: name.trim(),
      price: priceNum,
      category,
      description: description.trim(),
      images,
      vendorId: user?.vendorProfile?.id,
    };

    saveMutation.mutate(payload);
  };

  if (isFetchingProduct) {
    return (
      <SafeAreaView style={[styles.safeContainer, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>Fetching product details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.replace('/(vendor)/products')}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>
          {isEdit ? 'Edit Product' : 'Add Product'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Sub Header */}
        <View style={styles.subHeader}>
          <Text style={[TYPOGRAPHY.headlineXl, styles.title]}>
            {isEdit ? 'Modify Product' : 'New Product'}
          </Text>
          <Text style={[TYPOGRAPHY.body, styles.subtitle]}>
            {isEdit ? 'Update product pricing and listing images.' : 'Add details for your campus delivery item.'}
          </Text>
        </View>

        {/* Media Upload Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={[TYPOGRAPHY.subtitle, styles.sectionTitle]}>Product ordered images</Text>
            <Text style={[TYPOGRAPHY.labelMini, styles.badgeText]}>{images.length}/5</Text>
          </View>

          <View style={styles.mediaGrid}>
            {/* Display uploaded images */}
            {images.map((imgUrl, idx) => (
              <View key={idx} style={styles.imageSlot}>
                <Image source={{ uri: imgUrl }} style={styles.imagePreview} />
                {idx === 0 && (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverText}>MAIN</Text>
                  </View>
                )}
                <View style={styles.imageActionOverlay}>
                  {idx > 0 && (
                    <TouchableOpacity style={styles.promoteBtn} onPress={() => handlePromoteToCover(idx)}>
                      <Text style={styles.promoteBtnText}>Promote</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.deleteCircle} onPress={() => handleRemoveImage(idx)}>
                    <Text style={styles.deleteIconText}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Display upload trigger slots */}
            {images.length < 5 && (
              <TouchableOpacity
                style={[
                  styles.uploadTriggerBtn,
                  images.length === 0 ? styles.uploadTriggerBtnActive : styles.uploadTriggerBtnInactive
                ]}
                onPress={handlePickImage}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="camera" $$$ />
                    <Text style={[
                      TYPOGRAPHY.labelMini,
                      { color: images.length === 0 ? COLORS.primary : COLORS.secondary, marginTop: 4 }
                    ]}>
                      {images.length === 0 ? 'ADD COVER' : 'ADD PHOTO'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
          <Text style={[TYPOGRAPHY.muted, styles.uploadGuideline]}>
            * The first slot is designated as the MAIN Cover image (compatible with legacy views). Promote any image to set it as cover.
          </Text>
        </View>

        {/* Core Product Fields */}
        <View style={[styles.sectionCard, { gap: SPACING.stackMd }]}>
          {/* Name input */}
          <View style={styles.inputGroup}>
            <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>PRODUCT NAME</Text>
            <TextInput
              style={[TYPOGRAPHY.body, styles.textInput]}
              placeholder="e.g. Classic Beef Burger pack"
              placeholderTextColor={COLORS.outline}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Row of Price and Category */}
          <View style={styles.inputRow}>
            {/* Price */}
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>BASE PRICE (₦)</Text>
              <TextInput
                style={[TYPOGRAPHY.body, styles.textInput]}
                placeholder="4500"
                placeholderTextColor={COLORS.outline}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
            </View>

            {/* Category dropdown */}
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>CATEGORY</Text>
              <View style={styles.categoryPills}>
                <TouchableOpacity
                  style={[styles.categoryPill, category === 'food' && styles.categoryPillActive]}
                  onPress={() => setCategory('food')}
                >
                  <Text style={[styles.categoryPillText, category === 'food' && styles.categoryPillTextActive]}>Food</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.categoryPill, category === 'supplies' && styles.categoryPillActive]}
                  onPress={() => setCategory('supplies')}
                >
                  <Text style={[styles.categoryPillText, category === 'supplies' && styles.categoryPillTextActive]}>Supplies</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>PRODUCT DESCRIPTION</Text>
            <TextInput
              style={[TYPOGRAPHY.body, styles.textInput, styles.textArea]}
              placeholder="Describe ingredients, cooking guidelines, allergens, etc."
              placeholderTextColor={COLORS.outline}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Option Groups Section */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.optionGroupsToggle}
            onPress={() => setShowOptionGroups(!showOptionGroups)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.stackSm }}>
              <Ionicons name="settings" $$$ />
              <Text style={[TYPOGRAPHY.subtitle, { color: COLORS.onSurface, fontWeight: '700' }]}>
                Option Groups
              </Text>
              {optionGroups.length > 0 && (
                <View style={styles.optionCountBadge}>
                  <Text style={styles.optionCountText}>{optionGroups.length}</Text>
                </View>
              )}
            </View>
            <Ionicons
              name={showOptionGroups ? 'chevron-back' : 'chevron-forward'}
              size={18}
              color={COLORS.secondary}
              style={{ transform: [{ rotate: showOptionGroups ? '90deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {!showOptionGroups && (
            <TouchableOpacity
              style={styles.addOptionGroupPrompt}
              onPress={() => {
                setShowOptionGroups(true);
                if (optionGroups.length === 0) {
                  setOptionGroups([createEmptyGroup()]);
                }
              }}
            >
              <Ionicons name="add" $$$ />
              <Text style={[TYPOGRAPHY.body, { color: COLORS.primary, fontWeight: '600' }]}>
                Add customization options (size, toppings, etc.)
              </Text>
            </TouchableOpacity>
          )}

          {showOptionGroups && (
            <View style={{ gap: SPACING.stackMd, marginTop: SPACING.gutter }}>
              {optionGroups.map((group, gIdx) => (
                <View key={group.localId} style={styles.optionGroupCard}>
                  <View style={styles.optionGroupCardHeader}>
                    <Text style={[TYPOGRAPHY.labelMini, { color: COLORS.secondary }]}>
                      GROUP {gIdx + 1}
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteGroupBtn}
                      onPress={() => setOptionGroups(prev => prev.filter((_, i) => i !== gIdx))}
                    >
                      <Text style={styles.deleteGroupBtnText}>x</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>GROUP NAME</Text>
                    <TextInput
                      style={[TYPOGRAPHY.body, styles.textInput]}
                      placeholder="e.g. Size, Spice Level, Toppings"
                      placeholderTextColor={COLORS.outline}
                      value={group.name}
                      onChangeText={(text) => {
                        const updated = [...optionGroups];
                        updated[gIdx] = { ...updated[gIdx], name: text };
                        setOptionGroups(updated);
                      }}
                    />
                  </View>

                  <View style={styles.optionGroupOptions}>
                    <View style={styles.optionGroupToggleRow}>
                      <Text style={[TYPOGRAPHY.body, { color: COLORS.onSurface, fontWeight: '600' }]}>Required</Text>
                      <Switch
                        value={group.isRequired}
                        onValueChange={(val) => {
                          const updated = [...optionGroups];
                          updated[gIdx] = { ...updated[gIdx], isRequired: val };
                          setOptionGroups(updated);
                        }}
                        trackColor={{ false: COLORS.outline, true: COLORS.primary }}
                        thumbColor={COLORS.white}
                      />
                    </View>

                    <View style={styles.optionGroupInputRow}>
                      <Text style={[TYPOGRAPHY.body, { color: COLORS.onSurface, fontWeight: '600' }]}>Max Selections</Text>
                      <TextInput
                        style={[TYPOGRAPHY.body, styles.maxSelectionsInput]}
                        value={group.maxSelections}
                        onChangeText={(text) => {
                          const updated = [...optionGroups];
                          updated[gIdx] = { ...updated[gIdx], maxSelections: text };
                          setOptionGroups(updated);
                        }}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor={COLORS.outline}
                      />
                    </View>
                  </View>

                  <View style={styles.choicesSection}>
                    <View style={styles.choicesHeader}>
                      <Text style={[TYPOGRAPHY.labelMini, { color: COLORS.secondary }]}>
                        CHOICES ({group.choices.length})
                      </Text>
                      <TouchableOpacity
                        style={styles.addChoiceBtn}
                        onPress={() => {
                          const updated = [...optionGroups];
                          updated[gIdx] = {
                            ...updated[gIdx],
                            choices: [...updated[gIdx].choices, createEmptyChoice()],
                          };
                          setOptionGroups(updated);
                        }}
                      >
                        <Ionicons name="add" $$$ />
                        <Text style={styles.addChoiceBtnText}>Add Choice</Text>
                      </TouchableOpacity>
                    </View>

                    {group.choices.map((choice, cIdx) => (
                      <View key={choice.localId} style={styles.choiceItem}>
                        <View style={styles.choiceItemRow}>
                          <TextInput
                            style={[TYPOGRAPHY.body, styles.choiceInput]}
                            placeholder="Choice label (e.g. Large)"
                            placeholderTextColor={COLORS.outline}
                            value={choice.label}
                            onChangeText={(text) => {
                              const updated = [...optionGroups];
                              const choices = [...updated[gIdx].choices];
                              choices[cIdx] = { ...choices[cIdx], label: text };
                              updated[gIdx] = { ...updated[gIdx], choices };
                              setOptionGroups(updated);
                            }}
                          />
                          <View style={styles.choicePriceInput}>
                            <Text style={[TYPOGRAPHY.muted, { color: COLORS.outline }]}>+N</Text>
                            <TextInput
                              style={[TYPOGRAPHY.body, { flex: 1, color: COLORS.onSurface, padding: 0 }]}
                              placeholder="0"
                              placeholderTextColor={COLORS.outline}
                              value={choice.additionalPrice}
                              onChangeText={(text) => {
                                const updated = [...optionGroups];
                                const choices = [...updated[gIdx].choices];
                                choices[cIdx] = { ...choices[cIdx], additionalPrice: text };
                                updated[gIdx] = { ...updated[gIdx], choices };
                                setOptionGroups(updated);
                              }}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                        <View style={styles.choiceItemFooter}>
                          <View style={styles.choiceToggleRow}>
                            <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary }]}>Available</Text>
                            <Switch
                              value={choice.isAvailable}
                              onValueChange={(val) => {
                                const updated = [...optionGroups];
                                const choices = [...updated[gIdx].choices];
                                choices[cIdx] = { ...choices[cIdx], isAvailable: val };
                                updated[gIdx] = { ...updated[gIdx], choices };
                                setOptionGroups(updated);
                              }}
                              trackColor={{ false: COLORS.outline, true: COLORS.primary }}
                              thumbColor={COLORS.white}
                            />
                          </View>
                          <TouchableOpacity
                            style={styles.deleteChoiceBtn}
                            onPress={() => {
                              const updated = [...optionGroups];
                              updated[gIdx] = {
                                ...updated[gIdx],
                                choices: updated[gIdx].choices.filter((_, i) => i !== cIdx),
                              };
                              setOptionGroups(updated);
                            }}
                          >
                            <Text style={styles.deleteChoiceBtnText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addGroupBtn}
                onPress={() => {
                  setOptionGroups(prev => [...prev, createEmptyGroup()]);
                }}
              >
                <Ionicons name="add" $$$ />
                <Text style={[TYPOGRAPHY.subtitle, { color: COLORS.primary, fontWeight: '700' }]}>
                  Add Option Group
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Save Button Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator size="small" color={COLORS.onPrimary} />
          ) : (
            <>
              <Text style={[TYPOGRAPHY.subtitle, styles.saveBtnText]}>
                {isEdit ? 'Save Changes' : 'Create Product'}
              </Text>
              <Ionicons name="checkmark-circle" $$$ />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  closeBtn: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    color: COLORS.primary,
    fontWeight: '800',
    marginLeft: 8,
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackMd,
    paddingBottom: 100,
  },
  subHeader: {
    marginBottom: 4,
  },
  title: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.secondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  badgeText: {
    color: COLORS.outline,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.stackSm,
  },
  imageSlot: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: SHAPES.roundedMd,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  coverText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: '900',
  },
  imageActionOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promoteBtn: {
    backgroundColor: 'rgba(29, 30, 41, 0.85)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  promoteBtnText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: '800',
  },
  deleteCircle: {
    width: 16,
    height: 16,
    borderRadius: SHAPES.roundedDefault,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  uploadTriggerBtn: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: SHAPES.roundedMd,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadTriggerBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(187, 1, 20, 0.05)',
  },
  uploadTriggerBtnInactive: {
    borderColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  uploadGuideline: {
    color: COLORS.outline,
    fontSize: 10,
    marginTop: SPACING.gutter,
    lineHeight: 14,
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
    borderRadius: SHAPES.roundedMd,
    paddingHorizontal: 16,
    height: 48,
    color: COLORS.onSurface,
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.gutter,
  },
  categoryPills: {
    flexDirection: 'row',
    gap: 6,
    height: 48,
  },
  categoryPill: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedMd,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  categoryPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryPillText: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
  categoryPillTextActive: {
    color: COLORS.onPrimary,
  },
  textArea: {
    height: 100,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  optionGroupsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionCountBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  optionCountText: {
    color: COLORS.onPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  addOptionGroupPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedMd,
    padding: SPACING.gutter,
    marginTop: SPACING.gutter,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
  },
  optionGroupCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 10,
  },
  optionGroupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteGroupBtn: {
    width: 24,
    height: 24,
    borderRadius: SHAPES.roundedMd,
    backgroundColor: COLORS.errorContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteGroupBtnText: {
    color: COLORS.error,
    fontWeight: '800',
    fontSize: 12,
  },
  optionGroupOptions: {
    flexDirection: 'row',
    gap: SPACING.stackMd,
  },
  optionGroupToggleRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  optionGroupInputRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  maxSelectionsInput: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: SHAPES.roundedDefault,
    paddingHorizontal: 10,
    height: 28,
    width: 50,
    textAlign: 'center',
    color: COLORS.onSurface,
  },
  choicesSection: {
    marginTop: 4,
    gap: SPACING.stackSm,
  },
  choicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedDefault,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addChoiceBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  choiceItem: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 10,
    padding: 10,
    gap: SPACING.stackSm,
  },
  choiceItemRow: {
    flexDirection: 'row',
    gap: SPACING.stackSm,
    alignItems: 'center',
  },
  choiceInput: {
    flex: 2,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: SHAPES.roundedDefault,
    paddingHorizontal: 12,
    height: 38,
    color: COLORS.onSurface,
    fontSize: 13,
  },
  choicePriceInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: SHAPES.roundedDefault,
    paddingHorizontal: 10,
    height: 38,
    gap: 4,
  },
  choiceItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  choiceToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  deleteChoiceBtn: {
    backgroundColor: COLORS.errorContainer,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deleteChoiceBtnText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: 11,
  },
  addGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.stackSm,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedMd,
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
  },
});
