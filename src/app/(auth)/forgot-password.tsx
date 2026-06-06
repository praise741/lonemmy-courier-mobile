import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleForgotPassword = async () => {
    setErrorMsg(null);

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setIsSuccess(true);
    } catch (err: any) {
      const apiError = err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';
      setErrorMsg(apiError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.shell}>
          {/* Header */}
          <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={require('../../../assets/images/logo.jpg')} style={styles.logoImage} resizeMode="contain" />
          </View>
            <Text style={[TYPOGRAPHY.headlineXl, styles.title]}>Forgot Password</Text>
            <Text style={[TYPOGRAPHY.body, styles.subtitle]}>
              {isSuccess
                ? "If the email is registered, we've sent you a password reset token."
                : "Enter your email address and we'll send you a password reset token."}
            </Text>
          </View>

          {isSuccess ? (
            <View style={styles.successContainer}>
              <View style={styles.successIconBg}>
                <Ionicons name="checkmark-circle" $$$ />
              </View>
              <Text style={[TYPOGRAPHY.subtitle, styles.successTitle]}>Check your Inbox</Text>
              <Text style={[TYPOGRAPHY.body, styles.successText]}>
                We sent a secure, one-time reset token to <Text style={{ fontWeight: '600' }}>{email}</Text>.
              </Text>
              
              <TouchableOpacity
                style={styles.resetNavButton}
                onPress={() => router.push('/(auth)/reset-password')}
              >
                <Text style={[TYPOGRAPHY.subtitle, styles.resetNavButtonText]}>Enter Reset Token</Text>
                <Ionicons name="chevron-forward" $$$ />
              </TouchableOpacity>
            </View>
          ) : (
            /* Form */
            <View style={styles.form}>
              {/* Error Feedback */}
              {errorMsg && (
                <View style={styles.errorBoxContainer}>
                  <Text style={styles.errorBoxText}>{errorMsg}</Text>
                </View>
              )}

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={[TYPOGRAPHY.subtitle, styles.label]}>Email Address</Text>
                <View style={[
                  styles.inputWrapper,
                  isFocusedEmail && styles.inputWrapperFocused
                ]}>
                  <Ionicons name="mail" $$$ />
                  <TextInput
                    style={[TYPOGRAPHY.body, styles.input]}
                    placeholder="Enter your email"
                    placeholderTextColor={COLORS.outline}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setIsFocusedEmail(true)}
                    onBlur={() => setIsFocusedEmail(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isSubmitting}
                  />
                </View>
              </View>

              {/* Submit CTA */}
              <TouchableOpacity 
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
                onPress={handleForgotPassword}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.onPrimary} />
                ) : (
                  <Text style={[TYPOGRAPHY.subtitle, styles.submitButtonText]}>Request Reset Token</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={[TYPOGRAPHY.body, styles.footerText]}>
              Remember your password?{' '}
              <Text style={styles.loginLink} onPress={() => !isSubmitting && router.push('/(auth)/login')}>
                Log In
              </Text>
            </Text>
            {!isSuccess && (
              <TouchableOpacity 
                style={styles.directResetLink} 
                onPress={() => !isSubmitting && router.push('/(auth)/reset-password')}
              >
                <Text style={[TYPOGRAPHY.muted, styles.directResetLinkText]}>
                  Already have a reset token? Enter it here
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.pagePadding,
  },
  shell: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: SHAPES.roundedShell,
    padding: SPACING.stackLg,
    ...SHADOWS.appShell,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.stackLg,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: SHAPES.roundedCard,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.stackMd,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: COLORS.onSurface,
    marginBottom: SPACING.stackSm,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    gap: SPACING.stackMd,
  },
  inputGroup: {
    gap: SPACING.stackSm,
  },
  label: {
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.divider,
    borderRadius: SHAPES.roundedLg,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: SPACING.stackMd,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: COLORS.onSurface,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SHAPES.roundedLg,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    ...SHADOWS.appCard,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.outline,
  },
  submitButtonText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.stackMd,
    gap: SPACING.stackSm,
  },
  successIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.stackSm,
  },
  successTitle: {
    color: COLORS.onSurface,
    fontWeight: '800',
    fontSize: 18,
  },
  successText: {
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: SPACING.stackMd,
    lineHeight: 20,
  },
  resetNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.stackSm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: SHAPES.roundedLg,
    width: '100%',
    ...SHADOWS.appCard,
  },
  resetNavButtonText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  footer: {
    marginTop: SPACING.stackLg,
    alignItems: 'center',
    gap: SPACING.stackSm,
  },
  footerText: {
    color: COLORS.secondary,
  },
  loginLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  directResetLink: {
    marginTop: 4,
  },
  directResetLinkText: {
    color: COLORS.secondary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  errorBoxContainer: {
    backgroundColor: '#FFEBEF',
    borderWidth: 1,
    borderColor: '#FFC2CD',
    borderRadius: SHAPES.roundedLg,
    padding: SPACING.stackMd,
    marginBottom: SPACING.stackSm,
  },
  errorBoxText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
});
