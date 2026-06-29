'use client';

/**
 * ContextTimeline — the range selector that drives P.A.S.T. filtering.
 *
 * The domain (the two ends) is set per tour stop by the admin and passed in;
 * it may span anywhere within TIMELINE_BOUNDS (1000 BC … present). A dropdown
 * chooses the segment size (1 / 10 / 100 years); sizes that would push the
 * timeline past ~30 segments are disabled, so the grain auto-coarsens for long
 * domains (1 → 10 → 100). A draggable selector (one segment wide by default):
 * drag its body to move, drag either handle to resize; edges snap to the segment
 * size. The track is inset from the screen edges so dragging a handle doesn't
 * collide with the phone's edge-swipe gestures. The selected {start, end} is
 * lifted to the parent as the single source of truth.
 */

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GRANULARITIES, floorGranularity, formatYear, type Granularity } from '../constants';
import type { TimeRange } from '../types';

type DragMode = 'move' | 'start' | 'end';

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  domain: { start: number; end: number };
}

export default function ContextTimeline({ value, onChange, domain }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const floor = floorGranularity(domain);
  const [granularity, setGranularity] = useState<Granularity>(floor);
  const [menuOpen, setMenuOpen] = useState(false);

  const D0 = domain.start;
  const D1 = domain.end;
  const SPAN = D1 - D0;
  const g = Math.max(granularity, floor); // never finer than the floor

  const snap = (year: number) => {
    const snapped = Math.round((year - D0) / g) * g + D0;
    return Math.min(D1, Math.max(D0, snapped));
  };
  const pct = (year: number) => ((year - D0) / SPAN) * 100;

  /** Pointer x → (unsnapped) year on the domain. */
  const yearAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return D0;
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return D0 + t * SPAN;
  };

  const beginDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const origStart = value.start;
    const origEnd = value.end;
    const pointerStartYear = yearAt(e.clientX);
    const controller = new AbortController();

    const move = (ev: PointerEvent) => {
      const year = yearAt(ev.clientX);
      if (mode === 'start') {
        const next = Math.min(snap(year), origEnd - g);
        onChange({ start: Math.max(D0, next), end: origEnd });
      } else if (mode === 'end') {
        const next = Math.max(snap(year), origStart + g);
        onChange({ start: origStart, end: Math.min(D1, next) });
      } else {
        const width = origEnd - origStart;
        const delta = year - pointerStartYear;
        let start = snap(origStart + delta);
        start = Math.max(D0, Math.min(start, D1 - width));
        onChange({ start, end: start + width });
      }
    };

    window.addEventListener('pointermove', move, { signal: controller.signal });
    window.addEventListener('pointerup', () => controller.abort(), { signal: controller.signal });
  };

  const pickGranularity = (next: Granularity) => {
    setMenuOpen(false);
    if (next < floor) return; // disabled options are non-selectable
    setGranularity(next);
    // Re-snap the current selection to the new grain, keeping ≥ one segment.
    const s = Math.round((value.start - D0) / next) * next + D0;
    const start = Math.min(D1 - next, Math.max(D0, s));
    const end = Math.max(start + next, Math.round((value.end - D0) / next) * next + D0);
    onChange({ start, end: Math.min(D1, end) });
  };

  const granLabel = (n: number) => `${n}-year`;

  // One gridline per segment (segment count is bounded, so this stays readable).
  const ticks: number[] = [];
  for (let y = D0; y <= D1 + 0.5; y += g) ticks.push(y);

  // Inset the rail from the screen edges so an edge handle clears the phone's
  // back-swipe zone.
  const EDGE = 34;

  return (
    <div className="py-3 select-none">
      <div className="flex items-center justify-between mb-2 px-4">
        <span className="font-display text-lg leading-none text-text-primary">Timeline</span>

        {/* segment-size dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-lg text-[13px] font-semibold bg-sandstone-light text-text-secondary"
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
          >
            {granLabel(g)} segments
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
              className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <motion.ul
                  role="listbox"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 mt-1 z-20 w-40 rounded-xl bg-warm-white shadow-xl border overflow-hidden"
                  style={{ borderColor: 'var(--th-border)' }}
                >
                  {GRANULARITIES.map((opt) => {
                    const disabled = opt < floor;
                    const selected = opt === g;
                    return (
                      <li key={opt}>
                        <button
                          disabled={disabled}
                          onClick={() => pickGranularity(opt)}
                          className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between ${
                            disabled ? 'text-text-faint cursor-not-allowed' : 'hover:bg-sandstone-light/60 text-text-primary'
                          } ${selected ? 'font-semibold' : ''}`}
                        >
                          {granLabel(opt)} segments
                          {selected && <span style={{ color: 'var(--th-primary)' }}>✓</span>}
                          {disabled && <span className="text-[10px] uppercase tracking-wide">too many</span>}
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center justify-between mb-1 px-4">
        <span className="text-[11px] text-text-muted">Selected</span>
        <span className="font-display text-base text-text-primary tabular-nums">
          {formatYear(value.start)} – {formatYear(value.end)}
        </span>
      </div>

      {/* track (inset from edges) */}
      <div ref={trackRef} className="relative h-9 mt-1" style={{ marginLeft: EDGE, marginRight: EDGE, touchAction: 'none', overscrollBehavior: 'contain' }}>
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-sandstone-light" />
        {ticks.map((y, i) => (
          <div key={i} className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-black/10" style={{ left: `${pct(y)}%` }} />
        ))}

        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full cursor-grab active:cursor-grabbing"
          style={{ left: `${pct(value.start)}%`, width: `${pct(value.end) - pct(value.start)}%`, backgroundColor: 'var(--th-primary)' }}
          onPointerDown={beginDrag('move')}
        />
        <Handle posPct={pct(value.start)} onPointerDown={beginDrag('start')} />
        <Handle posPct={pct(value.end)} onPointerDown={beginDrag('end')} />
      </div>

      <div className="flex justify-between mt-1 text-[11px] text-text-muted tabular-nums" style={{ marginLeft: EDGE, marginRight: EDGE }}>
        <span>{formatYear(D0)}</span>
        <span>{formatYear(D1)}</span>
      </div>
    </div>
  );
}

function Handle({ posPct, onPointerDown }: { posPct: number; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-warm-white shadow-md cursor-ew-resize touch-none"
      style={{ left: `${posPct}%`, border: '2px solid var(--th-primary)' }}
      onPointerDown={onPointerDown}
    />
  );
}
