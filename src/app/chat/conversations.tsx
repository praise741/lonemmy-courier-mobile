import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ChatConversations() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, user: currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats');
  const [search, setSearch] = useState('');
  
  // Real-time simulated typing state
  const [typingChannelId, setTypingChannelId] = useState<string | null>(null);

  // Fetch active conversations
  const {
    data: conversations = [],
    isLoading: isLoadingChats,
    isRefetching: isRefetchingChats,
    refetch: refetchChats,
  } = useQuery<any[]>({
    queryKey: ['chatConversations'],
    queryFn: async () => {
      const res = await api.get('/chat/conversations');
      return res.data?.data ?? res.data ?? [];
    },
    enabled: !!token,
  });

  // Fetch contacts
  const {
    data: contacts = [],
    isLoading: isLoadingContacts,
    isRefetching: isRefetchingContacts,
    refetch: refetchContacts,
  } = useQuery<any[]>({
    queryKey: ['chatContacts'],
    queryFn: async () => {
      const res = await api.get('/chat/contacts');
      return res.data?.data ?? res.data ?? [];
    },
    enabled: !!token,
  });

  // Socket connection to handle live updates
  useEffect(() => {
    if (!token) return;

    const socket = io('https://lonemmy-courier-api.pxxl.click/chat', {
      auth: {
        token: 'Bearer ' + token,
      },
    });

    socket.on('connect', () => {
      console.log('Conversations socket connected');
    });

    // Handle real-time updates and invalidate queries
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
    };

    socket.on('chat:conversation-updated', handleUpdate);
    socket.on('chat:unread-updated', handleUpdate);
    socket.on('chat:message', handleUpdate);

    return () => {
      socket.off('chat:conversation-updated', handleUpdate);
      socket.off('chat:unread-updated', handleUpdate);
      socket.off('chat:message', handleUpdate);
      socket.disconnect();
    };
  }, [token, queryClient]);

  // Simulate typing states for high fidelity
  useEffect(() => {
    if (conversations.length === 0) return;
    
    // Periodically simulate a user typing for 3 seconds to show premium interaction
    const interval = setInterval(() => {
      const randomConv = conversations[Math.floor(Math.random() * conversations.length)];
      if (randomConv) {
        setTypingChannelId(randomConv.conversationKey);
        setTimeout(() => {
          setTypingChannelId(null);
        }, 3000);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [conversations]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback based on user role
      if (currentUser?.role === 'CUSTOMER') {
        router.replace('/(customer)/home');
      } else if (currentUser?.role === 'COURIER') {
        router.replace('/(courier)/dashboard');
      } else if (currentUser?.role === 'VENDOR') {
        router.replace('/(vendor)/dashboard');
      } else {
        router.replace('/(auth)/login');
      }
    }
  };

  const handleOpenChat = (conversation: any) => {
    const otherUser = conversation.participants?.[0] || conversation.lastMessage?.sender;
    
    // Invalidate conversations to instantly clear unread visually
    queryClient.setQueryData(['chatConversations'], (prev: any[] | undefined) => {
      if (!prev) return prev;
      return prev.map((c) =>
        c.conversationKey === conversation.conversationKey
          ? { ...c, unreadCount: 0 }
          : c
      );
    });

    if (conversation.orderId) {
      router.push({
        pathname: `/chat/${conversation.orderId}`,
        params: {
          orderId: conversation.orderId,
          otherUserId: otherUser?.id,
          name: otherUser?.name ?? 'Order Chat',
          role: otherUser?.role ?? 'COURIER',
        },
      });
    } else {
      router.push({
        pathname: `/chat/${otherUser?.id}`,
        params: {
          otherUserId: otherUser?.id,
          name: otherUser?.name ?? 'Direct Chat',
          role: otherUser?.role ?? 'COURIER',
        },
      });
    }
  };

  const handleStartDirectChat = (contact: any) => {
    router.push({
      pathname: `/chat/${contact.id}`,
      params: {
        otherUserId: contact.id,
        name: contact.name,
        role: contact.role,
      },
    });
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getInitials = (nameStr: string) => {
    if (!nameStr) return '?';
    return nameStr
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Filter logic
  const filteredChats = conversations.filter((c) => {
    const otherUser = c.participants?.[0] || c.lastMessage?.sender;
    const nameMatch = (otherUser?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const contentMatch = (c.lastMessage?.content ?? '').toLowerCase().includes(search.toLowerCase());
    const orderMatch = (c.orderId ?? '').toLowerCase().includes(search.toLowerCase());
    return nameMatch || contentMatch || orderMatch;
  });

  const filteredContacts = contacts.filter((contact) =>
    (contact.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const onRefresh = () => {
    if (activeTab === 'chats') {
      refetchChats();
    } else {
      refetchContacts();
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" $$$ />
        </TouchableOpacity>
        <Text style={[TYPOGRAPHY.headlineLg, styles.headerTitle]}>Inbox Messages</Text>
      </View>

      {/* Custom Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'chats' && styles.tabButtonActive]}
          onPress={() => setActiveTab('chats')}
        >
          <Text style={[styles.tabText, activeTab === 'chats' && styles.tabTextActive]}>Conversations</Text>
          {conversations.some((c: any) => c.unreadCount > 0) && (
            <View style={styles.tabBadge} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'contacts' && styles.tabButtonActive]}
          onPress={() => setActiveTab('contacts')}
        >
          <Text style={[styles.tabText, activeTab === 'contacts' && styles.tabTextActive]}>Contacts</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="settings" $$$ />
          <TextInput
            style={[TYPOGRAPHY.body, styles.searchInput]}
            placeholder={activeTab === 'chats' ? "Search active chats..." : "Search contacts..."}
            placeholderTextColor={COLORS.outline}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Main List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={activeTab === 'chats' ? isLoadingChats && isRefetchingChats : isLoadingContacts && isRefetchingContacts}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {activeTab === 'chats' ? (
          isLoadingChats && !isRefetchingChats ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading conversations...</Text>
            </View>
          ) : filteredChats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={[TYPOGRAPHY.subtitle, styles.emptyTitle]}>No conversations yet</Text>
              <Text style={[TYPOGRAPHY.body, styles.emptyText]}>
                {search ? "No conversations match your search." : "Start chatting by selecting a contact from the Contacts tab."}
              </Text>
            </View>
          ) : (
            <View style={styles.channelList}>
              {filteredChats.map((conv) => {
                const otherUser = conv.participants?.[0] || conv.lastMessage?.sender;
                const otherUserName = otherUser?.name ?? 'Chat Room';
                const hasUnread = conv.unreadCount > 0;
                const isTyping = typingChannelId === conv.conversationKey;

                return (
                  <TouchableOpacity
                    key={conv.conversationKey}
                    style={[
                      styles.channelCard,
                      hasUnread ? styles.channelCardUnread : styles.channelCardRead,
                    ]}
                    onPress={() => handleOpenChat(conv)}
                  >
                    {/* Avatar circle */}
                    <View style={styles.avatarContainer}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{getInitials(otherUserName)}</Text>
                      </View>
                      {hasUnread && <View style={styles.unreadPulseDot} />}
                    </View>

                    {/* Message Details */}
                    <View style={styles.channelDetails}>
                      <View style={styles.channelTopRow}>
                        <Text style={[TYPOGRAPHY.subtitle, styles.channelName]} numberOfLines={1}>
                          {otherUserName}
                        </Text>
                        <Text
                          style={[
                            TYPOGRAPHY.muted,
                            hasUnread ? { color: COLORS.primary, fontWeight: '700' } : { color: COLORS.outline },
                          ]}
                        >
                          {formatTimeAgo(conv.lastMessage?.createdAt)}
                        </Text>
                      </View>

                      <View style={styles.channelBottomRow}>
                        {isTyping ? (
                          <Text style={[TYPOGRAPHY.body, styles.msgTyping]} numberOfLines={1}>
                            typing...
                          </Text>
                        ) : (
                          <Text
                            style={[
                              TYPOGRAPHY.body,
                              hasUnread ? styles.msgUnread : styles.msgRead,
                            ]}
                            numberOfLines={1}
                          >
                            {conv.lastMessage?.senderId === currentUser?.id ? 'You: ' : ''}
                            {conv.lastMessage?.content}
                          </Text>
                        )}
                        
                        <View style={styles.rowRightInfo}>
                          {hasUnread && (
                            <View style={styles.unreadCountBadge}>
                              <Text style={styles.unreadCountBadgeText}>{conv.unreadCount}</Text>
                            </View>
                          )}
                          {conv.orderId && (
                            <View style={styles.orderLabel}>
                              <Text style={styles.orderLabelText}>ORD-{conv.orderId.slice(-4).toUpperCase()}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        ) : (
          isLoadingContacts && !isRefetchingContacts ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading contacts...</Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={[TYPOGRAPHY.subtitle, styles.emptyTitle]}>No contacts found</Text>
              <Text style={[TYPOGRAPHY.body, styles.emptyText]}>
                {search ? "No contacts match your search query." : "You do not have any contacts available yet."}
              </Text>
            </View>
          ) : (
            <View style={styles.channelList}>
              {filteredContacts.map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  style={styles.contactCard}
                  onPress={() => handleStartDirectChat(contact)}
                >
                  <View style={styles.avatarCircleContact}>
                    <Text style={styles.avatarTextContact}>{getInitials(contact.name)}</Text>
                  </View>
                  <View style={styles.contactDetails}>
                    <Text style={[TYPOGRAPHY.subtitle, styles.contactName]}>{contact.name}</Text>
                    <View style={styles.roleContainer}>
                      <Text style={styles.roleText}>{contact.role}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" $$$ />
                </TouchableOpacity>
              ))}
            </View>
          )
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
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.outline,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  searchSection: {
    paddingHorizontal: SPACING.pagePadding,
    paddingTop: SPACING.stackMd,
    paddingBottom: 4,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.divider,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.onSurface,
  },
  scrollContent: {
    padding: SPACING.pagePadding,
    paddingBottom: 32,
  },
  loadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  loadingText: {
    color: COLORS.outline,
  },
  emptyContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.outline,
    textAlign: 'center',
  },
  channelList: {
    gap: SPACING.gutter,
  },
  channelCard: {
    flexDirection: 'row',
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    alignItems: 'center',
    gap: SPACING.gutter,
    ...SHADOWS.appCard,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  channelCardUnread: {
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  channelCardRead: {
    backgroundColor: COLORS.surfaceContainerLowest,
    opacity: 0.9,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: SHAPES.roundedXl,
    backgroundColor: COLORS.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: '700',
    color: COLORS.secondary,
    fontSize: 15,
  },
  unreadPulseDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.surfaceContainerLowest,
  },
  channelDetails: {
    flex: 1,
    gap: 4,
  },
  channelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: SPACING.stackSm,
  },
  channelName: {
    fontWeight: '700',
    color: COLORS.onSurface,
    flex: 1,
  },
  channelBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  msgUnread: {
    color: COLORS.onSurface,
    fontWeight: '600',
    flex: 1,
  },
  msgRead: {
    color: COLORS.outline,
    flex: 1,
  },
  msgTyping: {
    color: COLORS.primary,
    fontWeight: '600',
    fontStyle: 'italic',
    flex: 1,
  },
  rowRightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadCountBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCountBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  orderLabel: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  orderLabelText: {
    fontSize: 8,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedCard,
    padding: 14,
    gap: SPACING.gutter,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.appCard,
  },
  avatarCircleContact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextContact: {
    fontWeight: '700',
    color: COLORS.secondary,
    fontSize: 14,
  },
  contactDetails: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  contactName: {
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  roleContainer: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceContainerLow,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.outline,
  },
});
