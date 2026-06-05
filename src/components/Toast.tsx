import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/context/ToastContext';
import { COLORS, TYPOGRAPHY, SHAPES, SHADOWS } from '@/constants/theme';

const TOAST_COLORS = {
  success: {
    bg: '#E6F9ED',
    border: '#22C55E',
    icon: '#22C55E',
    text: '#0D7D3E',
  },
  error: {
    bg: '#FFEBE9',
    border: '#EF4444',
    icon: '#EF4444',
    text: '#D1242F',
  },
  info: {
    bg: '#EBF5FB',
    border: '#3B82F6',
    icon: '#3B82F6',
    text: '#1D4ED8',
  },
};

function ToastIcon({ type }: { type: keyof typeof TOAST_COLORS }) {
  if (type === 'success') {
    return (
      <Text style={[styles.icon, { color: TOAST_COLORS.success.icon }]}>
        {'\u2713'}
      </Text>
    );
  }
  if (type === 'error') {
    return (
      <Text style={[styles.icon, { color: TOAST_COLORS.error.icon }]}>
        {'\u2715'}
      </Text>
    );
  }
  return (
    <Text style={[styles.icon, { color: TOAST_COLORS.info.icon }]}>
      {'\u2139'}
    </Text>
  );
}

export default function Toast() {
  const { currentToast, isVisible } = useToast();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-150);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (isVisible && currentToast) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      translateY.value = withTiming(-150, { duration: 300 });
      opacity.value = withTiming(0, { duration: 250 });
    }
  }, [isVisible, currentToast, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!currentToast) return null;

  const theme = TOAST_COLORS[currentToast.type];
  const topOffset = (StatusBar.currentHeight ?? 0) + insets.top + 8;

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        {
          top: topOffset,
          backgroundColor: theme.bg,
          borderColor: theme.border,
        },
      ]}
      pointerEvents="none"
    >
      <ToastIcon type={currentToast.type} />
      <Text style={[styles.message, { color: theme.text }]}>
        {currentToast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: SHAPES.roundedLg,
    borderWidth: 1,
    ...SHADOWS.appCard,
  },
  icon: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  message: {
    ...TYPOGRAPHY.body,
    flex: 1,
    fontWeight: '700',
  },
});
