'use client';

/**
 * First-open contextualization onboarding — a snap-scroll teaching flow of 12
 * slides. Big editorial type, staggered reveal-on-scroll, varied alignment.
 * A fixed progress bar tracks which of the 12 the reader is on (Welcome = #1).
 *
 * Mostly free snap-scroll, with three *gates* that must be satisfied to move on:
 * slide 2 (Submit the ranking), slide 8 (Explore the P.A.S.T.), slide 9 (reveal
 * every lens). A gate simply hides the panels beyond it until satisfied, so the
 * scroll naturally ends there — no fragile scroll-locking. Skip is always there.
 *
 * The panels live in a memoized child so tracking the current slide only
 * re-renders the thin progress bar, not the whole (animation-heavy) tree.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import PastFramework from './PastFramework';

const LEAVE_MS = 500;
const TOTAL = 12;
const GATES = [1, 7, 8]; // panel indices that block forward progress until satisfied

function haptic(ms = 10) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

export default function ContextOnboarding({ children }: { children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [current, setCurrent] = useState(0);
  const [revealedMax, setRevealedMax] = useState(1); // highest panel index shown (gate at 1)
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

  const scrollToPanel = useCallback((i: number) => {
    const root = screenRef.current;
    if (!root) return;
    // Defer with a macrotask (NOT rAF, which pauses while the tab is backgrounded)
    // so freshly-revealed panels are laid out first. Mandatory scroll-snap swallows
    // a programmatic scroll, so disable it, jump, then restore once it settles
    // (re-enabling too early snaps the not-yet-committed scroll back to the origin).
    window.setTimeout(() => {
      const panel = root.querySelectorAll('.onb-panel')[i] as HTMLElement | undefined;
      if (!panel) return;
      root.style.scrollSnapType = 'none';
      root.scrollTop = panel.offsetTop;
      window.setTimeout(() => { root.style.scrollSnapType = ''; }, 220);
    }, 0);
  }, []);

  // Satisfy a gate: reveal the panels through to the next gate (or the end) and,
  // for button gates, scroll on to the first freshly-revealed panel.
  const satisfyGate = useCallback((panelIdx: number, autoScroll: boolean) => {
    setRevealedMax((prev) => Math.max(prev, GATES.find((g) => g > panelIdx) ?? TOTAL - 1));
    if (autoScroll) scrollToPanel(panelIdx + 1);
  }, [scrollToPanel]);

  const onBegin = useCallback(() => { haptic(); scrollToPanel(1); }, [scrollToPanel]);
  const onSubmitRank = useCallback(() => { haptic(); satisfyGate(1, true); }, [satisfyGate]);
  const onExplorePast = useCallback(() => { haptic(); satisfyGate(7, true); }, [satisfyGate]);
  const onLensesDone = useCallback(() => { satisfyGate(8, false); }, [satisfyGate]);

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

      <OnbPanels
        screenRef={screenRef}
        leaving={leaving}
        revealedMax={revealedMax}
        onBegin={onBegin}
        onSubmitRank={onSubmitRank}
        onExplorePast={onExplorePast}
        onLensesDone={onLensesDone}
        onDone={dismiss}
      />
    </>
  );
}

/* ── The panels (memoized: scroll-tracking never re-renders this) ─────── */
const OnbPanels = memo(function OnbPanels({
  screenRef, leaving, revealedMax, onBegin, onSubmitRank, onExplorePast, onLensesDone, onDone,
}: {
  screenRef: React.RefObject<HTMLDivElement | null>;
  leaving: boolean;
  revealedMax: number;
  onBegin: () => void;
  onSubmitRank: () => void;
  onExplorePast: () => void;
  onLensesDone: () => void;
  onDone: () => void;
}) {
  const vis = (i: number): React.CSSProperties | undefined => (i <= revealedMax ? undefined : { display: 'none' });
  return (
    <div className={`onb-screen ${leaving ? 'onb-leaving' : ''}`} ref={screenRef} aria-label="Introduction">
      {/* 1 — Welcome */}
      <section data-idx={0} className="onb-panel onb-cx onb-in" style={vis(0)}>
        <SlideWelcome onBegin={onBegin} />
      </section>

      {/* 2 — What do you think history is? (drag to rank, Submit to go on) */}
      <section data-idx={1} className="onb-panel onb-top" style={vis(1)}>
        <p className="onb-q onb-r" style={{ color: 'var(--th-secondary)' }}>But first&hellip;</p>
        <h2 className="onb-r mt-4 font-display" style={{ '--d': '0.18s', fontSize: 'clamp(28px, 7vw, 40px)', lineHeight: 1.08, color: 'var(--th-text)' } as React.CSSProperties}>
          What do you think <span style={{ color: 'var(--th-primary)' }}>history</span> is?
        </h2>
        <p className="onb-r text-[15px] italic mt-2" style={{ '--d': '0.3s', color: 'var(--th-text)', opacity: 0.65 } as React.CSSProperties}>Drag to rank them &mdash; no wrong answer.</p>
        <div className="onb-r mt-5" style={{ '--d': '0.4s' } as React.CSSProperties}>
          <SortableRank onSubmit={onSubmitRank} />
        </div>
      </section>

      {/* 3 — Thanks (paragraphs fade one at a time) */}
      <section data-idx={2} className="onb-panel" style={vis(2)}>
        <p className="onb-q onb-r" style={{ '--d': '0.1s', color: 'var(--th-primary)', fontSize: 'clamp(30px, 8.5vw, 46px)' } as React.CSSProperties}>Thanks for sharing<br />what you think.</p>
        <p className="onb-lead onb-r mt-16" style={{ '--d': '1.1s' } as React.CSSProperties}>We might have different thoughts on history&hellip;</p>
        <p className="onb-lead onb-r mt-6" style={{ '--d': '2.1s' } as React.CSSProperties}>
          &hellip; but most of us learned it as lists of <strong><em>people, dates, and events</em></strong> &mdash; sometimes as a story!
        </p>
      </section>

      {/* 4 — Fragments (near the top; pieces come together) */}
      <section data-idx={3} className="onb-panel onb-top" style={vis(3)}>
        <p className="onb-lead onb-r">But people, dates, and events are like <Pieces text="fragments" />.</p>
        <p className="onb-lead onb-r mt-10 ml-auto text-right" style={{ '--d': '0.4s', maxWidth: '24ch' } as React.CSSProperties}>
          To understand the past, we need to piece those fragments back into the <strong style={{ color: 'var(--th-primary)' }}>bigger picture.</strong>
        </p>
      </section>

      {/* 5 — Reconstruct → Context (slow, spaced reveal) */}
      <section data-idx={4} className="onb-panel" style={vis(4)}>
        <p className="onb-lead onb-r" style={{ '--d': '0.1s' } as React.CSSProperties}><strong>That&rsquo;s how a historian thinks.</strong></p>
        <p className="onb-lead onb-r mt-6" style={{ '--d': '1.0s' } as React.CSSProperties}>
          To understand the past, they first <Reconstruct text="reconstruct" />{' '}the bigger picture &mdash; or the world around people and events.
        </p>
        <p className="onb-lead onb-r mt-16 text-center italic" style={{ '--d': '2.2s' } as React.CSSProperties}>That world is what historians call&hellip;</p>
        <p className="onb-r mt-5 text-center" style={{ '--d': '3.0s', transitionDuration: '1.3s' } as React.CSSProperties}><span className="onb-ctx" style={{ fontSize: 'clamp(46px, 15vw, 74px)' }}>Context</span></p>
      </section>

      {/* 6 — Definition (vertically centred; sparse emphasis) */}
      <section data-idx={5} className="onb-panel" style={vis(5)}>
        <p className="onb-lead onb-r" style={{ opacity: 0.85 }}>Contextualising is&hellip;</p>
        <p className="onb-q onb-r mt-5" style={{ '--d': '0.3s', color: 'var(--th-text)', fontSize: 'clamp(28px, 7.5vw, 44px)' } as React.CSSProperties}>
          <strong>Reconstructing</strong> a <em>time and place</em> in the past&hellip;
        </p>
        <p className="onb-q onb-r mt-6 ml-auto text-right" style={{ '--d': '0.6s', color: 'var(--th-text)', fontSize: 'clamp(28px, 7.5vw, 44px)' } as React.CSSProperties}>
          &hellip; then using it to understand <strong>people and events.</strong>
        </p>
      </section>

      {/* 7 — So how? (tap the blurred phrase) */}
      <section data-idx={6} className="onb-panel onb-top" style={vis(6)}>
        <SlideAsk />
      </section>

      {/* 8 — Provenance + P.A.S.T. (button to go on) */}
      <section data-idx={7} className="onb-panel onb-top" style={vis(7)}>
        <p className="onb-q onb-r" style={{ color: 'var(--th-text)', fontSize: 'clamp(28px, 7.5vw, 44px)' }}>This is where <span style={{ color: 'var(--th-primary)' }}>Provenance</span> comes in.</p>
        <p className="onb-lead onb-r mt-12" style={{ '--d': '0.3s' } as React.CSSProperties}>
          We use the <PastWord /> framework to help you think about <strong style={{ color: 'var(--th-primary)' }}>context</strong> in <em>different lenses</em>&hellip;
        </p>
        <p className="onb-lead onb-r mt-5 ml-auto text-right" style={{ '--d': '0.55s' } as React.CSSProperties}>
          &hellip; then we <strong>ask questions</strong> to <Reconstruct text="reconstruct" />{' '}the world around us.
        </p>
        <button onClick={onExplorePast} className="onb-r mt-9 px-8 py-3.5 rounded-full text-[16px] font-semibold self-start" style={{ '--d': '0.8s', backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' } as React.CSSProperties}>
          Explore the P.A.S.T. &rarr;
        </button>
      </section>

      {/* 9 — The lenses (reveal all to unlock the scroll) */}
      <section data-idx={8} className="onb-panel onb-top" style={vis(8)}>
        <SlideLenses onDone={onLensesDone} />
      </section>

      {/* 10 — Explore → Contextualise → Reflect */}
      <section data-idx={9} className="onb-panel" style={vis(9)}>
        <p className="onb-lead onb-r italic" style={{ opacity: 0.85 }}>In this experience you will&hellip;</p>
        <div className="mt-8 flex flex-col items-center text-center">
          {FLOW.map((f, i) => (
            <div key={f.word} className="onb-r flex flex-col items-center" style={{ '--d': `${0.3 + i * 0.8}s` } as React.CSSProperties}>
              <p className="font-display leading-none" style={{ color: f.colour, fontSize: 'clamp(40px, 12vw, 62px)' }}>{f.word}</p>
              <p className="mt-1 font-serif text-[17px]" style={{ color: 'var(--th-text)', opacity: 0.8 }}>{f.sub}</p>
              {i < FLOW.length - 1 && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--th-secondary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="my-3"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
              )}
            </div>
          ))}
        </div>
        <p className="onb-lead onb-r italic mt-8 ml-auto text-right" style={{ '--d': '2.7s' } as React.CSSProperties}>&hellip; to think like a historian.</p>
      </section>

      {/* 11 — Why it matters */}
      <section data-idx={10} className="onb-panel" style={vis(10)}>
        <SlideWhy />
      </section>

      {/* 12 — Ready → Find a Tour */}
      <section data-idx={11} className="onb-panel onb-cx" style={vis(11)}>
        <SlideReady onDone={onDone} />
      </section>
    </div>
  );
});

/* ── 1 · Welcome — CTA appears after the logo/wordmark animation ─────── */
function SlideWelcome({ onBegin }: { onBegin: () => void }) {
  const [showCta, setShowCta] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setShowCta(true), 1700); return () => window.clearTimeout(t); }, []);
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_transparent.png" alt="" width={200} height={200} className="splash-pin block w-44 h-auto select-none" draggable={false} />
        <div className="splash-shadow absolute left-1/2 -bottom-3 h-3 w-36 rounded-[50%]" style={{ backgroundColor: 'rgba(0,0,0,0.1)', filter: 'blur(5px)' }} />
      </div>
      <p className="splash-wordmark onb-title mt-6">Welcome to Provenance!</p>
      {showCta && (
        <div className="flex flex-col items-center animate-fade-in">
          <p className="onb-lead mt-5">Ready to think like a historian?</p>
          <button onClick={onBegin} className="mt-9 px-9 py-4 rounded-full text-[17px] font-semibold" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
            Let&rsquo;s begin &darr;
          </button>
        </div>
      )}
    </div>
  );
}

/* ── 7 · So how? (tap the blurred phrase) ──────────────────────────── */
function SlideAsk() {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <p className="onb-r" style={{ fontStyle: 'italic', color: 'var(--th-text)', fontFamily: 'var(--th-font-display, "DM Serif Display"), serif', fontSize: 'clamp(30px, 8vw, 46px)', lineHeight: 1.1 }}>So how do we do it?</p>
      <p className="onb-lead onb-r mt-2" style={{ '--d': '0.15s' } as React.CSSProperties}>By&hellip;</p>
      <button
        onClick={() => { if (!revealed) { setRevealed(true); haptic(18); } }}
        className="onb-r mt-14 font-display leading-tight text-left transition-all duration-500"
        style={{ '--d': '0.3s', color: 'var(--th-secondary)', fontSize: 'clamp(34px, 9.5vw, 56px)', filter: revealed ? 'none' : 'blur(10px)', cursor: revealed ? 'default' : 'pointer' } as React.CSSProperties}
      >
        asking the right questions.
      </button>
      {!revealed && <p className="onb-r mt-6 text-[15px] italic" style={{ '--d': '0.5s', color: 'var(--th-text)', opacity: 0.6 } as React.CSSProperties}>Tap to reveal</p>}
    </>
  );
}

/* ── 9 · The P.A.S.T. lenses (reveal all → unlock) ─────────────────── */
function SlideLenses({ onDone }: { onDone: () => void }) {
  const [all, setAll] = useState(false);
  useEffect(() => { if (all) onDone(); }, [all, onDone]);
  return (
    <>
      <p className="onb-lead onb-r mb-4" style={{ fontSize: 'clamp(23px, 6vw, 28px)' }}>Check out the lenses of the <PastWord />!</p>
      <div className="onb-r" style={{ '--d': '0.25s' } as React.CSSProperties}>
        <PastFramework onAllRevealed={() => setAll(true)} />
      </div>
      {all && (
        <p className="mt-5 text-center font-serif animate-fade-in" style={{ fontSize: 'clamp(17px, 4.6vw, 20px)', color: 'var(--th-primary)' }}>
          Use these lenses to help ask context questions.
        </p>
      )}
    </>
  );
}

/* ── 10 · Explore → Contextualise → Reflect ────────────────────────── */
const FLOW = [
  { word: 'Explore', sub: 'Find stops like you are on a tour', colour: 'var(--th-primary)' },
  { word: 'Contextualise', sub: 'Apply the P.A.S.T. and ask for more context', colour: '#E08A5F' },
  { word: 'Reflect', sub: 'Share your thoughts!', colour: 'var(--th-secondary)' },
];

/* ── 11 · Why it matters (reveal one at a time on scroll) ──────────── */
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
        [0, 1, 2].forEach((i) => window.setTimeout(() => setShown((s) => Math.max(s, i + 1)), 400 + i * 1000));
      }
    }), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const small: React.CSSProperties = { fontSize: 'clamp(17px, 4.4vw, 20px)', color: 'var(--th-text)', opacity: 0.85 };
  const lines = [
    <><RedWord>Question</RedWord><span style={small}> and see past what is in front of us.</span></>,
    <><RedWord>Connect</RedWord><span style={small}> better to the past.</span></>,
    <><RedWord>Map out</RedWord><span style={small}> the past from one place to another using </span><RedWord>context</RedWord><span style={small}>!</span></>,
  ];
  return (
    <div ref={ref}>
      <p className="onb-r" style={{ fontFamily: 'var(--th-font-body, "Newsreader"), serif', fontSize: 'clamp(24px, 6.4vw, 32px)', lineHeight: 1.3, color: 'var(--th-text)' }}>
        <strong><em>Contextualising</em></strong> is important because it helps us&hellip;
      </p>
      <div className="mt-10 space-y-6">
        {lines.map((line, i) => (
          <p key={i} className="transition-all duration-700" style={{ fontSize: 'clamp(24px, 6.4vw, 30px)', lineHeight: 1.2, opacity: i < shown ? 1 : 0, transform: i < shown ? 'translateY(0)' : 'translateY(12px)' }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ── 12 · Ready → Find a Tour ──────────────────────────────────────── */
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
          <button onClick={() => { haptic(); onDone(); }} className="mt-9 px-12 py-4 rounded-full text-[18px] font-semibold" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
            Find a Tour &rarr;
          </button>
        </div>
      )}
    </>
  );
}

/* ── Drag-to-rank — pick a tile up and place it (absolute-position sortable) ─ */
const RANK_KEY = 'provenance.historyRanking';
const RANK_INITIAL = [
  'Reconstructing and interpreting the past',
  'What people remember about the past',
  'Names, dates, and events of what happened',
];
const ROW = 66, GAP = 12, STEP = ROW + GAP;
function SortableRank({ onSubmit }: { onSubmit: () => void }) {
  const [order, setOrder] = useState<string[]>(RANK_INITIAL);
  const [drag, setDrag] = useState<{ label: string; top: number } | null>(null);
  const contRef = useRef<HTMLDivElement | null>(null);
  const grab = useRef<{ label: string | null; off: number }>({ label: null, off: 0 });

  const onDown = (label: string) => (e: React.PointerEvent) => {
    const cont = contRef.current;
    if (!cont) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const slot = order.indexOf(label);
    const rect = cont.getBoundingClientRect();
    grab.current = { label, off: (e.clientY - rect.top) - slot * STEP };
    setDrag({ label, top: slot * STEP });
    haptic(12);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g.label) return;
    e.preventDefault();
    const cont = contRef.current;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    const maxTop = (order.length - 1) * STEP;
    const top = Math.max(0, Math.min(maxTop, (e.clientY - rect.top) - g.off));
    setDrag({ label: g.label, top });
    const target = Math.max(0, Math.min(order.length - 1, Math.round(top / STEP)));
    if (target !== order.indexOf(g.label)) {
      setOrder((prev) => { const n = prev.filter((l) => l !== g.label); n.splice(target, 0, g.label!); return n; });
      haptic(9);
    }
  };
  const onUp = () => {
    if (!grab.current.label) return;
    grab.current = { label: null, off: 0 };
    setDrag(null);
    try { localStorage.setItem(RANK_KEY, JSON.stringify(order)); } catch { /* ignore */ }
  };

  return (
    <>
      <div ref={contRef} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: 'relative', height: order.length * STEP - GAP }}>
        {order.map((label) => {
          const slot = order.indexOf(label);
          const isDrag = drag?.label === label;
          return (
            <div key={label} onPointerDown={onDown(label)}
              style={{
                position: 'absolute', left: 0, right: 0, height: ROW,
                top: isDrag ? drag!.top : slot * STEP,
                transition: isDrag ? 'none' : 'top .2s cubic-bezier(.2,.8,.2,1)',
                zIndex: isDrag ? 5 : 1, touchAction: 'none', cursor: isDrag ? 'grabbing' : 'grab',
              }}>
              <div className="flex items-center gap-3 h-full rounded-2xl border-2 px-3"
                style={{
                  borderColor: isDrag ? 'var(--th-primary)' : 'var(--th-border)',
                  backgroundColor: 'var(--th-surface)',
                  boxShadow: isDrag ? '0 12px 26px rgba(0,0,0,0.22)' : '0 1px 2px rgba(0,0,0,0.04)',
                  transform: isDrag ? 'scale(1.03)' : 'none',
                }}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[16px] shrink-0" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>{slot + 1}</span>
                <span className="flex-1 font-serif leading-tight" style={{ color: 'var(--th-text)', fontSize: 'clamp(15px, 4.2vw, 18px)' }}>{label}</span>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ color: 'var(--th-primary)', flexShrink: 0 }}>
                  <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                  <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                  <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={onSubmit} className="mt-6 w-full py-3.5 rounded-full text-[17px] font-semibold" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
        Submit
      </button>
    </>
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

/* "reconstruct" — letters shuffle among their own positions, then settle. */
function Reconstruct({ text }: { text: string }) {
  return <Animated text={text} mode="shuffle" />;
}
/* "fragments" — letters fly in as scattered pieces and converge into place. */
function Pieces({ text }: { text: string }) {
  return <Animated text={text} mode="pieces" />;
}
function Animated({ text, mode }: { text: string; mode: 'shuffle' | 'pieces' }) {
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
      if (mode === 'shuffle') {
        const order = derange(spans.length);
        spans.forEach((s, i) => {
          s.style.transition = 'none';
          s.style.transform = `translate(${(xs[order[i]] - xs[i]).toFixed(1)}px, ${(Math.random() * 6 - 3).toFixed(1)}px) rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;
          s.style.opacity = '0.8';
        });
      } else {
        spans.forEach((s) => {
          s.style.transition = 'none';
          const dx = (Math.random() * 180 - 90).toFixed(0);
          const dy = (Math.random() * 120 - 60).toFixed(0);
          s.style.transform = `translate(${dx}px, ${dy}px) rotate(${(Math.random() * 60 - 30).toFixed(0)}deg) scale(0.6)`;
          s.style.opacity = '0';
        });
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        spans.forEach((s, i) => {
          s.style.transition = 'transform .7s cubic-bezier(.34,1.28,.5,1), opacity .5s ease';
          s.style.transitionDelay = `${(i * 0.05).toFixed(2)}s`;
          s.style.transform = 'none';
          s.style.opacity = '1';
        });
      }));
    }), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [mode]);
  return (
    <span ref={ref} className="onb-em" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
      {text.split('').map((c, i) => (<span key={i} data-l style={{ display: 'inline-block', willChange: 'transform' }}>{c}</span>))}
    </span>
  );
}
