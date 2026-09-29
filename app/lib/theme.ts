import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Couleurs fixes de la marque (logo, écran d'accueil), identiques en clair et en sombre. */
export const brand = {
  navy: '#1B2550',
  night: '#15162A',
  green: '#3DDC97',
  cream: '#FFF4E2',
};

// `primary` sert de texte/icône sur fond clair : il doit rester lisible, d'où le bleu en mode clair.
// `accent` (vert Voyaj) sert de fond aux boutons principaux, avec `onAccent` bleu nuit par-dessus.
const light = {
  bg: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF1F7',
  border: '#DFE4EE',
  text: '#15162A',
  textSecondary: '#4A5070',
  textMuted: '#8A90A8',
  primary: '#1E3A8A',
  primarySoft: '#E3E9F8',
  onPrimary: '#FFFFFF',
  accent: brand.green,
  accentSoft: '#DDF8EC',
  onAccent: brand.night,
  success: '#0B8A5E',
  successSoft: '#DDF8EC',
  warning: '#C2660B',
  warningSoft: '#FFF1DB',
  danger: '#D93636',
  dangerSoft: '#FDE4E4',
  gold: '#F5A524',
};

const dark: typeof light = {
  bg: brand.night,
  surface: '#1C2048',
  surfaceAlt: '#252B5C',
  border: '#303870',
  text: '#F5F7FB',
  textSecondary: '#C3C8E0',
  textMuted: '#8088AE',
  primary: brand.green,
  primarySoft: '#173F3A',
  onPrimary: brand.night,
  accent: brand.green,
  accentSoft: '#173F3A',
  onAccent: brand.night,
  success: brand.green,
  successSoft: '#173F3A',
  warning: '#F7BE78',
  warningSoft: '#3D2E1A',
  danger: '#FF8A80',
  dangerSoft: '#3D1E24',
  gold: '#F7BE78',
};

export type Colors = typeof light;

/** Choix de l'utilisateur : suivre le téléphone, ou forcer clair / sombre. */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'voyaj.theme';
const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (p: ThemePreference) => void }>({
  preference: 'system',
  setPreference: () => {},
});

function applyNative(p: ThemePreference) {
  // Sur téléphone, force aussi le clavier, les sélecteurs de date et les alertes système.
  if (Platform.OS !== 'web') Appearance.setColorScheme(p === 'system' ? null : p);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark') {
        setState(v);
        applyNative(v);
      }
    }).catch(() => {});
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setState(p);
    applyNative(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return createElement(ThemeContext.Provider, { value }, children);
}

export function useThemePreference() {
  return useContext(ThemeContext);
}

export function useColorMode(): 'light' | 'dark' {
  const system = useColorScheme();
  const { preference } = useContext(ThemeContext);
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function useColors(): Colors {
  return useColorMode() === 'dark' ? dark : light;
}

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
