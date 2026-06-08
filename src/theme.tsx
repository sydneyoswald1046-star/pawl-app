import { createContext, useContext, useState, ReactNode } from 'react';

export const colors = {
  dark: {
    bg: '#050506',
    surface: '#111113',
    elevated: '#1a1a1d',
    text: '#f4f4f5',
    sub: '#71717a',
    muted: '#2a2a2d',
    faint: '#3f3f42',
    accent: '#8b5cf6',
    accentDark: '#6d28d9',
    green: '#10b981',
    red: '#ef4444',
    amber: '#f59e0b',
    greenSoft: 'rgba(16,185,129,0.1)',
    redSoft: 'rgba(239,68,68,0.1)',
    amberSoft: 'rgba(245,158,11,0.1)',
    accentSoft: 'rgba(139,92,246,0.08)',
    tabBar: 'rgba(5,5,6,0.92)',
  },
  light: {
    bg: '#f9fdf6',
    surface: '#ffffff',
    elevated: '#f4f4f2',
    text: '#09090b',
    sub: '#64748b',
    muted: '#e5e5e3',
    faint: '#d4d4d1',
    accent: '#7c3aed',
    accentDark: '#5b21b6',
    green: '#059669',
    red: '#dc2626',
    amber: '#d97706',
    greenSoft: 'rgba(5,150,105,0.08)',
    redSoft: 'rgba(220,38,38,0.08)',
    amberSoft: 'rgba(217,119,6,0.08)',
    accentSoft: 'rgba(124,58,237,0.06)',
    tabBar: 'rgba(249,253,246,0.92)',
  },
};

export type ThemeColors = typeof colors.dark;

type ThemeContextType = {
  dark: boolean;
  toggle: () => void;
  c: ThemeColors;
};

const ThemeContext = createContext<ThemeContextType>({
  dark: true,
  toggle: () => {},
  c: colors.dark,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const toggle = () => setIsDark(prev => !prev);
  const c = isDark ? colors.dark : colors.light;
  return (
    <ThemeContext.Provider value={{ dark: isDark, toggle, c }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export function getTierColors(currentEarnings: number, previousEarnings: number, isDark: boolean) {
  // Guard divide-by-zero: with no prior-month earnings the percentage is
  // undefined. Treat "0 → something" as +100% and "0 → 0" as flat 0%.
  const diff =
    previousEarnings > 0
      ? ((currentEarnings - previousEarnings) / previousEarnings) * 100
      : currentEarnings > 0
        ? 100
        : 0;
  const isUp = diff > 0;
  const isCritical = diff < -30;
  const tier = isUp ? 'gold' : isCritical ? 'red' : 'green';

  const tiers = {
    gold: {
      accent: '#eab308',
      gradStart: isDark ? '#141108' : '#fefce8',
      gradEnd: isDark ? '#0d0b06' : '#fef9c3',
      label: 'Earnings up',
    },
    green: {
      accent: '#22c55e',
      gradStart: isDark ? '#081410' : '#f0fdf4',
      gradEnd: isDark ? '#060d0a' : '#dcfce7',
      label: 'Slight dip',
    },
    red: {
      accent: '#ef4444',
      gradStart: isDark ? '#140808' : '#fef2f2',
      gradEnd: isDark ? '#0d0606' : '#fce8e8',
      label: 'Needs attention',
    },
  };

  return { ...tiers[tier], diff, tier };
}
