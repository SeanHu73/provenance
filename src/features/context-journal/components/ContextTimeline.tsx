'use client';

/**
 * ContextTimeline — the range selector that drives P.A.S.T. filtering.
 *
 * The domain (the two ends) starts admin-set and is viewer-editable; it may span
 * anywhere within TIMELINE_BOUNDS (1000 BC … present). A dropdown chooses the
 * snap grain (1 / 10 / 100 years) — any grain is allowed at any span (snapping is
 * just arithmetic). The visible gridlines are decoupled from the grain and capped
 * (≤ MAX_TICKS, coarsening in ×10 steps) so even a 1-year grain over 3000 years
 * stays smooth rather than rendering thousands of divs. A draggable selector (one
 * segment wide by default):
 * drag its body to move, drag either handle to resize; edges snap to the segment
 * size. The track is inset from the screen edges so dragging a handle doesn't
 * collide with the phone's edge-swipe gestures. The selected {start, end} is
 * lifted to the parent as the single source of truth.
 */

import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GRANULARITIES, TIMELINE_BOUNDS, MIN_DOMAIN_SPAN, floorGranularity, formatYear, type Granularity } from '../constants';
import type { TimeRange } from '../types';

type DragMode = 'move' | 'start' | 'end';

/** Never render more gridlines than this, whatever the span/grain (cosmetic). */
const MAX_TICKS = 40;

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  domain: { start: number; end: number };
  /** Move one of the two timeline ends (viewer-editable). */
  onDomainChange: (domain: { start: number; end: number }) => void;
}

export default function ContextTimeline({ value, onChange, domain, onDomainChange }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Initial grain is a sensible default for the span; the viewer can pick any.
  const [granularity, setGranularity] = useState<Granularity>(() => floorGranularity(domain));
  const [menuOpen, setMenuOpen] = useState(false);

  const D0 = domain.start;
  const D1 = domain.end;
  const SPAN = D1 - D0;
  const g = granularity; // snap grain — any of 1 / 10 / 100 is allowed at any span

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
    setGranularity(next);
    // Re-snap the current selection to the new grain, keeping ≥ one segment.
    const s = Math.round((value.start - D0) / next) * next + D0;
    const start = Math.min(D1 - next, Math.max(D0, s));
    const end = Math.max(start + next, Math.round((value.end - D0) / next) * next + D0);
    onChange({ start, end: Math.min(D1, end) });
  };

  const granLabel = (n: number) => `${n}-year`;

  // Viewer-editable timeline ends. Each clamps to the hard bounds and keeps a
  // minimum span; nudge step scales with the current grain.
  const endStep = Math.max(10, g);
  const setStartEnd = (v: number) => {
    const start = Math.min(Math.max(TIMELINE_BOUNDS.start, v), D1 - MIN_DOMAIN_SPAN);
    onDomainChange({ start, end: D1 });
  };
  const setEndEnd = (v: number) => {
    const end = Math.max(Math.min(TIMELINE_BOUNDS.end, v), D0 + MIN_DOMAIN_SPAN);
    onDomainChange({ start: D0, end });
  };

  // Gridlines are decoupled from the snap grain: snapping can be 1-year fine, but
  // we never draw more than ~MAX_TICKS marks (coarsening the tick step in ×10
  // steps from the grain), so a 1000 BC → present span stays smooth.
  const ticks = useMemo(() => {
    let tickStep = g;
    while (SPAN / tickStep > MAX_TICKS) tickStep *= 10;
    const out: number[] = [];
    for (let y = D0; y <= D1 + 0.5; y += tickStep) out.push(y);
    return out;
  }, [D0, D1, SPAN, g]);

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
                    const selected = opt === g;
                    return (
                      <li key={opt}>
                        <button
                          onClick={() => pickGranularity(opt)}
                          className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-sandstone-light/60 text-text-primary ${selected ? 'font-semibold' : ''}`}
                        >
                          {granLabel(opt)} segments
                          {selected && <span style={{ color: 'var(--th-primary)' }}>✓</span>}
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

      <div className="flex justify-between items-start mt-1.5" style={{ marginLeft: EDGE - 8, marginRight: EDGE - 8 }}>
        <EndControl label="Start" value={D0} step={endStep} onChange={setStartEnd} align="left" />
        <EndControl label="End" value={D1} step={endStep} onChange={setEndEnd} align="right" />
      </div>
    </div>
  );
}

/** An editable timeline end — tap to nudge (− / +) or type a year (negative = BC). */
function EndControl({ label, value, step, onChange, align }: {
  label: string; value: number; step: number; onChange: (v: number) => void; align: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const openEditor = () => { setDraft(String(value)); setOpen(true); };
  const commit = () => {
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) onChange(n);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={openEditor}
        className="flex items-center gap-1 text-[12px] font-semibold text-text-secondary tabular-nums"
        aria-label={`Edit ${label.toLowerCase()} year (currently ${formatYear(value)})`}
      >
        <span className="border-b border-dotted border-text-muted pb-0.5">{formatYear(value)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16 }}
              className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} bottom-full mb-2 z-20 w-48 rounded-xl bg-warm-white shadow-xl border p-3`}
              style={{ borderColor: 'var(--th-border)' }}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-text-secondary mb-1.5">{label} year</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onChange(value - step)} aria-label={`Earlier by ${step}`}
                  className="w-8 h-9 rounded-lg bg-sandstone-light text-text-primary text-lg leading-none shrink-0">−</button>
                <input
                  type="number" inputMode="numeric"
                  min={TIMELINE_BOUNDS.start} max={TIMELINE_BOUNDS.end}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
                  className="w-full min-w-0 px-2 py-2 rounded-lg border-2 bg-white text-[16px] font-serif tabular-nums text-text-primary text-center focus:outline-none"
                  style={{ borderColor: 'var(--th-border)' }}
                />
                <button onClick={() => onChange(value + step)} aria-label={`Later by ${step}`}
                  className="w-8 h-9 rounded-lg bg-sandstone-light text-text-primary text-lg leading-none shrink-0">+</button>
              </div>
              <p className="mt-1.5 text-[10px] text-text-muted">Negative = BC · 1000 BC → present</p>
              <button onClick={commit} className="mt-2 w-full py-2 rounded-lg text-sm font-semibold text-warm-white" style={{ backgroundColor: 'var(--th-primary)' }}>
                Done
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
