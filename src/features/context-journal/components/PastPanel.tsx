'use client';

/**
 * PastPanel — the four P.A.S.T. lenses, in canonical order.
 *
 * Receives the full place-scoped entry set and the selected timeline range, and
 * filters each lens to the contexts whose timeRange overlaps the selection
 * (start <= selEnd && end >= selStart). The selected range is the single source
 * of truth for what shows.
 */

import { useMemo, useRef } from 'react';
import { LENSES, overlapsRange } from '../constants';
import type { ContextEntry, PastCategory, TimeRange } from '../types';
import PastLens from './PastLens';

interface Props {
  entries: ContextEntry[];
  selectedRange: TimeRange;
  savedIds: Set<string>;
  /** The currently focused context (drives the map); null = none. */
  focusedId: string | null;
  /** When the map panel is open, lens banners slim down. */
  compact?: boolean;
  /** Act sequence: cue lenses that still hold unopened questions with a tap loop. */
  promptUnopened?: boolean;
  /** Locked authored questions → the lens each must be unlocked by exploring. */
  lockInfoById?: Map<string, { lensLabel: string; lensColour: string }>;
  onFocus: (entry: ContextEntry | null) => void;
  onToggleSave: (id: string) => void;
  onOpenFull: (entry: ContextEntry) => void;
  onAskLens?: (lens: PastCategory) => void;
  /** True whenever ≥1 lens is expanded — the journal hides its floating ask CTA. */
  onAnyOpenChange?: (anyOpen: boolean) => void;
}

export default function PastPanel({ entries, selectedRange, savedIds, focusedId, compact, promptUnopened, lockInfoById, onFocus, onToggleSave, onOpenFull, onAskLens, onAnyOpenChange }: Props) {
  const openKeys = useRef<Set<string>>(new Set());
  const handleOpenChange = (key: string, isOpen: boolean) => {
    if (isOpen) openKeys.current.add(key); else openKeys.current.delete(key);
    onAnyOpenChange?.(openKeys.current.size > 0);
  };
  const byLens = useMemo(() => {
    const inRange = entries.filter((e) =>
      overlapsRange({ start: e.timeRange.start, end: e.timeRange.end }, selectedRange),
    );
    return LENSES.map((lens) => ({
      lens,
      items: inRange.filter((e) => e.pastCategory === lens.key),
    }));
  }, [entries, selectedRange]);

  return (
    <div className="px-4 pb-5 space-y-4">
      {byLens.map(({ lens, items }) => (
        <PastLens
          key={lens.key}
          lens={lens}
          entries={items}
          savedIds={savedIds}
          focusedId={focusedId}
          compact={compact}
          prompt={!!promptUnopened && items.some((e) => e.origin === 'authored')}
          lockInfoById={lockInfoById}
          onFocus={onFocus}
          onToggleSave={onToggleSave}
          onOpenFull={onOpenFull}
          onAskLens={onAskLens}
          onOpenChange={(o) => handleOpenChange(lens.key, o)}
        />
      ))}
    </div>
  );
}
