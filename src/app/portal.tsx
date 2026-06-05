import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Fast Campus Delivery',
    description: 'Craving food from the cafeteria or need items from the shop? Order now and get them in minutes!',
    icon: 'fast-food' as const,
    illustrationColor: COLORS.surfaceContainer,
  },
  {
    title: 'Track in Real-Time',
    description: 'Watch your delivery courier move in real-time from the kitchen/shop straight to your hostel door.',
    icon: 'car' as const,
    illustrationColor: COLORS.surfaceContainerHigh,
  },
  {
    title: 'Grouped Checkout',
    description: 'Order from multiple campus vendors in a single checkout, with transparent and compounded delivery fees!',
    icon: 'cart' as const,
    illustrationColor: COLORS.surfaceContainerHighest,
  }
];

export default function PortalOnboarding() {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);

  const handleNext = () => {
    if (activeSlide < SLIDES.length - 1) {
      setActiveSlide(activeSlide + 1);
    } else {
      router.replace('/(customer)/home');
    }
  };

  const handleSkip = () => {
    router.replace('/(customer)/home');
  };

  return (
    <View style={styles.container}>
      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={[TYPOGRAPHY.subtitle, styles.skipText]}>Skip</Text>
      </TouchableOpacity>

      {/* Slide Illustration */}
      <View style={styles.carouselContainer}>
        <View style={styles.logoWrapper}>
          <Image source={require('../../assets/images/logo.jpg')} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View style={[styles.illustrationCircle, { backgroundColor: SLIDES[activeSlide].illustrationColor }]}>
          <Ionicons name={SLIDES[activeSlide].icon as any} size={80} color={COLORS.primary} />
        </View>

        {/* Slide Copy */}
        <View style={styles.textContainer}>
          <Text style={[TYPOGRAPHY.headlineXl, styles.title]}>{SLIDES[activeSlide].title}</Text>
          <Text style={[TYPOGRAPHY.body, styles.description]}>
            {SLIDES[activeSlide].description}
          </Text>
        </View>
      </View>

      {/* Progress Dots & CTA Button */}
      <View style={styles.footer}>
        {/* Dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                activeSlide === index ? styles.activeDot : styles.inactiveDot
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={[TYPOGRAPHY.subtitle, styles.nextButtonText]}>
            {activeSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.onPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: SPACING.pagePadding,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: 10,
  },
  skipText: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: SPACING.stackLg,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: SHAPES.roundedCard,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  illustrationCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.stackLg,
    ...SHADOWS.appCard,
  },
  textContainer: {
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  title: {
    color: COLORS.onSurface,
    textAlign: 'center',
    marginBottom: SPACING.stackSm,
  },
  description: {
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    gap: SPACING.stackLg,
    paddingBottom: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: SPACING.stackSm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: COLORS.primary,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: COLORS.surfaceContainerHighest,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.stackSm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: SHAPES.roundedLg,
    minWidth: 160,
    ...SHADOWS.appCard,
  },
  nextButtonText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
});
