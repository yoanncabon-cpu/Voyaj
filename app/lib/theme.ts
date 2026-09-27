import { useColorScheme } from 'react-native';

const light = {
  bg: '#F7F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F7',
  border: '#E3E5EE',
  text: '#12131A',
  textSecondary: '#5E6275',
  textMuted: '#9A9DB0',
  primary: '#4F46E5',
  primarySoft: '#E7E6FD',
  onPrimary: '#FFFFFF',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  gold: '#F59E0B',
};

const dark: typeof light = {
  bg: '#0B0C12',
  surface: '#161823',
  surfaceAlt: '#1F2231',
  border: '#2A2D3E',
  text: '#F3F4F8',
  textSecondary: '#B3B6C8',
  textMuted: '#6F7389',
  primary: '#7C74FF',
  primarySoft: '#27244D',
  onPrimary: '#FFFFFF',
  success: '#22C55E',
  successSoft: '#123320',
  warning: '#F59E0B',
  warningSoft: '#3A2A0B',
  danger: '#F87171',
  dangerSoft: '#3B1414',
  gold: '#FBBF24',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
