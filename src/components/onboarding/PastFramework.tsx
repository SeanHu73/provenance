'use client';

/**
 * The P.A.S.T. framework slide.
 *
 * Four colour-coded lenses (Place / Attitudes / Society / Technology). Each row
 * pins the WORD (enlarged first letter) on the left; to its right the descriptor
 * sits as a coloured "cover" over the example question. Dragging the row LEFT
 * slides the cover behind the word to reveal the question; dragging RIGHT slides
 * it back to show the definition again (reversible). The word stays visible
 * throughout. An italic instruction sits below.
 */

import { useRef } from 'react';

interface LensDef { key: string; word: string; sub: string; q: string; cls: string; }

const LENSES: LensDef[] = [
  { key: 'place', word: 'Place', cls: 'onb-pf-place',
    sub: 'Geography, resources, natural disasters',
    q: 'Why did people move here? What resources did they want?' },
  { key: 'attitude', word: 'Attitudes', cls: 'onb-pf-attitude',
    sub: 'Cultural values, important ideas',
    q: 'What did people believe? Were there changing ideas during the time?' },
  { key: 'society', word: 'Society', cls: 'onb-pf-society',
    sub: 'Social class, politics, economy',
    q: 'Who held power? What did the economic conditions look like?' },
  { key: 'tech', word: 'Technology', cls: 'onb-pf-tech',
    sub: 'Important tools, infrastructure, big inventions',
    q: 'What was new? How did it change daily life or business?' },
];

export default function PastFramework() {
  return (
    <div className="onb-pf">
      {LENSES.map((lens) => <Lens key={lens.key} lens={lens} />)}
      <p className="onb-pf-hint">Slide the box to reveal example questions.</p>
    </div>
  );
}

function Lens({ lens }: { lens: LensDef }) {
  const coverRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const offset = useRef(0);        // current translateX (px); 0 = closed, -width = open
  const width = useRef(1);
  const openRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    const cover = coverRef.current;
    if (!cover) return;
    dragging.current = true;
    startX.current = e.clientX;
    width.current = cover.offsetWidth || 1;
    cover.style.transition = 'none';
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const cover = coverRef.current;
    if (!cover) return;
    const base = openRef.current ? -width.current : 0;
    offset.current = Math.max(-width.current, Math.min(0, base + (e.clientX - startX.current)));
    cover.style.transform = `translateX(${offset.current}px)`;
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const cover = coverRef.current;
    if (!cover) return;
    cover.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    const willOpen = offset.current <= -width.current * 0.45;
    openRef.current = willOpen;
    cover.style.transform = willOpen ? 'translateX(-101%)' : 'translateX(0)';
  };

  return (
    <div className={`onb-pf-lens ${lens.cls}`}>
      <div className="onb-pf-word">
        <span className="onb-pf-initial">{lens.word.charAt(0)}</span>{lens.word.slice(1)}
      </div>

      <div
        className="onb-pf-reveal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={`Slide to reveal or hide the ${lens.word} question`}
      >
        <div className="onb-pf-q">{lens.q}</div>
        <div ref={coverRef} className="onb-pf-cover">
          <span className="onb-pf-desc">{lens.sub}</span>
          {/* double-sided arrow grab tab — pinned to the cover's right edge so it
             travels with the box as it slides (and tucks off-screen when open) */}
          <span className="onb-pf-cue" aria-hidden="true">
            <svg width="26" height="12" viewBox="0 0 26 12" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h18" />
              <path d="M7 3 4 6l3 3" />
              <path d="M19 3l3 3-3 3" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
