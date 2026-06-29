'use client';

/**
 * ContextTimeline — the range selector that drives P.A.S.T. filtering.
 *
 * Fixed domain (TIMELINE_DOMAIN). Tapping the "Timeline" title cycles the
 * granularity 1 → 10 → 100 → back to 10 years; the current granularity is shown.
 * A draggable selector defaults to one segment wide: drag its body to move, drag
 * either edge to widen/narrow. Edges snap to the current granularity. The
 * selected { start, end } is lifted to the parent as the single source of truth.
 */

import { useRef, useState } from 'react';
import { TIMELINE_DOMAIN, GRANULARITIES, DEFAULT_GRANULARITY, type Granularity } from '../constants';
import type { TimeRange } from '../types';

const { start: D0, end: D1 } = TIMELINE_DOMAIN;
const SPAN = D1 - D0;

type DragMode = 'move' | 'start' | 'end';

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export default function ContextTimeline({ value, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [granularity, setGranularity] = useState<Granularity>(DEFAULT_GRANULARITY);

  const snap = (year: number) => {
    const snapped = Math.round((year - D0) / granularity) * granularity + D0;
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

  /** Begin a drag. Move/up listeners are local and torn down via AbortController
   *  on pointer-up, capturing the range as it was at pointer-down. */
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
        const next = Math.min(snap(year), origEnd - granularity);
        onChange({ start: Math.max(D0, next), end: origEnd });
      } else if (mode === 'end') {
        const next = Math.max(snap(year), origStart + granularity);
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

  const cycleGranularity = () => {
    const idx = GRANULARITIES.indexOf(granularity);
    // 1 → 10 → 100 → back to 10 (default), per spec.
    const order: Granularity[] = [1, 10, 100];
    const next = idx === -1 ? DEFAULT_GRANULARITY : order[(order.indexOf(granularity) + 1) % order.length];
    setGranularity(next);
    // Re-snap the current selection to the new granularity, keeping ≥ one segment.
    const s = Math.round((value.start - D0) / next) * next + D0;
    const start = Math.min(D1 - next, Math.max(D0, s));
    const end = Math.max(start + next, Math.round((value.end - D0) / next) * next + D0);
    onChange({ start, end: Math.min(D1, end) });
  };

  const granLabel = granularity === 1 ? '1-year' : granularity === 10 ? '10-year' : '100-year';

  // Light gridlines at a readable density for the current granularity.
  const tickStep = SPAN / granularity > 40 ? granularity * 10 : granularity;
  const ticks: number[] = [];
  for (let y = Math.ceil(D0 / tickStep) * tickStep; y <= D1; y += tickStep) ticks.push(y);

  return (
    <div className="px-4 py-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={cycleGranularity}
          className="flex items-center gap-2 text-text-primary"
          title="Tap to change granularity"
        >
          <span className="font-display text-lg leading-none">Timeline</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sandstone-light text-text-secondary">
            {granLabel} ↻
          </span>
        </button>
        <span className="font-display text-base text-text-primary tabular-nums">
          {value.start}–{value.end}
        </span>
      </div>

      <div ref={trackRef} className="relative h-9 mt-1">
        {/* base rail */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-sandstone-light" />
        {/* gridlines */}
        {ticks.map((y) => (
          <div key={y} className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-black/10" style={{ left: `${pct(y)}%` }} />
        ))}

        {/* selected range */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full cursor-grab active:cursor-grabbing"
          style={{ left: `${pct(value.start)}%`, width: `${pct(value.end) - pct(value.start)}%`, backgroundColor: 'var(--th-primary)' }}
          onPointerDown={beginDrag('move')}
        />
        {/* start handle */}
        <Handle posPct={pct(value.start)} onPointerDown={beginDrag('start')} />
        {/* end handle */}
        <Handle posPct={pct(value.end)} onPointerDown={beginDrag('end')} />
      </div>

      <div className="flex justify-between mt-1 text-[11px] text-text-muted tabular-nums">
        <span>{D0}</span>
        <span>{D1}</span>
      </div>
    </div>
  );
}

function Handle({ posPct, onPointerDown }: { posPct: number; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-warm-white shadow-md cursor-ew-resize touch-none"
      style={{ left: `${posPct}%`, border: '2px solid var(--th-primary)' }}
      onPointerDown={onPointerDown}
    />
  );
}
