'use client';

/**
 * Compact two-option theme toggle. Rendered at the top-right of the
 * map. Styled with --th-* tokens so the control itself reflects the
 * active theme.
 */

import { useTheme, THEMES } from '@/context/ThemeContext';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full p-1 shadow-lg"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--th-surface) 90%, transparent)',
        border: '1px solid var(--th-border)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        fontFamily: 'var(--th-font-body)',
      }}
      role="group"
      aria-label="Theme"
    >
      {THEMES.map(({ id, label }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={active}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={
              active
                ? { backgroundColor: 'var(--th-primary)', color: '#FFFFFF' }
                : { backgroundColor: 'transparent', color: 'var(--th-text-muted)' }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
