'use client';

/**
 * Merged FIND + DISCOVER screen (context tours), in up to three snap sections:
 *
 *   1. FIND activity  — the notice prompt as bare instructions, a camera, then
 *                       their shot beside the real notice photo. (FindActivityCard)
 *   2. Background     — the notice photo + the stop's narration. (SeedCard,
 *                       embedded) Omitted when the stop has no Background.
 *   3. DISCOVER       — the reveal. (RevealCard)
 *
 * Section 1 used to be part of 2: SeedCard rendered the find instructions *and*
 * the notice photos above the Background. Splitting it is what lets the photo stay
 * hidden until they've actually looked — so SeedCard is now passed
 * `hideFindInstructions`, since section 1 has said all that.
 *
 * Each section mounts only once scrolled into view, so its narration doesn't
 * autoplay over the section above it.
 */

import { useEffect, useRef, useState } from 'react';
import { Stop } from '@/lib/types';
import { pauseTourAudioWithin, resumeTourAudioWithin } from '@/lib/tour-audio';
import FindActivityCard from './FindActivityCard';
import SeedCard, { hasBackgroundContent } from './SeedCard';
import RevealCard from './RevealCard';

interface Props {
  stop: Stop;
  onContinue: () => void;
  isFinalInStop?: boolean;
  onPeekMap?: () => void;
}

export default function FindDiscoverCard({ stop, onContinue, isFinalInStop = false, onPeekMap }: Props) {
  const findRef = useRef<HTMLElement | null>(null);
  const bgRef = useRef<HTMLElement | null>(null);
  const discoverRef = useRef<HTMLElement | null>(null);
  const [showDiscover, setShowDiscover] = useState(false);
  // The Background section only appears once they've done the activity — a scroll
  // cue to it beforehand would let them skip straight past the looking.
  const [found, setFound] = useState(false);
  // Set by the "reveal answer" escape hatch: mount the sections and then scroll
  // straight to Background (or DISCOVER when there's no Background).
  const [jumpToBackground, setJumpToBackground] = useState(false);
  const hasBackground = hasBackgroundContent(stop);

  useEffect(() => {
    if (!found || !jumpToBackground) return;
    // Wait a frame so the just-mounted section is laid out before scrolling.
    const id = requestAnimationFrame(() => {
      (hasBackground ? bgRef.current : discoverRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setJumpToBackground(false);
    });
    return () => cancelAnimationFrame(id);
  }, [found, jumpToBackground, hasBackground]);

  // Mount DISCOVER once it scrolls in, and — since FIND and DISCOVER share one
  // snap-scroll page — pause a section's audio when it snaps out of view and
  // resume it (from where it left off) when it snaps back, so the two never play
  // over each other. The 0.35–0.7 gap is hysteresis: mid-scroll (both ~0.5)
  // nothing toggles, avoiding a play/pause stutter.
  useEffect(() => {
    const find = findRef.current, bg = bgRef.current, discover = discoverRef.current;
    if (!find || !discover) return;
    const root = find.closest('.tour-scroll');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.target === discover && e.isIntersecting && e.intersectionRatio >= 0.2) setShowDiscover(true);
        if (e.intersectionRatio >= 0.7) resumeTourAudioWithin(e.target);
        else if (e.intersectionRatio <= 0.35) pauseTourAudioWithin(e.target);
      }),
      { root, threshold: [0.2, 0.35, 0.7] },
    );
    io.observe(find);
    if (bg) io.observe(bg);
    io.observe(discover);
    return () => io.disconnect();
  }, [showDiscover, found]);

  return (
    <>
      <section ref={findRef} className="min-h-full snap-start flex flex-col justify-start px-5 py-6">
        <FindActivityCard
          stop={stop}
          onFound={() => setFound(true)}
          onRevealAnswer={() => { setFound(true); setJumpToBackground(true); }}
          onPeekMap={onPeekMap}
        />
      </section>
      {/* Both later sections wait on the activity. Gating only the Background left
          DISCOVER reachable by scrolling, which skipped the activity *and* the
          narration — a worse outcome than not having the activity at all. */}
      {found && (
        <>
          {/* Skipped entirely when the stop has no Background — otherwise this is
              a snap section holding a title and a scroll cue, which halts the
              reader mid-flow for nothing. FIND then snaps straight to DISCOVER. */}
          {hasBackground && (
            <section ref={bgRef} className="min-h-full snap-start flex flex-col justify-start px-5 py-6">
              <SeedCard stop={stop} embedded hideFindInstructions onPeekMap={onPeekMap} />
            </section>
          )}
          <section ref={discoverRef} className="min-h-full snap-start flex flex-col justify-start px-5 py-6">
            {showDiscover ? (
              <RevealCard stop={stop} onContinue={onContinue} isFinalInStop={isFinalInStop} />
            ) : (
              <div className="min-h-full flex items-center justify-center" style={{ color: 'var(--th-primary)', opacity: 0.4 }} aria-hidden="true">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
