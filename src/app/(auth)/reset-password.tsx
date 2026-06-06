import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isFocusedToken, setIsFocusedToken] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);
  const [isFocusedConfirm, setIsFocusedConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetPassword = async () => {
    setErrorMsg(null);

    // Form validations
    if (!token.trim()) {
      setErrorMsg('Please enter your reset token.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', {
        token: token.trim(),
        newPassword
      });
      setIsSuccess(true);
    } catch (err: any) {
      const apiError = err?.response?.data?.message || err?.message || 'Password reset failed. The token may be invalid or expired.';
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
            <Text style={[TYPOGRAPHY.headlineXl, styles.title]}>Reset Password</Text>
            <Text style={[TYPOGRAPHY.body, styles.subtitle]}>
              {isSuccess
                ? "Your password has been successfully updated."
                : "Enter the reset token you received in your email and set your new password."}
            </Text>
          </View>

          {isSuccess ? (
            <View style={styles.successContainer}>
              <View style={styles.successIconBg}>
                <Ionicons name="checkmark-circle" $$$ />
              </View>
              <Text style={[TYPOGRAPHY.subtitle, styles.successTitle]}>Password Reset Successful</Text>
              <Text style={[TYPOGRAPHY.body, styles.successText]}>
                You can now log in to your account with your new secure password.
              </Text>
              
              <TouchableOpacity
                style={styles.loginNavButton}
                onPress={() => router.replace('/(auth)/login')}
              >
                <Text style={[TYPOGRAPHY.subtitle, styles.loginNavButtonText]}>Go to Log In</Text>
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

              {/* Reset Token Input */}
              <View style={styles.inputGroup}>
                <Text style={[TYPOGRAPHY.subtitle, styles.label]}>Reset Token</Text>
                <View style={[
                  styles.inputWrapper,
                  isFocusedToken && styles.inputWrapperFocused
                ]}>
                  <Ionicons name="lock-closed" $$$ />
                  <TextInput
                    style={[TYPOGRAPHY.body, styles.input]}
                    placeholder="Enter reset token"
                    placeholderTextColor={COLORS.outline}
                    value={token}
                    onChangeText={setToken}
                    onFocus={() => setIsFocusedToken(true)}
                    onBlur={() => setIsFocusedToken(false)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                  />
                </View>
              </View>

              {/* New Password Input */}
              <View style={styles.inputGroup}>
                <Text style={[TYPOGRAPHY.subtitle, styles.label]}>New Password</Text>
                <View style={[
                  styles.inputWrapper,
                  isFocusedPassword && styles.inputWrapperFocused
                ]}>
                  <Ionicons name="lock-closed" $$$ />
                  <TextInput
                    style={[TYPOGRAPHY.body, styles.input]}
                    placeholder="Enter new password"
                    placeholderTextColor={COLORS.outline}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    onFocus={() => setIsFocusedPassword(true)}
                    onBlur={() => setIsFocusedPassword(false)}
                    secureTextEntry
                    editable={!isSubmitting}
                  />
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputGroup}>
                <Text style={[TYPOGRAPHY.subtitle, styles.label]}>Confirm Password</Text>
                <View style={[
                  styles.inputWrapper,
                  isFocusedConfirm && styles.inputWrapperFocused
                ]}>
                  <Ionicons name="lock-closed" $$$ />
                  <TextInput
                    style={[TYPOGRAPHY.body, styles.input]}
                    placeholder="Confirm new password"
                    placeholderTextColor={COLORS.outline}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setIsFocusedConfirm(true)}
                    onBlur={() => setIsFocusedConfirm(false)}
                    secureTextEntry
                    editable={!isSubmitting}
                  />
                </View>
              </View>

              {/* Submit CTA */}
              <TouchableOpacity 
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
                onPress={handleResetPassword}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.onPrimary} />
                ) : (
                  <Text style={[TYPOGRAPHY.subtitle, styles.submitButtonText]}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={[TYPOGRAPHY.body, styles.footerText]}>
              Back to{' '}
              <Text style={styles.loginLink} onPress={() => !isSubmitting && router.push('/(auth)/login')}>
                Log In
              </Text>
            </Text>
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
  loginNavButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SHAPES.roundedLg,
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.appCard,
  },
  loginNavButtonText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  footer: {
    marginTop: SPACING.stackLg,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.secondary,
  },
  loginLink: {
    color: COLORS.primary,
    fontWeight: '700',
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
