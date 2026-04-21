import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const theme = {
  colors: {
    primary: '#1a237e',       // Deep indigo
    primaryLight: '#3949ab',
    primaryDark: '#0d1464',
    secondary: '#0288d1',     // Blue accent
    secondaryLight: '#4fb3e8',
    accent: '#e91e63',        // Pink for alerts
    success: '#2e7d32',
    successLight: '#e8f5e9',
    warning: '#f57c00',
    warningLight: '#fff3e0',
    error: '#c62828',
    errorLight: '#ffebee',
    info: '#0277bd',
    infoLight: '#e1f5fe',
    // Backgrounds
    background: '#f4f6fb',
    surface: '#ffffff',
    surfaceVariant: '#f0f2f8',
    // Text
    textPrimary: '#1a1a2e',
    textSecondary: '#5c6b8a',
    textMuted: '#9aa3b8',
    textOnPrimary: '#ffffff',
    // Borders
    border: '#e0e4f0',
    borderLight: '#f0f2f8',
    // Role colors
    roleAdmin: '#7b1fa2',
    roleFaculty: '#1565c0',
    roleWarden: '#2e7d32',
    // Visit status
    statusActive: '#2e7d32',
    statusCompleted: '#0277bd',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 6,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
    extraBold: '800',
  },
  shadow: {
    sm: {
      shadowColor: '#1a237e',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#1a237e',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#1a237e',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 14,
      elevation: 8,
    },
  },
  screen: { width, height },
};

export const getRoleColor = (role) => {
  switch (role) {
    case 'admin': return theme.colors.roleAdmin;
    case 'faculty': return theme.colors.roleFaculty;
    case 'warden': return theme.colors.roleWarden;
    default: return theme.colors.primary;
  }
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'active': return theme.colors.statusActive;
    case 'completed': return theme.colors.statusCompleted;
    default: return theme.colors.textMuted;
  }
};
