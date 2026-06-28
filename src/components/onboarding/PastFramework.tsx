'use client';

/**
 * The P.A.S.T. framework slide's drag-to-reveal block.
 *
 * Four colour-coded lenses (Place / Attitudes / Society / Technology). A handle
 * is dragged down a track; as it passes each threshold the corresponding lens
 * opens to reveal its example questions, in order. An italic indicator tells
 * the explorer to drag. Pointer-based so it works for touch + mouse.
 */

import { useCallback, useRef, useState } from 'react';

interface Lens {
  key: string;
  letter: string;
  word: string;
  sub: string;
  q: string;
  cls: string;
}

const LENSES: Lens[] = [
  {
    key: 'place', letter: 'P', word: 'Place', cls: 'onb-pf-place',
    sub: 'Geography, resources, natural disasters',
    q: 'Why did people move here? What resources did they want?',
  },
  {
    key: 'attitude', letter: 'A', word: 'Attitudes', cls: 'onb-pf-attitude',
    sub: 'Cultural values, important ideas',
    q: 'What did people believe? Were there changing ideas during the time?',
  },
  {
    key: 'society', letter: 'S', word: 'Society', cls: 'onb-pf-society',
    sub: 'Social class, politics, economy',
    q: 'Who held power? How were the economic conditions?',
  },
  {
    key: 'tech', letter: 'T', word: 'Technology', cls: 'onb-pf-tech',
    sub: 'Important tools, infrastructure, big inventions',
    q: 'What was new? How did it change daily life or business?',
  },
];

export default function PastFramework() {
  // 0..1 progress of the handle down the track → number of lenses opened.
  const [opened, setOpened] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const applyFromClientY = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const r = track.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientY - r.top) / Math.max(1, r.height)));
    // Reveal one lens per quarter dragged; never un-reveal (latches open).
    const count = Math.min(LENSES.length, Math.round(t * LENSES.length));
    setOpened((prev) => (count > prev ? count : prev));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    applyFromClientY(e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    applyFromClientY(e.clientY);
  };
  const onPointerUp = () => { draggingRef.current = false; };

  const allOpen = opened >= LENSES.length;

  return (
    <div className="onb-pf">
      {LENSES.map((lens, i) => (
        <div key={lens.key} className={`onb-pf-lens ${lens.cls} ${i < opened ? 'onb-open' : ''}`}>
          <div className="onb-pf-head">
            <span className="onb-pf-letter">{lens.letter}</span>
            <span className="onb-pf-word">{lens.word}</span>
          </div>
          <div className="onb-pf-sub">{lens.sub}</div>
          <div className="onb-pf-q">→ {lens.q}</div>
        </div>
      ))}

      {!allOpen && (
        <>
          <div
            ref={trackRef}
            className="onb-pf-track"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <button
              type="button"
              className="onb-pf-knob"
              aria-label="Drag to reveal the questions"
            >
              ▾ drag ▾
            </button>
          </div>
          <p className="onb-pf-hint">drag down to reveal the questions</p>
        </>
      )}
    </div>
  );
}
