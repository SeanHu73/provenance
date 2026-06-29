'use client';

/**
 * PastPanel — the four P.A.S.T. lenses, in canonical order.
 *
 * Receives the full place-scoped entry set and the selected timeline range, and
 * filters each lens to the contexts whose timeRange overlaps the selection
 * (start <= selEnd && end >= selStart). The selected range is the single source
 * of truth for what shows.
 */

import { useMemo } from 'react';
import { LENSES, overlapsRange } from '../constants';
import type { ContextEntry, TimeRange } from '../types';
import PastLens from './PastLens';

interface Props {
  entries: ContextEntry[];
  selectedRange: TimeRange;
  savedIds: Set<string>;
  /** The currently focused context (drives the map); null = none. */
  focusedId: string | null;
  onFocus: (entry: ContextEntry | null) => void;
  onToggleSave: (id: string) => void;
  onOpenFull: (entry: ContextEntry) => void;
}

export default function PastPanel({ entries, selectedRange, savedIds, focusedId, onFocus, onToggleSave, onOpenFull }: Props) {
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
    <div className="px-4 py-3 space-y-2.5">
      {byLens.map(({ lens, items }) => (
        <PastLens
          key={lens.key}
          lens={lens}
          entries={items}
          savedIds={savedIds}
          focusedId={focusedId}
          onFocus={onFocus}
          onToggleSave={onToggleSave}
          onOpenFull={onOpenFull}
        />
      ))}
    </div>
  );
}
