import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'order' | 'payment' | 'system' | 'delivery';
  orderId?: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<Notification['type'], string> = {
  order: '📦',
  payment: '💳',
  system: '⚙️',
  delivery: '🚚',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export default function Notifications() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'unread' | 'all'>('unread');
  const [refreshing, setRefreshing] = useState(false);

  const unreadOnly = activeTab === 'unread';

  const {
    data: notifications = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Notification[]>({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => {
      const response = await api.get('/notifications', {
        params: { unreadOnly },
      });
      return response.data?.data ?? response.data ?? [];
    },
    staleTime: 5000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      if (!notification.isRead) {
        await markReadMutation.mutateAsync(notification.id);
      }
      if (notification.orderId) {
        router.push(`/(customer)/order/${notification.orderId}`);
      }
    },
    [markReadMutation, router],
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/(customer)/home')}
        >
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <Text style={styles.markAllText}>
              {markAllReadMutation.isPending ? 'Marking...' : 'Mark All Read'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'unread' && styles.tabActive]}
          onPress={() => setActiveTab('unread')}
        >
          <Text
            style={[
              TYPOGRAPHY.subtitle,
              styles.tabText,
              activeTab === 'unread' && styles.tabTextActive,
            ]}
          >
            Unread
          </Text>
          {unreadCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            style={[
              TYPOGRAPHY.subtitle,
              styles.tabText,
              activeTab === 'all' && styles.tabTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[TYPOGRAPHY.muted, { marginTop: SPACING.gutter }]}>
              Loading notifications...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="warning" $$$ />
            <Text style={[TYPOGRAPHY.body, { color: COLORS.primary, marginTop: SPACING.gutter }]}>
              Failed to load notifications
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="mail" $$$ />
            <Text style={[TYPOGRAPHY.subtitle, { color: COLORS.secondary, marginTop: SPACING.gutter }]}>
              {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
            </Text>
            <Text
              style={[
                TYPOGRAPHY.muted,
                { textAlign: 'center', marginTop: 4, paddingHorizontal: 40 },
              ]}
            >
              {activeTab === 'unread'
                ? "You're all caught up! Switch to All to see older alerts."
                : 'Order updates, delivery pings, and system alerts will appear here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.isRead && styles.notificationCardUnread,
                ]}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationIconContainer}>
                  <Text style={styles.notificationTypeIcon}>
                    {TYPE_ICONS[notification.type] || '🔔'}
                  </Text>
                </View>

                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text
                      style={[
                        TYPOGRAPHY.subtitle,
                        styles.notificationTitle,
                        !notification.isRead && styles.notificationTitleUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {notification.title}
                    </Text>
                    <Text style={[TYPOGRAPHY.labelMini, styles.notificationTime]}>
                      {timeAgo(notification.createdAt)}
                    </Text>
                  </View>
                  <Text
                    style={[TYPOGRAPHY.body, styles.notificationBody]}
                    numberOfLines={2}
                  >
                    {notification.body}
                  </Text>
                  <View style={styles.notificationMeta}>
                    <Text style={[TYPOGRAPHY.labelMini, styles.typeLabel]}>
                      {notification.type.charAt(0).toUpperCase() +
                        notification.type.slice(1)}
                    </Text>
                    {notification.orderId && (
                      <Text style={[TYPOGRAPHY.labelMini, styles.orderIdLabel]}>
                        Order #{String(notification.orderId).slice(-6).toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>

                {!notification.isRead && (
                  <View style={styles.unreadDot} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
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
    color: COLORS.onSurface,
    fontWeight: '800',
    flex: 1,
    marginLeft: 8,
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  markAllText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.pagePadding,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.stackSm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: SHAPES.roundedCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  tabActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  tabText: {
    fontWeight: '600',
    color: COLORS.secondary,
    fontSize: 13,
  },
  tabTextActive: {
    color: COLORS.onSecondary,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    color: COLORS.onPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    paddingBottom: 40,
    flexGrow: 1,
  },
  centerContainer: {
    paddingVertical: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    ...SHADOWS.appCard,
  },
  retryText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  notificationsList: {
    gap: 10,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    ...SHADOWS.appCard,
    position: 'relative',
  },
  notificationCardUnread: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.white,
  },
  notificationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: SHAPES.roundedMd,
    backgroundColor: COLORS.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationTypeIcon: {
    fontSize: 22,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notificationTitle: {
    fontWeight: '600',
    color: COLORS.onSurface,
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  notificationTitleUnread: {
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  notificationTime: {
    color: COLORS.outline,
    fontSize: 10,
  },
  notificationBody: {
    color: COLORS.secondary,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  notificationMeta: {
    flexDirection: 'row',
    gap: SPACING.stackSm,
    marginTop: 6,
    alignItems: 'center',
  },
  typeLabel: {
    color: COLORS.outline,
    fontSize: 10,
    fontWeight: '600',
  },
  orderIdLabel: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
});
