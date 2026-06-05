import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMsg(null);

    // Form validation
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const apiError = err?.response?.data?.message || err?.message || 'Login failed. Please check your credentials and connection.';
      setErrorMsg(apiError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDevLogin = async (role: 'CUSTOMER' | 'COURIER' | 'VENDOR' | 'ADMIN') => {
    setErrorMsg(null);
    setIsSubmitting(true);
    let devEmail = '';
    let devPassword = '';

    switch (role) {
      case 'CUSTOMER':
        devEmail = 'demo@lonemmy.com';
        devPassword = 'Customer123!';
        break;
      case 'COURIER':
        devEmail = 'courier@lonemmy.com';
        devPassword = 'Courier123!';
        break;
      case 'VENDOR':
        devEmail = 'poundsjaye@gmail.com';
        devPassword = 'Vendor123!';
        break;
      case 'ADMIN':
        devEmail = 'admin@lonemmy.com';
        devPassword = 'Admin123!';
        break;
    }

    setEmail(devEmail);
    setPassword(devPassword);

    try {
      await login(devEmail, devPassword);
    } catch (err: any) {
      const apiError = err?.response?.data?.message || err?.message || `Dev login as ${role} failed.`;
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
          {/* Logo / Header */}
          <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={require('../../assets/images/logo.jpg')} style={styles.logoImage} resizeMode="contain" />
          </View>
            <Text style={[TYPOGRAPHY.headlineXl, styles.title]}>Welcome Back</Text>
            <Text style={[TYPOGRAPHY.body, styles.subtitle]}>
              Log in to continue your deliveries and campus orders.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Error Feedback */}
            {errorMsg && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
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

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[TYPOGRAPHY.subtitle, styles.label]}>Password</Text>
              <View style={[
                styles.inputWrapper,
                isFocusedPassword && styles.inputWrapperFocused
              ]}>
                <Ionicons name="lock-closed" $$$ />
                <TextInput
                  style={[TYPOGRAPHY.body, styles.input]}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.outline}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setIsFocusedPassword(true)}
                  onBlur={() => setIsFocusedPassword(false)}
                  secureTextEntry
                  editable={!isSubmitting}
                />
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity 
              style={styles.forgotPassword} 
              disabled={isSubmitting}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={[TYPOGRAPHY.muted, styles.forgotText]}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login CTA */}
            <TouchableOpacity 
              style={[styles.loginButton, isSubmitting && styles.loginButtonDisabled]} 
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.onPrimary} />
              ) : (
                <Text style={[TYPOGRAPHY.subtitle, styles.loginButtonText]}>Log In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={[TYPOGRAPHY.body, styles.footerText]}>
              Don't have an account?{' '}
              <Text style={styles.signUpLink} onPress={() => !isSubmitting && router.push('/(auth)/register')}>
                Sign Up
              </Text>
            </Text>
          </View>

          {/* Developer Quick-Jump Portal — only in dev builds */}
          {__DEV__ && (
          <View style={styles.devPortal}>
            <View style={styles.devDivider}>
              <View style={styles.dividerLine} />
              <Text style={[TYPOGRAPHY.labelMini, styles.devDividerText]}>DEV QUICK-SWITCH PORTAL (REAL AUTH)</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.devGrid}>
              <TouchableOpacity
                style={[styles.devButton, { backgroundColor: COLORS.surfaceContainer }]}
                onPress={() => handleDevLogin('CUSTOMER')}
                disabled={isSubmitting}
              >
                <Ionicons name="home" $$$ />
                <Text style={[TYPOGRAPHY.muted, styles.devButtonText]}>Customer App</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, { backgroundColor: COLORS.surfaceContainer }]}
                onPress={() => handleDevLogin('COURIER')}
                disabled={isSubmitting}
              >
                <Ionicons name="car" $$$ />
                <Text style={[TYPOGRAPHY.muted, styles.devButtonText]}>Courier Portal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, { backgroundColor: COLORS.surfaceContainer }]}
                onPress={() => handleDevLogin('VENDOR')}
                disabled={isSubmitting}
              >
                <Ionicons name="storefront" size={16} color={COLORS.secondary} />
                <Text style={[TYPOGRAPHY.muted, styles.devButtonText]}>Vendor Portal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, { backgroundColor: COLORS.surfaceContainer }]}
                onPress={() => handleDevLogin('ADMIN')}
                disabled={isSubmitting}
              >
                <Ionicons name="settings" $$$ />
                <Text style={[TYPOGRAPHY.muted, styles.devButtonText]}>Admin Portal</Text>
              </TouchableOpacity>
            </View>
          </View>
          )}
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
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: COLORS.primary,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SHAPES.roundedLg,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.outline,
  },
  loginButtonText: {
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
  signUpLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  devPortal: {
    marginTop: SPACING.stackLg,
    paddingTop: SPACING.stackMd,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  devDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.stackMd,
    gap: SPACING.stackSm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.cardBorder,
  },
  devDividerText: {
    color: COLORS.outline,
    fontSize: 10,
    fontWeight: '700',
  },
  devGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.stackSm,
    justifyContent: 'space-between',
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: SHAPES.roundedDefault,
    paddingVertical: 10,
    width: '48%',
    marginBottom: 8,
  },
  devButtonText: {
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  errorContainer: {
    backgroundColor: '#FFEBEF',
    borderWidth: 1,
    borderColor: '#FFC2CD',
    borderRadius: SHAPES.roundedLg,
    padding: SPACING.stackMd,
    marginBottom: SPACING.stackSm,
  },
  errorText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
});
