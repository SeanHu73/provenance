'use client';

/**
 * The P.A.S.T. framework slide.
 *
 * Four colour-coded lenses (Place / Attitudes / Society / Technology) — the
 * first letter of each word is enlarged. Each lens carries a coloured "cover"
 * with a right-edge handle (grip + a nudging ← arrow); dragging the cover LEFT
 * slides it away to reveal the example question underneath. Latches open once
 * dragged past a threshold. An italic instruction sits below; no separate
 * drag button.
 */

import { useRef, useState } from 'react';

interface LensDef {
  key: string;
  word: string;
  sub: string;
  q: string;
  cls: string;
}

const LENSES: LensDef[] = [
  { key: 'place', word: 'Place', cls: 'onb-pf-place',
    sub: 'Geography, resources, natural disasters',
    q: 'Why did people move here? What resources did they want?' },
  { key: 'attitude', word: 'Attitudes', cls: 'onb-pf-attitude',
    sub: 'Cultural values, important ideas',
    q: 'What did people believe? Were there changing ideas during the time?' },
  { key: 'society', word: 'Society', cls: 'onb-pf-society',
    sub: 'Social class, politics, economy',
    q: 'Who held power? How were the economic conditions?' },
  { key: 'tech', word: 'Technology', cls: 'onb-pf-tech',
    sub: 'Important tools, infrastructure, big inventions',
    q: 'What was new? How did it change daily life or business?' },
];

export default function PastFramework() {
  const [openCount, setOpenCount] = useState(0);
  const allOpen = openCount >= LENSES.length;

  return (
    <div className="onb-pf">
      {LENSES.map((lens) => (
        <Lens key={lens.key} lens={lens} onOpen={() => setOpenCount((c) => c + 1)} />
      ))}
      {!allOpen && <p className="onb-pf-hint">drag each box aside to reveal the questions</p>}
    </div>
  );
}

function Lens({ lens, onOpen }: { lens: LensDef; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const dxRef = useRef(0);
  const widthRef = useRef(1);

  const onPointerDown = (e: React.PointerEvent) => {
    if (open) return;
    const cover = coverRef.current;
    if (!cover) return;
    draggingRef.current = true;
    startXRef.current = e.clientX;
    widthRef.current = cover.offsetWidth || 1;
    dxRef.current = 0;
    cover.style.transition = 'none';
    cover.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const cover = coverRef.current;
    if (!cover) return;
    dxRef.current = Math.max(-widthRef.current, Math.min(0, e.clientX - startXRef.current));
    cover.style.transform = `translateX(${dxRef.current}px)`;
  };
  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const cover = coverRef.current;
    if (!cover) return;
    cover.style.transition = '';
    if (dxRef.current <= -widthRef.current * 0.38) {
      cover.style.transform = '';   // CSS open rule parks it off (with !important)
      setOpen(true);
      onOpen();
    } else {
      cover.style.transform = 'translateX(0)';   // snap back
    }
  };

  return (
    <div className={`onb-pf-lens ${lens.cls} ${open ? 'onb-open' : ''}`}>
      <div className="onb-pf-word">
        <span className="onb-pf-initial">{lens.word.charAt(0)}</span>{lens.word.slice(1)}
      </div>
      <div className="onb-pf-sub">{lens.sub}</div>

      <div className="onb-pf-reveal">
        <div className="onb-pf-q">{lens.q}</div>
        <div
          ref={coverRef}
          className="onb-pf-cover"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label={`Drag aside to reveal the ${lens.word} question`}
        >
          <span className="onb-pf-grab">
            <span className="onb-pf-arrow">&larr;</span>
            <span className="onb-pf-grip" />
          </span>
        </div>
      </div>
    </div>
  );
}
