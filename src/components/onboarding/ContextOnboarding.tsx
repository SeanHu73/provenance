'use client';

/**
 * First-open contextualization onboarding — a snap-scroll teaching flow of 12
 * slides. Big editorial type, staggered reveal-on-scroll, and varied alignment
 * (the Provenance style). A fixed progress bar tracks which of the 12 the reader
 * is on; the Welcome slide counts as #1. Only the Welcome slide has a button
 * ("Let's begin", which scrolls on) — everything else is reached by scrolling.
 * Skip top-right. Ends by handing off to a tour ("Find a Tour"). The per-tour
 * audio (Listen/Read) setup runs at the start of each tour, not here.
 *
 * The panels live in a memoized child so tracking the current slide only
 * re-renders the thin progress bar, not the whole (animation-heavy) tree.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import PastFramework from './PastFramework';

const LEAVE_MS = 500;
const TOTAL = 12;

function haptic(ms = 10) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

export default function ContextOnboarding({ children }: { children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [current, setCurrent] = useState(0);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const onAdmin = usePathname()?.startsWith('/admin') ?? false;

  useEffect(() => {
    try { sessionStorage.setItem('splash_seen', '1'); } catch { /* ignore */ }
  }, []);

  // Reveal-on-scroll (toggle .onb-in — pure DOM) + track the visible panel for
  // the progress bar. The tree is memoized, so setCurrent only redraws the bar.
  useEffect(() => {
    const root = screenRef.current;
    if (!root || dismissed) return;
    const panels = Array.from(root.querySelectorAll('.onb-panel')) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        e.target.classList.toggle('onb-in', e.isIntersecting);
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          if (!Number.isNaN(idx)) setCurrent((c) => (c === idx ? c : idx));
        }
      }),
      { root, threshold: 0.5 },
    );
    panels.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [dismissed]);

  const dismiss = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => setDismissed(true), LEAVE_MS);
  }, []);
  const goNext = useCallback(() => {
    haptic();
    const root = screenRef.current;
    if (root) root.scrollBy({ top: root.clientHeight, behavior: 'smooth' });
  }, []);

  if (dismissed || onAdmin) return <>{children}</>;

  return (
    <>
      {children}
      <div
        className={`fixed top-0 left-0 right-0 z-[1110] px-5 pt-3 pb-2 flex items-center gap-3 transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
        style={{ background: 'linear-gradient(var(--th-bg), color-mix(in srgb, var(--th-bg) 55%, transparent) 70%, transparent)' }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full transition-colors" style={{ backgroundColor: i <= current ? 'var(--th-primary)' : 'var(--th-border)' }} />
            ))}
          </div>
          <p className="mt-1 text-[11px] font-semibold tracking-wide" style={{ color: 'var(--th-primary)' }}>{current + 1} of {TOTAL}</p>
        </div>
        <button onClick={dismiss} className="onb-skip !static !top-auto !right-auto shrink-0">Skip</button>
      </div>

      <OnbPanels screenRef={screenRef} leaving={leaving} onNext={goNext} onDone={dismiss} />
    </>
  );
}

/* ── The panels (memoized: stable props, so scroll-tracking never re-renders it) ─ */
const OnbPanels = memo(function OnbPanels({
  screenRef, leaving, onNext, onDone,
}: {
  screenRef: React.RefObject<HTMLDivElement | null>;
  leaving: boolean;
  onNext: () => void;
  onDone: () => void;
}) {
  return (
    <div className={`onb-screen ${leaving ? 'onb-leaving' : ''}`} ref={screenRef} aria-label="Introduction">
      {/* 1 — Welcome */}
      <section data-idx={0} className="onb-panel onb-cx onb-in">
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center onb-r">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_transparent.png" alt="" width={200} height={200} className="splash-pin block w-44 h-auto select-none" draggable={false} />
            <div className="splash-shadow absolute left-1/2 -bottom-3 h-3 w-36 rounded-[50%]" style={{ backgroundColor: 'rgba(0,0,0,0.1)', filter: 'blur(5px)' }} />
          </div>
          <p className="splash-wordmark onb-title mt-6">Welcome to Provenance!</p>
          <p className="onb-lead onb-r mt-5" style={{ '--d': '0.3s' } as React.CSSProperties}>Ready to think like a historian?</p>
          <button onClick={onNext} className="onb-r mt-9 px-9 py-4 rounded-full text-[17px] font-semibold" style={{ '--d': '0.5s', backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' } as React.CSSProperties}>
            Let&rsquo;s begin ↓
          </button>
        </div>
      </section>

      {/* 2 — Rank the meaning of history (drag) */}
      <section data-idx={1} className="onb-panel onb-top">
        <p className="onb-q onb-r" style={{ color: 'var(--th-secondary)' }}>But first&hellip;</p>
        <h2 className="onb-lead onb-r mt-3" style={{ '--d': '0.15s', fontWeight: 600, color: 'var(--th-text)' } as React.CSSProperties}>Let&rsquo;s see how we understand the past.</h2>
        <p className="onb-lead onb-r mt-4" style={{ '--d': '0.28s' } as React.CSSProperties}>What do you think is the meaning of <span className="onb-em">history?</span></p>
        <p className="onb-r text-[15px] italic mt-1" style={{ '--d': '0.34s', color: 'var(--th-text)', opacity: 0.65 } as React.CSSProperties}>Drag to rank them — no wrong answer.</p>
        <div className="onb-r mt-5" style={{ '--d': '0.42s' } as React.CSSProperties}>
          <SortableRank />
        </div>
      </section>

      {/* 3 — Thanks (new lines after "…", varied alignment) */}
      <section data-idx={2} className="onb-panel">
        <p className="onb-q onb-r" style={{ color: 'var(--th-primary)', fontSize: 'clamp(30px, 8.5vw, 48px)' }}>Thanks for sharing<br />what you think.</p>
        <p className="onb-lead onb-r mt-8" style={{ '--d': '0.25s' } as React.CSSProperties}>We might have different thoughts of the meaning of history&hellip;</p>
        <p className="onb-lead onb-r mt-5 ml-auto text-right" style={{ '--d': '0.5s', maxWidth: '22ch' } as React.CSSProperties}>
          but most of us learned it as <span className="onb-em">lists of people, dates, and events</span> &mdash; often just a <span className="onb-em">story.</span>
        </p>
      </section>

      {/* 4 — Fragments → bigger picture */}
      <section data-idx={3} className="onb-panel onb-bottom">
        <p className="onb-lead onb-r">But people, dates, and events are like <Reconstruct text="fragments" />.</p>
        <p className="onb-lead onb-r mt-6" style={{ '--d': '0.3s' } as React.CSSProperties}>To understand the past, we piece those fragments back into the</p>
        <p className="onb-r mt-2" style={{ '--d': '0.55s' } as React.CSSProperties}>
          <span className="onb-q" style={{ color: 'var(--th-primary)', fontSize: 'clamp(40px, 12vw, 66px)' }}>bigger picture.</span>
        </p>
      </section>

      {/* 5 — Reconstruct → Context */}
      <section data-idx={4} className="onb-panel">
        <p className="onb-lead onb-r">That&rsquo;s how a historian thinks.</p>
        <p className="onb-lead onb-r mt-5" style={{ '--d': '0.28s' } as React.CSSProperties}>
          To understand the past, they first <Reconstruct text="reconstruct" />{' '}that picture &mdash; the world around the people and events.
        </p>
        <p className="onb-lead onb-r mt-8" style={{ '--d': '0.9s', opacity: 0.85 } as React.CSSProperties}>That world is what historians call&hellip;</p>
        <p className="onb-r mt-4" style={{ '--d': '1.1s' } as React.CSSProperties}><span className="onb-ctx" style={{ fontSize: 'clamp(46px, 15vw, 74px)' }}>Context</span></p>
      </section>

      {/* 6 — Definition (only emphasis coloured) */}
      <section data-idx={5} className="onb-panel onb-top">
        <p className="onb-lead onb-r" style={{ opacity: 0.85 }}>Therefore, contextualising is&hellip;</p>
        <p className="onb-q onb-r mt-4" style={{ '--d': '0.3s', color: 'var(--th-text)', fontSize: 'clamp(30px, 8vw, 46px)' } as React.CSSProperties}>
          Reconstructing a <span style={{ color: 'var(--th-primary)' }}>time and place</span> in the past&hellip;
        </p>
        <p className="onb-q onb-r mt-4" style={{ '--d': '0.55s', color: 'var(--th-text)', fontSize: 'clamp(30px, 8vw, 46px)' } as React.CSSProperties}>
          then using it to understand its <span style={{ color: 'var(--th-primary)' }}>people and events.</span>
        </p>
      </section>

      {/* 7 — So how? (tap the blurred phrase) */}
      <section data-idx={6} className="onb-panel onb-cx">
        <SlideAsk />
      </section>

      {/* 8 — Provenance + P.A.S.T. */}
      <section data-idx={7} className="onb-panel onb-top">
        <p className="onb-q onb-r" style={{ color: 'var(--th-text)', fontSize: 'clamp(30px, 8vw, 46px)' }}>This is where <span style={{ color: 'var(--th-primary)' }}>Provenance</span> comes in.</p>
        <p className="onb-lead onb-r mt-5" style={{ '--d': '0.25s' } as React.CSSProperties}>We use the <PastWord /> framework to think about different lenses of context&hellip;</p>
        <p className="onb-lead onb-r mt-4" style={{ '--d': '0.45s' } as React.CSSProperties}>then <span className="onb-em">ask questions</span> to <Reconstruct text="reconstruct" />{' '}the world around you.</p>
      </section>

      {/* 9 — The P.A.S.T. lenses */}
      <section data-idx={8} className="onb-panel onb-top">
        <p className="onb-lead onb-r" style={{ fontSize: 'clamp(21px, 5.6vw, 26px)' }}>Here are the lenses of the <PastWord /> to help frame your questions.</p>
        <div className="onb-r mt-5" style={{ '--d': '0.3s' } as React.CSSProperties}><PastFramework /></div>
      </section>

      {/* 10 — Explore → Contextualise → Reflect */}
      <section data-idx={9} className="onb-panel onb-cx">
        <p className="onb-lead onb-r italic" style={{ opacity: 0.85 }}>In this experience you will&hellip;</p>
        <div className="onb-r mt-6 flex flex-col items-center gap-1" style={{ '--d': '0.25s' } as React.CSSProperties}>
          {FLOW.map((f, i) => (
            <div key={f.word} className="flex flex-col items-center">
              <p className="font-display leading-none" style={{ color: f.colour, fontSize: 'clamp(34px, 10vw, 52px)' }}>{f.word}</p>
              <p className="mt-1 font-serif text-[17px]" style={{ color: 'var(--th-text)', opacity: 0.8 }}>{f.sub}</p>
              {i < FLOW.length - 1 && (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--th-secondary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="my-2"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
              )}
            </div>
          ))}
        </div>
        <p className="onb-lead onb-r italic mt-6" style={{ '--d': '0.5s', opacity: 0.85 } as React.CSSProperties}>&hellip; to think like a historian.</p>
      </section>

      {/* 11 — Why it matters */}
      <section data-idx={10} className="onb-panel">
        <SlideWhy />
      </section>

      {/* 12 — Ready → Find a Tour */}
      <section data-idx={11} className="onb-panel onb-cx">
        <SlideReady onDone={onDone} />
      </section>
    </div>
  );
});

/* ── Slide 7: tap the blurred phrase ──────────────────────────────── */
function SlideAsk() {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <p className="onb-q onb-r" style={{ color: 'var(--th-primary)', fontSize: 'clamp(32px, 9vw, 50px)' }}>So how do we do it?!</p>
      <p className="onb-lead onb-r mt-7" style={{ '--d': '0.25s' } as React.CSSProperties}>By&hellip;</p>
      <button
        onClick={() => { if (!revealed) { setRevealed(true); haptic(18); } }}
        className="onb-r mt-2 font-display leading-tight transition-all duration-500"
        style={{ '--d': '0.4s', color: 'var(--th-primary)', fontSize: 'clamp(30px, 8.5vw, 48px)', filter: revealed ? 'none' : 'blur(10px)', cursor: revealed ? 'default' : 'pointer' } as React.CSSProperties}
      >
        asking the right questions.
      </button>
      {!revealed && <p className="onb-r mt-6 text-[15px] italic" style={{ '--d': '0.6s', color: 'var(--th-text)', opacity: 0.6 } as React.CSSProperties}>Tap to reveal</p>}
    </>
  );
}

/* ── Slide 10 data ────────────────────────────────────────────────── */
const FLOW = [
  { word: 'Explore', sub: 'Find stops like you are on a tour', colour: 'var(--th-primary)' },
  { word: 'Contextualise', sub: 'Apply the P.A.S.T. and ask for more context', colour: '#E08A5F' },
  { word: 'Reflect', sub: 'Share your thoughts!', colour: 'var(--th-secondary)' },
];

/* ── Slide 11: why it matters (reveal one at a time on scroll) ─────── */
function RedWord({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--th-primary)', fontWeight: 700 }}>{children}</span>;
}
function SlideWhy() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let started = false;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting && !started) {
        started = true;
        [0, 1, 2].forEach((i) => window.setTimeout(() => setShown((s) => Math.max(s, i + 1)), 300 + i * 850));
      }
    }), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const lines = [
    <><RedWord>Question</RedWord> and see past what is in front of us.</>,
    <><RedWord>Connect</RedWord> better to the past.</>,
    <><RedWord>Map out</RedWord> the past from one place to another using <RedWord>context!</RedWord></>,
  ];
  return (
    <div ref={ref}>
      <p className="onb-lead onb-r" style={{ fontSize: 'clamp(22px, 6vw, 28px)' }}>Contextualising is important because it helps us&hellip;</p>
      <div className="mt-7 space-y-6">
        {lines.map((line, i) => (
          <p key={i} className="onb-q transition-all duration-700"
            style={{ color: 'var(--th-text)', fontSize: 'clamp(28px, 7.5vw, 42px)', lineHeight: 1.12, opacity: i < shown ? 1 : 0, transform: i < shown ? 'translateY(0)' : 'translateY(14px)' }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ── Slide 12: ready → Find a Tour ────────────────────────────────── */
function SlideReady({ onDone }: { onDone: () => void }) {
  const [yes, setYes] = useState(false);
  return (
    <>
      <h2 className="onb-q onb-r" style={{ color: 'var(--th-text)', fontSize: 'clamp(32px, 9vw, 50px)' }}>You think you&rsquo;re ready to think like a <span style={{ color: 'var(--th-primary)' }}>historian?</span></h2>
      {!yes ? (
        <button onClick={() => { setYes(true); haptic(); }} className="onb-r mt-9 px-12 py-4 rounded-full text-[18px] font-semibold" style={{ '--d': '0.3s', backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' } as React.CSSProperties}>
          Yes!
        </button>
      ) : (
        <div className="mt-7 flex flex-col items-center animate-fade-in">
          <p className="onb-lead" style={{ maxWidth: '24ch' }}>Let&rsquo;s go explore the world! Remember to use the <PastWord /> to ask questions along the way.</p>
          <button onClick={onDone} className="mt-9 px-12 py-4 rounded-full text-[18px] font-semibold" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
            Find a Tour →
          </button>
        </div>
      )}
    </>
  );
}

/* ── Drag-to-rank list (pointer-based; works inside the snap scroller) ─ */
const RANK_KEY = 'provenance.historyRanking';
const RANK_INITIAL = [
  'Reconstruction and explanation of the past',
  'What people remember about the past',
  'Names, dates, and events of what happened',
];
function SortableRank() {
  const [order, setOrder] = useState<string[]>(RANK_INITIAL);
  const [dragging, setDragging] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const onDown = (i: number) => (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(i);
    haptic(8);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging === null) return;
    e.preventDefault();
    const y = e.clientY;
    let target = dragging;
    for (let k = 0; k < order.length; k++) {
      const r = rowRefs.current[k]?.getBoundingClientRect();
      if (r && y >= r.top && y <= r.bottom) { target = k; break; }
    }
    if (target !== dragging) {
      setOrder((prev) => { const n = [...prev]; const [it] = n.splice(dragging, 1); n.splice(target, 0, it); return n; });
      setDragging(target);
      haptic(12);
    }
  };
  const onUp = () => {
    if (dragging !== null) { try { localStorage.setItem(RANK_KEY, JSON.stringify(order)); } catch {} }
    setDragging(null);
  };

  return (
    <div className="space-y-2.5" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {order.map((label, i) => (
        <div
          key={label}
          ref={(el) => { rowRefs.current[i] = el; }}
          className="flex items-center gap-3 rounded-2xl border-2 px-3 py-3.5 transition-shadow"
          style={{
            borderColor: dragging === i ? 'var(--th-primary)' : 'var(--th-border)',
            backgroundColor: 'var(--th-surface)',
            boxShadow: dragging === i ? '0 10px 24px rgba(0,0,0,0.18)' : '0 1px 2px rgba(0,0,0,0.04)',
            transform: dragging === i ? 'scale(1.02)' : 'none',
          }}
        >
          <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[16px] shrink-0" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>{i + 1}</span>
          <span className="flex-1 font-serif" style={{ color: 'var(--th-text)', fontSize: 'clamp(16px, 4.4vw, 19px)' }}>{label}</span>
          {/* drag handle — touch-action none so a drag reorders instead of scrolling */}
          <span
            onPointerDown={onDown(i)}
            aria-label="Drag to reorder"
            className="shrink-0 p-1.5 cursor-grab active:cursor-grabbing"
            style={{ color: 'var(--th-primary)', touchAction: 'none' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
              <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
              <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
            </svg>
          </span>
        </div>
      ))}
    </div>
  );
}

/* "P.A.S.T." with each letter coloured to match its lens. */
function PastWord() {
  return (
    <strong className="onb-past">
      <span style={{ color: 'var(--onb-place)' }}>P</span>.
      <span style={{ color: 'var(--th-secondary)' }}>A</span>.
      <span style={{ color: 'var(--onb-society)' }}>S</span>.
      <span style={{ color: 'var(--onb-time)' }}>T</span>.
    </strong>
  );
}

/* Letters start scattered (a derangement) and assemble into place when the word
   scrolls into view. Renders an inline word; callers add the following space. */
function Reconstruct({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll('span[data-l]')) as HTMLElement[];
    if (spans.length < 2) return;
    const xs = spans.map((s) => s.offsetLeft);
    const shuffle = (a: number[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const derange = (n: number) => { let o: number[]; do { o = shuffle([...Array(n).keys()]); } while (n > 1 && o.some((v, i) => v === i)); return o; };
    let done = false;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting || done) return;
      done = true;
      const order = derange(spans.length);
      spans.forEach((s, i) => {
        s.style.transition = 'none';
        s.style.transform = `translate(${(xs[order[i]] - xs[i]).toFixed(1)}px, ${(Math.random() * 6 - 3).toFixed(1)}px) rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;
        s.style.opacity = '0.8';
      });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        spans.forEach((s, i) => {
          s.style.transition = 'transform .6s cubic-bezier(.34,1.32,.5,1), opacity .45s ease';
          s.style.transitionDelay = `${(i * 0.05).toFixed(2)}s`;
          s.style.transform = 'none';
          s.style.opacity = '1';
        });
      }));
    }), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className="onb-em" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
      {text.split('').map((c, i) => (<span key={i} data-l style={{ display: 'inline-block', willChange: 'transform' }}>{c}</span>))}
    </span>
  );
}
