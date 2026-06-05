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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useMutation } from '@tanstack/react-query';

type VendorType = 'FOOD' | 'SHOP';

export default function VendorSetup() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [types, setTypes] = useState<VendorType[]>([]);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const toggleType = (vt: VendorType) => {
    setTypes((prev) =>
      prev.includes(vt) ? prev.filter((t) => t !== vt) : [...prev, vt]
    );
  };

  // Logo pick & upload
  const handlePickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied',
        'Permission to access camera roll is required to select a logo.'
      );
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
      await handleUploadLogo(pickedAsset.uri);
    }
  };

  const handleUploadLogo = async (uri: string) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      const uriParts = uri.split('/');
      const fileName =
        uriParts[uriParts.length - 1] || 'vendor-logo.jpg';

      const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType =
        ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

      formData.append('image', {
        uri,
        name: fileName,
        type: mimeType,
      } as any);

      const res = await api.post('/admin/upload/vendor-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadedUrl =
        res.data?.url ||
        res.data?.data?.url ||
        res.data?.imageUrl ||
        res.data?.data;

      if (uploadedUrl) {
        setLogoUri(uploadedUrl);
      } else {
        throw new Error('Image URL was not returned in response.');
      }
    } catch (error: any) {
      console.error('Logo upload failed:', error);
      showToast(error.response?.data?.message || error.message || 'An error occurred during logo upload.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUri(null);
  };

  // Submit mutation
  const setupMutation = useMutation({
    mutationFn: async (payload: {
      businessName: string;
      address: string;
      description?: string;
      types: VendorType[];
      image?: string;
    }) => {
      const res = await api.post('/vendors/profile', payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      Alert.alert(
        "You're all set! 🎉",
        'Your vendor profile has been created. Start managing your store!',
        [
          {
            text: 'Go to Dashboard',
            onPress: () => router.replace('/(vendor)/dashboard'),
          },
        ]
      );
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Could not create vendor profile. Please try again.', 'error');
    },
  });

  const handleSubmit = () => {
    // Validate
    if (!businessName.trim()) {
      Alert.alert('Required', 'Business name is required.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Required', 'Business address is required.');
      return;
    }
    if (types.length === 0) {
      Alert.alert(
        'Required',
        'Please select at least one vendor type (Food or Shop).'
      );
      return;
    }

    const payload: {
      businessName: string;
      address: string;
      description?: string;
      types: VendorType[];
      image?: string;
    } = {
      businessName: businessName.trim(),
      address: address.trim(),
      types,
    };

    if (description.trim()) {
      payload.description = description.trim();
    }

    if (logoUri) {
      payload.image = logoUri;
    }

    setupMutation.mutate(payload);
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/(vendor)/dashboard')}
        >
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>
          Vendor Setup
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro Section */}
        <View style={styles.introSection}>
          <Text style={[TYPOGRAPHY.headlineXl, styles.title]}>
            Set Up Your Store
          </Text>
          <Text style={[TYPOGRAPHY.body, styles.subtitle]}>
            Tell JABU students about your business. Fill in the details below to
            start receiving orders.
          </Text>
        </View>

        {/* Logo Upload Section */}
        <View style={[styles.sectionCard, { alignItems: 'center' }]}>
          <Text style={[TYPOGRAPHY.subtitle, { fontWeight: '700', color: COLORS.onSurface, alignSelf: 'flex-start' }]}>
            Store Logo
          </Text>

          <View style={styles.logoContainer}>
            {logoUri ? (
              <View style={styles.logoPreviewWrapper}>
                <Image source={{ uri: logoUri }} style={styles.logoPreview} />
                <TouchableOpacity
                  style={styles.logoRemoveBtn}
                  onPress={handleRemoveLogo}
                >
                  <Text style={styles.logoRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="storefront" size={32} color={COLORS.outline} />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.uploadBtn,
              logoUri ? styles.uploadBtnReplace : styles.uploadBtnPrimary,
            ]}
            onPress={handlePickLogo}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="camera" $$$ />
                <Text
                  style={[
                    TYPOGRAPHY.labelMini,
                    {
                      color: logoUri ? COLORS.secondary : COLORS.primary,
                      marginLeft: 6,
                    },
                  ]}
                >
                  {logoUri ? 'CHANGE LOGO' : 'UPLOAD LOGO'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={[TYPOGRAPHY.muted, { color: COLORS.outline, marginTop: 8, textAlign: 'center' }]}>
            Recommended: square image, at least 500x500px
          </Text>
        </View>

        {/* Core Business Fields */}
        <View style={[styles.sectionCard, { gap: SPACING.stackMd }]}>
          {/* Business Name */}
          <View style={styles.inputGroup}>
            <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>
              BUSINESS NAME *
            </Text>
            <TextInput
              style={[TYPOGRAPHY.body, styles.textInput]}
              placeholder="e.g. Classic Bites Cafeteria"
              placeholderTextColor={COLORS.outline}
              value={businessName}
              onChangeText={setBusinessName}
              maxLength={100}
            />
          </View>

          {/* Address */}
          <View style={styles.inputGroup}>
            <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>
              BUSINESS ADDRESS *
            </Text>
            <TextInput
              style={[TYPOGRAPHY.body, styles.textInput]}
              placeholder="e.g. Science Complex Block A, Room 12"
              placeholderTextColor={COLORS.outline}
              value={address}
              onChangeText={setAddress}
              maxLength={200}
            />
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={[TYPOGRAPHY.labelMini, styles.fieldLabel]}>
              DESCRIPTION (OPTIONAL)
            </Text>
            <TextInput
              style={[TYPOGRAPHY.body, styles.textInput, styles.textArea]}
              placeholder="Describe what you sell, your specialties, etc."
              placeholderTextColor={COLORS.outline}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>
        </View>

        {/* Vendor Types Selection */}
        <View style={styles.sectionCard}>
          <Text style={[TYPOGRAPHY.subtitle, { fontWeight: '700', color: COLORS.onSurface, marginBottom: 12 }]}>
            Vendor Type *
          </Text>
          <Text style={[TYPOGRAPHY.muted, { color: COLORS.secondary, marginBottom: 12 }]}>
            Select all that apply to your business
          </Text>

          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[
                styles.typePill,
                types.includes('FOOD') && styles.typePillActive,
              ]}
              onPress={() => toggleType('FOOD')}
            >
              <Text style={{ fontSize: 24 }}>🍔</Text>
              <Text
                style={[
                  TYPOGRAPHY.subtitle,
                  types.includes('FOOD')
                    ? styles.typePillTextActive
                    : styles.typePillText,
                ]}
              >
                Food & Drinks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typePill,
                types.includes('SHOP') && styles.typePillActive,
              ]}
              onPress={() => toggleType('SHOP')}
            >
              <Text style={{ fontSize: 24 }}>🛍️</Text>
              <Text
                style={[
                  TYPOGRAPHY.subtitle,
                  types.includes('SHOP')
                    ? styles.typePillTextActive
                    : styles.typePillText,
                ]}
              >
                Shop / Supplies
              </Text>
            </TouchableOpacity>
          </View>

          {types.length > 0 && (
            <View style={styles.selectedTypesRow}>
              <Text style={[TYPOGRAPHY.labelMini, { color: COLORS.secondary }]}>
                Selected:{' '}
              </Text>
              {types.map((t) => (
                <View key={t} style={styles.selectedTag}>
                  <Text style={styles.selectedTagText}>
                    {t === 'FOOD' ? 'Food' : 'Shop'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Spacer for footer */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Save Button Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSubmit}
          disabled={setupMutation.isPending}
        >
          {setupMutation.isPending ? (
            <ActivityIndicator size="small" color={COLORS.onPrimary} />
          ) : (
            <>
              <Text style={[TYPOGRAPHY.subtitle, styles.saveBtnText]}>
                Complete Setup
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
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.stackMd,
    paddingBottom: 60,
  },
  introSection: {
    marginBottom: 4,
  },
  title: {
    color: COLORS.onSurface,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.secondary,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  logoContainer: {
    marginTop: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.divider,
    borderStyle: 'dashed',
  },
  logoPreviewWrapper: {
    position: 'relative',
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  logoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  logoRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: SHAPES.roundedMd,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRemoveText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: SHAPES.roundedMd,
  },
  uploadBtnPrimary: {
    backgroundColor: 'rgba(187, 1, 20, 0.08)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  uploadBtnReplace: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
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
  textArea: {
    height: 100,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    gap: SPACING.gutter,
  },
  typePill: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: SHAPES.roundedCard,
    paddingVertical: 16,
    alignItems: 'center',
    gap: SPACING.stackSm,
    borderWidth: 2,
    borderColor: COLORS.divider,
  },
  typePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typePillText: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 13,
  },
  typePillTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  selectedTypesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.gutter,
    flexWrap: 'wrap',
  },
  selectedTag: {
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: SHAPES.roundedDefault,
  },
  selectedTagText: {
    color: COLORS.onPrimaryContainer,
    fontSize: 11,
    fontWeight: '700',
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
});
