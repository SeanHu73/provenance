'use client';

/**
 * Merged FIND + DISCOVER screen (context tours). FIND (look-around + Background)
 * is the first snap section; the reader snap-scrolls down to DISCOVER (the
 * reveal) as the second. No "next" button between them — the bottom button of
 * DISCOVER advances the tour ("Explore more" when it heads back to the map).
 *
 * DISCOVER mounts only once it's scrolled into view, so its narration doesn't
 * autoplay while the reader is still on FIND.
 */

import { useEffect, useRef, useState } from 'react';
import { Stop } from '@/lib/types';
import SeedCard from './SeedCard';
import RevealCard from './RevealCard';

interface Props {
  stop: Stop;
  onContinue: () => void;
  isFinalInStop?: boolean;
  onPeekMap?: () => void;
}

export default function FindDiscoverCard({ stop, onContinue, isFinalInStop = false, onPeekMap }: Props) {
  const discoverRef = useRef<HTMLElement | null>(null);
  const [showDiscover, setShowDiscover] = useState(false);

  useEffect(() => {
    const el = discoverRef.current;
    if (!el || showDiscover) return;
    const root = el.closest('.tour-scroll');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setShowDiscover(true); }),
      { root, threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [showDiscover]);

  return (
    <>
      <section className="min-h-full snap-start flex flex-col justify-center px-5 py-6">
        <SeedCard stop={stop} embedded onPeekMap={onPeekMap} />
      </section>
      <section ref={discoverRef} className="min-h-full snap-start flex flex-col justify-center px-5 py-6">
        {showDiscover ? (
          <RevealCard stop={stop} onContinue={onContinue} isFinalInStop={isFinalInStop} />
        ) : (
          <div className="min-h-full flex items-center justify-center" style={{ color: 'var(--th-primary)', opacity: 0.4 }} aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </div>
        )}
      </section>
    </>
  );
}
