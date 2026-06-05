// Lonemmy Courier Premium Corporate-Modern Design System Tokens
// Derived from C:\Users\Dotmartcodes\Documents\lonemmy-courier\stitch_lonemmy_courier_mobile_client\lonemmy_courier\DESIGN.md

export const COLORS = {
  // Brand Colors
  primary: '#bb0114',           // Brand Red - main CTAs, highlights
  onPrimary: '#ffffff',
  primaryContainer: '#e02929',
  onPrimaryContainer: '#fffbff',
  inversePrimary: '#ffb4ab',

  secondary: '#4e5e7f',         // Secondary Navy - navigation, headers
  onSecondary: '#ffffff',
  secondaryContainer: '#c7d7fe',
  onSecondaryContainer: '#4d5d7e',

  tertiary: '#5d5c5b',
  onTertiary: '#ffffff',
  tertiaryContainer: '#757474',
  onTertiaryContainer: '#f7feff',

  // Surfaces & Backgrounds
  background: '#f9f9ff',
  onBackground: '#141b2c',      // App Ink

  surface: '#f9f9ff',
  surfaceDim: '#d2daf0',
  surfaceBright: '#f9f9ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f1f3ff',
  surfaceContainer: '#e9edff',
  surfaceContainerHigh: '#e0e8ff',
  surfaceContainerHighest: '#dbe2f9',

  onSurface: '#141b2c',
  onSurfaceVariant: '#5c403c',
  inverseSurface: '#293041',
  inverseOnSurface: '#edf0ff',

  // Borders & Accents
  outline: '#916f6b',
  outlineVariant: '#e6bdb8',
  cardBorder: '#DDE5F0',       // Soft light borders
  divider: '#EEF2F7',

  // Errors
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  // UTILS
  white: '#ffffff',
  black: '#000000',
  shadowColor: 'rgba(16, 24, 40, 0.12)',
  cardShadowColor: 'rgba(16, 24, 40, 0.06)',
};

export const SHAPES = {
  roundedSm: 4,         // 0.25rem
  roundedDefault: 8,    // 0.5rem (Static interactions)
  roundedMd: 12,        // 0.75rem
  roundedLg: 14,        // Button/Input targets
  roundedCard: 18,      // Primary cards container
  roundedXl: 24,        // Large containers
  roundedShell: 28,     // Main app viewport shell / Modal sheets
  roundedFull: 9999,
};

export const SPACING = {
  pagePadding: 16,
  gutter: 12,
  stackSm: 8,
  stackMd: 16,
  stackLg: 24,
  shellMargin: 12,
};

export const TYPOGRAPHY = {
  headlineXl: {
    fontSize: 30,
    fontWeight: '800' as const,
    fontFamily: 'Outfit',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  headlineLg: {
    fontSize: 20,
    fontWeight: '700' as const,
    fontFamily: 'Outfit',
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    fontFamily: 'Inter',
    lineHeight: 22,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    fontFamily: 'Inter',
    lineHeight: 20,
  },
  muted: {
    fontSize: 12,
    fontWeight: '400' as const,
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  labelMini: {
    fontSize: 11,
    fontWeight: '700' as const,
    fontFamily: 'Inter',
    lineHeight: 14,
    letterSpacing: 1.2,
  },
};

export const SHADOWS = {
  appShell: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
  },
  appCard: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
};
