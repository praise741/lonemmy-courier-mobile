import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHAPES, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, Role } from '../../context/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');

  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isFocusedName, setIsFocusedName] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);
  const [isFocusedPhone, setIsFocusedPhone] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMsg(null);

    // Form validations
    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!phone || phone.trim().length < 8) {
      setErrorMsg('Please enter a valid phone number.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(
        email.trim(),
        name.trim(),
        password,
        phone.trim(),
        role
      );
    } catch (err: any) {
      const apiError = err?.response?.data?.message || err?.message || 'Registration failed. Please check your credentials and try again.';
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
            <Image source={require('../../assets/images/logo.jpg')} style={styles.logoImage} resizeMode="contain" />
          </View>
            <Text style={[TYPOGRAPHY.headlineXl, styles.title]}>Create Account</Text>
            <Text style={[TYPOGRAPHY.body, styles.subtitle]}>
              Sign up to start delivery orders or partner with us.
            </Text>
          </View>

          {/* Role Selector */}
          <View style={styles.roleSelectorContainer}>
            <Text style={[TYPOGRAPHY.subtitle, styles.label]}>Select Your Role</Text>
            <View style={styles.roleGrid}>
              {/* Customer */}
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  role === 'CUSTOMER' && styles.roleCardActive
                ]}
                onPress={() => setRole('CUSTOMER')}
                disabled={isSubmitting}
              >
                <Ionicons name="home" $$$ />
                <Text
                  style={[
                    TYPOGRAPHY.muted,
                    styles.roleCardText,
                    role === 'CUSTOMER' && styles.roleCardTextActive
                  ]}
                >
                  Customer
                </Text>
              </TouchableOpacity>

              {/* Courier */}
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  role === 'COURIER' && styles.roleCardActive
                ]}
                onPress={() => setRole('COURIER')}
                disabled={isSubmitting}
              >
                <Ionicons name="car" $$$ />
                <Text
                  style={[
                    TYPOGRAPHY.muted,
                    styles.roleCardText,
                    role === 'COURIER' && styles.roleCardTextActive
                  ]}
                >
                  Courier
                </Text>
              </TouchableOpacity>

              {/* Vendor */}
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  role === 'VENDOR' && styles.roleCardActive
                ]}
                onPress={() => setRole('VENDOR')}
                disabled={isSubmitting}
              >
                <Ionicons name="storefront" size={24} color={role === 'VENDOR' ? COLORS.primary : COLORS.secondary} />
                <Text style={[
                    TYPOGRAPHY.muted,
                    styles.roleCardText,
                    role === 'VENDOR' && styles.roleCardTextActive
                  ]}
                >
                  Vendor
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Error Feedback */}
            {errorMsg && (
              <View style={styles.errorBoxContainer}>
                <Text style={styles.errorBoxText}>{errorMsg}</Text>
              </View>
            )}

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[TYPOGRAPHY.subtitle, styles.label]}>Full Name</Text>
              <View style={[
                styles.inputWrapper,
                isFocusedName && styles.inputWrapperFocused
              ]}>
                <Ionicons name="person" $$$ />
                <TextInput
                  style={[TYPOGRAPHY.body, styles.input]}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.outline}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setIsFocusedName(true)}
                  onBlur={() => setIsFocusedName(false)}
                  autoCapitalize="words"
                  editable={!isSubmitting}
                />
              </View>
            </View>

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

            {/* Phone Input */}
            <View style={styles.inputGroup}>
              <Text style={[TYPOGRAPHY.subtitle, styles.label]}>Phone Number</Text>
              <View style={[
                styles.inputWrapper,
                isFocusedPhone && styles.inputWrapperFocused
              ]}>
                <Ionicons name="call" $$$ />
                <TextInput
                  style={[TYPOGRAPHY.body, styles.input]}
                  placeholder="Enter phone number"
                  placeholderTextColor={COLORS.outline}
                  value={phone}
                  onChangeText={setPhone}
                  onFocus={() => setIsFocusedPhone(true)}
                  onBlur={() => setIsFocusedPhone(false)}
                  keyboardType="phone-pad"
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
                  placeholder="Create password (min 6 chars)"
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

            {/* Register CTA */}
            <TouchableOpacity 
              style={[styles.registerButton, isSubmitting && styles.registerButtonDisabled]} 
              onPress={handleRegister}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.onPrimary} />
              ) : (
                <Text style={[TYPOGRAPHY.subtitle, styles.registerButtonText]}>Sign Up</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={[TYPOGRAPHY.body, styles.footerText]}>
              Already have an account?{' '}
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
    marginVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.stackMd,
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
  roleSelectorContainer: {
    marginBottom: SPACING.stackMd,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: SPACING.stackSm,
    marginTop: 8,
  },
  roleCard: {
    flex: 1,
    height: 64,
    backgroundColor: COLORS.divider,
    borderRadius: SHAPES.roundedMd,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.appCard,
  },
  roleCardText: {
    fontWeight: '600',
    color: COLORS.secondary,
  },
  roleCardTextActive: {
    color: COLORS.onPrimary,
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
  registerButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SHAPES.roundedLg,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    ...SHADOWS.appCard,
  },
  registerButtonDisabled: {
    backgroundColor: COLORS.outline,
  },
  registerButtonText: {
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
