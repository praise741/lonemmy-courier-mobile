import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Message {
  id: string;
  content: string;
  senderId: string;
  recipientId: string;
  orderId?: string | null;
  createdAt: string;
  isRead?: boolean;
  sender: {
    id: string;
    name: string;
    role: string;
  };
  isOptimistic?: boolean;
}

export default function ChatRoomDetail() {
  const router = useRouter();
  const { id: routeId, orderId: queryOrderId, otherUserId: queryOtherUserId, name: queryName, role: queryRole } = useLocalSearchParams();
  const { token, user: currentUser } = useAuth();
  
  // Resolve conversation context
  const orderId = (queryOrderId as string) || (routeId?.toString().startsWith('order:') ? routeId.toString().replace('order:', '') : null);
  const otherUserId = (queryOtherUserId as string) || (!orderId ? routeId?.toString() : null);
  const displayName = (queryName as string) || 'Chat Room';
  const displayRole = (queryRole as string) || '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [resolvedRecipientId, setResolvedRecipientId] = useState<string | null>(otherUserId);
  const [isTyping, setIsTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // 1. Fetch History on Mount
  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    const loadHistory = async () => {
      try {
        setIsLoading(true);
        let endpoint = '';
        if (orderId) {
          endpoint = `/chat/${orderId}/history`;
        } else if (otherUserId) {
          endpoint = `/chat/history/${otherUserId}`;
        }

        if (endpoint) {
          const res = await api.get(endpoint);
          const history = res.data?.data ?? res.data ?? [];
          
          if (isMounted) {
            setMessages(history);
            
            // If in an order chat and other user ID was not passed, resolve recipient from messages
            if (orderId && !otherUserId && history.length > 0) {
              const incomingMsg = history.find((msg: Message) => msg.senderId !== currentUser?.id);
              if (incomingMsg) {
                setResolvedRecipientId(incomingMsg.senderId);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadHistory();

    // 2. Mark conversation as read
    const markAsRead = async () => {
      try {
        if (orderId) {
          await api.patch(`/chat/${orderId}/read`);
        } else if (otherUserId) {
          await api.patch(`/chat/read/${otherUserId}`);
        }
      } catch (err) {
        console.error('Failed to mark chat as read:', err);
      }
    };
    
    markAsRead();

    return () => {
      isMounted = false;
    };
  }, [orderId, otherUserId, token, currentUser?.id]);

  // 3. Connect to Socket.io namespace /chat
  useEffect(() => {
    if (!token) return;

    const socket = io('https://lonemmy-courier-api.pxxl.click/chat', {
      auth: {
        token: 'Bearer ' + token,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Chat room socket connected');
      
      // Join order room if orderId exists
      if (orderId) {
        socket.emit('chat:join-order', { orderId });
      }
    });

    // Handle real-time incoming messages
    socket.on('chat:message', (message: Message) => {
      console.log('Received socket message:', message);

      // Check if message belongs to this conversation
      const isCurrentConversation = orderId
        ? message.orderId === orderId
        : !message.orderId &&
          ((message.senderId === otherUserId && message.recipientId === currentUser?.id) ||
           (message.senderId === currentUser?.id && message.recipientId === otherUserId));

      if (isCurrentConversation) {
        setMessages((prev) => {
          // Avoid duplicate appends if we sent it and already added it
          if (prev.some((m) => m.id === message.id)) {
            return prev;
          }
          // Remove optimistic message if matching payload is received
          const filtered = prev.filter((m) => !(m.isOptimistic && m.content === message.content));
          return [...filtered, message];
        });

        // Resolve recipient if it was unknown
        if (orderId && !resolvedRecipientId && message.senderId !== currentUser?.id) {
          setResolvedRecipientId(message.senderId);
        }

        // Live mark read
        if (message.senderId !== currentUser?.id) {
          if (orderId) {
            api.patch(`/chat/${orderId}/read`).catch(console.error);
          } else if (otherUserId) {
            api.patch(`/chat/read/${otherUserId}`).catch(console.error);
          }
        }
      }
    });

    return () => {
      if (orderId) {
        socket.emit('chat:leave-order', { orderId });
      }
      socket.disconnect();
    };
  }, [orderId, otherUserId, token, currentUser?.id, resolvedRecipientId]);

  // Scroll to bottom when messages load/change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // 4. Submit message
  const handleSend = async () => {
    if (!inputText.trim() || !token || !currentUser) return;

    // Recipient must be known
    const recipientId = resolvedRecipientId;
    if (!recipientId) {
      console.warn('Recipient ID not resolved yet');
      return;
    }

    const content = inputText.trim();
    setInputText('');

    // Generate optimistic message representation
    const tempId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      content,
      senderId: currentUser.id,
      recipientId,
      orderId,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
      },
      isOptimistic: true,
    };

    // Optimistic Update
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      setIsSending(true);

      // Perform HTTP POST as requested
      const response = await api.post('/chat/send', {
        recipientId,
        content,
        orderId: orderId || undefined,
      });

      const savedMessage = response.data?.data ?? response.data;

      // Also Emit Socket Event as requested
      if (socketRef.current?.connected) {
        socketRef.current.emit('chat:message', {
          recipientId,
          content,
          orderId: orderId || null,
        });
      }

      // Replace optimistic message with saved database message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...savedMessage, isOptimistic: false } : m))
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      // Mark optimistic message as failed/remove or alert
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/chat/conversations');
    }
  };

  const formatMessageTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
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

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUser?.id;
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
        {!isMe && (
          <View style={styles.bubbleAvatarCircle}>
            <Text style={styles.bubbleAvatarText}>{getInitials(item.sender.name)}</Text>
          </View>
        )}
        <View style={styles.bubbleWrapper}>
          {!isMe && orderId && (
            <Text style={styles.bubbleSenderName}>
              {item.sender.name} <Text style={styles.bubbleSenderRole}>({item.sender.role})</Text>
            </Text>
          )}
          <View
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleOther,
              item.isOptimistic && styles.bubbleOptimistic,
            ]}
          >
            <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextOther]}>
              {item.content}
            </Text>
          </View>
          <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeOther]}>
            {formatMessageTime(item.createdAt)}
            {item.isOptimistic && ' • Sending...'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" $$$ />
          </TouchableOpacity>
          
          <View style={styles.headerDetails}>
            <Text style={[TYPOGRAPHY.subtitle, styles.headerTitle]} numberOfLines={1}>
              {displayName}
            </Text>
            {displayRole ? (
              <Text style={[TYPOGRAPHY.muted, styles.headerSubtitle]}>{displayRole}</Text>
            ) : null}
          </View>
          
          {orderId && (
            <View style={styles.orderLabel}>
              <Text style={styles.orderLabelText}>ORD-{orderId.slice(-4).toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Order Sticky Banner */}
        {orderId && (
          <View style={styles.orderStickyBanner}>
            <View style={styles.orderBadge}>
              <Text style={styles.orderBadgeText}>Active Delivery Chat</Text>
            </View>
            <Text style={styles.orderBannerDesc}>
              This chat is linked to order <Text style={styles.boldText}>#{orderId.slice(-8).toUpperCase()}</Text>. All active delivery partners can read messages.
            </Text>
          </View>
        )}

        {/* Messages List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[TYPOGRAPHY.body, styles.loadingText]}>Loading chat history...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="camera" $$$ />
          </TouchableOpacity>
          
          <TextInput
            style={[TYPOGRAPHY.body, styles.textInput]}
            placeholder="Type your message here..."
            placeholderTextColor={COLORS.outline}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          
          <TouchableOpacity
            style={[
              styles.sendBtn,
              !inputText.trim() && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="chevron-forward" $$$ />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
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
  headerDetails: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  headerTitle: {
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  headerSubtitle: {
    color: COLORS.outline,
    fontSize: 11,
    marginTop: -2,
  },
  orderLabel: {
    backgroundColor: COLORS.surfaceContainer,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: SHAPES.roundedDefault,
  },
  orderLabelText: {
    fontSize: 10,
    color: COLORS.secondary,
    fontWeight: '800',
  },
  orderStickyBanner: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  orderBadge: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  orderBadgeText: {
    fontSize: 8,
    color: COLORS.white,
    fontWeight: '800',
  },
  orderBannerDesc: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.secondary,
  },
  boldText: {
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: SPACING.pagePadding,
    paddingVertical: 16,
    gap: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.gutter,
  },
  loadingText: {
    color: COLORS.outline,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.stackSm,
    maxWidth: '85%',
  },
  messageRowMe: {
    alignSelf: 'flex-end',
  },
  messageRowOther: {
    alignSelf: 'flex-start',
  },
  bubbleAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.stackMd, // Align with bubble bottom
  },
  bubbleAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  bubbleWrapper: {
    flexDirection: 'column',
    gap: 2,
  },
  bubbleSenderName: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.outline,
    marginLeft: 4,
    marginBottom: 2,
  },
  bubbleSenderRole: {
    fontWeight: '500',
    fontSize: 9,
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  bubbleOptimistic: {
    opacity: 0.6,
  },
  bubbleText: {
    ...TYPOGRAPHY.body,
    lineHeight: 18,
  },
  bubbleTextMe: {
    color: COLORS.white,
  },
  bubbleTextOther: {
    color: COLORS.onSurface,
  },
  bubbleTime: {
    fontSize: 9,
    color: COLORS.outline,
    marginTop: 2,
  },
  bubbleTimeMe: {
    alignSelf: 'flex-end',
  },
  bubbleTimeOther: {
    alignSelf: 'flex-start',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: SPACING.stackSm,
  },
  iconButton: {
    padding: 6,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.divider,
    borderRadius: SHAPES.roundedCard,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    color: COLORS.onSurface,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
