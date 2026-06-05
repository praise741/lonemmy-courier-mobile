import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const MANAGEMENT_ITEMS: { label: string; route: string; icon: string; description: string }[] = [
  { label: 'Users', route: '/(admin)/users', icon: 'person', description: 'Manage all platform users' },
  { label: 'Vendors', route: '/(admin)/vendors', icon: 'store', description: 'Manage campus food & shop vendors' },
  { label: 'Couriers', route: '/(admin)/couriers', icon: 'car', description: 'Manage delivery personnel' },
  { label: 'Orders', route: '/(admin)/orders', icon: 'cart', description: 'View & manage all orders' },
  { label: 'Payouts', route: '/(admin)/payouts', icon: 'cash', description: 'Manage vendor & courier payouts' },
  { label: 'Locations', route: '/(admin)/locations', icon: 'home', description: 'Manage campus delivery locations' },
  { label: 'Settings', route: '/(admin)/settings', icon: 'settings', description: 'Platform configuration' },
];

export default function AdminManagement() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Management</Text>
        <Text style={[TYPOGRAPHY.muted, styles.headerSubtitle]}>Platform administration tools</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {MANAGEMENT_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.card}
            onPress={() => router.push(item.route)}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={item.icon as any} size={22} color={COLORS.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={[TYPOGRAPHY.subtitle, styles.cardLabel]}>{item.label}</Text>
              <Text style={[TYPOGRAPHY.muted, styles.cardDescription]}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.outline} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.pagePadding,
    paddingBottom: SPACING.stackSm,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: COLORS.outline,
    marginTop: 2,
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    gap: SPACING.gutter,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: SPACING.pagePadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: SHAPES.roundedMd,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  cardDescription: {
    color: COLORS.outline,
    marginTop: 2,
  },
});
