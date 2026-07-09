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
import { pauseTourAudioWithin } from '@/lib/tour-audio';
import SeedCard from './SeedCard';
import RevealCard from './RevealCard';

interface Props {
  stop: Stop;
  onContinue: () => void;
  isFinalInStop?: boolean;
  onPeekMap?: () => void;
}

export default function FindDiscoverCard({ stop, onContinue, isFinalInStop = false, onPeekMap }: Props) {
  const findRef = useRef<HTMLElement | null>(null);
  const discoverRef = useRef<HTMLElement | null>(null);
  const [showDiscover, setShowDiscover] = useState(false);

  // Mount DISCOVER once it scrolls in, and — since FIND and DISCOVER share one
  // snap-scroll page — stop a section's audio the moment it snaps out of view so
  // the two never play over each other.
  useEffect(() => {
    const find = findRef.current, discover = discoverRef.current;
    if (!find || !discover) return;
    const root = find.closest('.tour-scroll');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.target === discover && e.isIntersecting && e.intersectionRatio >= 0.2) setShowDiscover(true);
        if (e.intersectionRatio < 0.5) pauseTourAudioWithin(e.target);
      }),
      { root, threshold: [0.2, 0.5, 0.9] },
    );
    io.observe(find);
    io.observe(discover);
    return () => io.disconnect();
  }, [showDiscover]);

  return (
    <>
      <section ref={findRef} className="min-h-full snap-start flex flex-col justify-center px-5 py-6">
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
