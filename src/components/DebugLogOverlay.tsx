'use client';

/**
 * TEMPORARY on-screen console. Mirrors our tagged `console.log` lines
 * ([cj-map], [context-journal], [provenance]) into a small overlay at the bottom
 * of the screen so we can debug map interactions on a phone (no cable needed).
 * Tap the ✕ to hide it. Remove this component once the map issues are resolved.
 */

import { useEffect, useState } from 'react';

const TAGS = ['[cj-map]', '[context-journal]', '[provenance]'];

export default function DebugLogOverlay() {
  const [lines, setLines] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const origLog = console.log.bind(console);
    const origDebug = console.debug.bind(console);
    const capture = (...args: unknown[]) => {
      try {
        const s = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
        if (TAGS.some((t) => s.includes(t))) setLines((prev) => [...prev.slice(-11), s]);
      } catch { /* ignore */ }
    };
    console.log = (...args: unknown[]) => { origLog(...args); capture(...args); };
    console.debug = (...args: unknown[]) => { origDebug(...args); capture(...args); };
    return () => { console.log = origLog; console.debug = origDebug; };
  }, []);

  if (hidden || lines.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2147483647,
        maxHeight: '32vh', overflowY: 'auto', background: 'rgba(0,0,0,0.82)',
        color: '#4ade80', font: '11px/1.4 monospace', padding: '6px 8px 8px',
      }}
    >
      <button
        onClick={() => setHidden(true)}
        style={{ position: 'sticky', top: 0, float: 'right', color: '#fff', background: 'transparent', border: 'none', fontSize: 16, lineHeight: 1 }}
        aria-label="Hide debug log"
      >
        ✕
      </button>
      {lines.map((l, i) => <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l}</div>)}
    </div>
  );
}
