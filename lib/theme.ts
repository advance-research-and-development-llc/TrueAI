export const colors = {
  light: {
    primary: '#0066cc',
    secondary: '#6b7280',
    accent: '#10b981',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    background: '#ffffff',
    surface: '#f9fafb',
    surfaceVariant: '#f3f4f6',
    border: '#e5e7eb',
    text: '#111827',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
  },
  dark: {
    primary: '#3b82f6',
    secondary: '#9ca3af',
    accent: '#10b981',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    background: '#0f172a',
    surface: '#1e293b',
    surfaceVariant: '#334155',
    border: '#475569',
    text: '#f1f5f9',
    textSecondary: '#cbd5e1',
    textTertiary: '#94a3b8',
  },
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as '700',
    lineHeight: 40,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700' as '700',
    lineHeight: 36,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600' as '600',
    lineHeight: 32,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600' as '600',
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as '400',
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as '400',
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as '400',
    lineHeight: 16,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400' as '400',
    lineHeight: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as '600',
    lineHeight: 16,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export type Theme = typeof colors.light;
export type ThemeMode = 'light' | 'dark';
