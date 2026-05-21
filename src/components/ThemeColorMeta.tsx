'use client';

import { useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';

const THEME_COLORS: Record<string, string> = {
  red: '#8B2538',
  teal: '#175E54',
};

export default function ThemeColorMeta() {
  const { theme } = useTheme();

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta') as HTMLMetaElement;
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', THEME_COLORS[theme] ?? THEME_COLORS.red);
  }, [theme]);

  return null;
}
