'use client';

/**
 * First-open onboarding — a snap-scroll teaching flow of 13 slides. Big editorial
 * type, staggered reveal-on-scroll, varied alignment. A fixed progress bar tracks
 * which of the 13 the reader is on (Welcome = #1).
 *
 * The argument runs: you were taught history as fragments → fragments tell you
 * what, not why → piecing them together is the bigger picture → that's what a
 * historian reconstructs → that world is Context → places are full of it, but we
 * only see the surface → Provenance helps you see past it → explore, contextualise,
 * reflect. It ends by handing you off to explore, because the P.A.S.T. is taught
 * at the first Context step, not here.
 *
 * **Pacing is the design.** Each panel's lines carry long `--d` delays so they
 * arrive one at a time with a real pause between them, and they land on different
 * sides of the page. Both are deliberate: a slide that drops four lines at once,
 * all left-aligned, reads as homework. Keep the gaps generous when editing.
 *
 * Mostly free snap-scroll with one *gate* — slide 2, which needs an answer before
 * the rest reveal. A gate simply hides the panels beyond it, so the scroll
 * naturally ends there — no fragile scroll-locking. Skip is always there.
 *
 * The panels live in a memoized child so tracking the current slide only
 * re-renders the thin progress bar, not the whole (animation-heavy) tree.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import RecordButton from '@/components/tour/cards/RecordButton';

const LEAVE_MS = 500;
const TOTAL = 13;
// Panel indices that block forward progress until satisfied. Just the one now:
// the P.A.S.T. teaching (and its two gates) moved out of the intro and into the
// first Context step, where the flow now says it belongs — "before we learn to
// contextualise, let's start by exploring".
const GATES = [1];

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
    // Defer with a macrotask (NOT rAF, which pauses while the tab is backgrounded).
    // A gate reveals its target panel via setState just before this runs; when we're
    // called outside a React event (e.g. from a timer), the commit can lag, so the
    // panel is still display:none (offsetTop 0). Retry until it's laid out. Mandatory
    // scroll-snap swallows a programmatic scroll, so disable it, jump, then restore
    // once settled (restoring too early snaps the scroll back to the origin).
    const attempt = (tries: number) => window.setTimeout(() => {
      const panel = root.querySelectorAll('.onb-panel')[i] as HTMLElement | undefined;
      if (!panel) return;
      if (i > 0 && panel.offsetTop === 0 && tries < 6) { attempt(tries + 1); return; }
      root.style.scrollSnapType = 'none';
      root.scrollTop = panel.offsetTop;
      window.setTimeout(() => { root.style.scrollSnapType = ''; }, 220);
    }, tries === 0 ? 0 : 40);
    attempt(0);
  }, []);

  // Satisfy a gate: reveal the panels through to the next gate (or the end) and,
  // for button gates, scroll on to the first freshly-revealed panel.
  const satisfyGate = useCallback((panelIdx: number, autoScroll: boolean) => {
    setRevealedMax((prev) => Math.max(prev, GATES.find((g) => g > panelIdx) ?? TOTAL - 1));
    if (autoScroll) scrollToPanel(panelIdx + 1);
  }, [scrollToPanel]);

  const onBegin = useCallback(() => { haptic(); scrollToPanel(1); }, [scrollToPanel]);
  const onSubmitRank = useCallback(() => { haptic(); satisfyGate(1, true); }, [satisfyGate]);

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
        onDone={dismiss}
      />
    </>
  );
}

/* ── The panels (memoized: scroll-tracking never re-renders this) ─────── */
const OnbPanels = memo(function OnbPanels({
  screenRef, leaving, revealedMax, onBegin, onSubmitRank, onDone,
}: {
  screenRef: React.RefObject<HTMLDivElement | null>;
  leaving: boolean;
  revealedMax: number;
  onBegin: () => void;
  onSubmitRank: () => void;
  onDone: () => void;
}) {
  const vis = (i: number): React.CSSProperties | undefined => (i <= revealedMax ? undefined : { display: 'none' });
  return (
    <div className={`onb-screen ${leaving ? 'onb-leaving' : ''}`} ref={screenRef} aria-label="Introduction">
      {/* 1 — Welcome */}
      <section data-idx={0} className="onb-panel onb-cx onb-in" style={vis(0)}>
        <SlideWelcome onBegin={onBegin} />
      </section>

      {/* 2 — How have you been taught history? (free response, Submit to go on) */}
      <section data-idx={1} className="onb-panel onb-top" style={vis(1)}>
        <p className="onb-q onb-r" style={{ color: 'var(--th-secondary)' }}>But first&hellip;</p>
        <h2 className="onb-r mt-4 font-display" style={{ '--d': '0.18s', fontSize: 'clamp(28px, 7vw, 40px)', lineHeight: 1.08, color: 'var(--th-text)' } as React.CSSProperties}>
          How have you been taught <span style={{ color: 'var(--th-primary)' }}>history</span>?
        </h2>
        <p className="onb-r text-[15px] italic mt-2" style={{ '--d': '0.3s', color: 'var(--th-text)', opacity: 0.65 } as React.CSSProperties}>Record or type &mdash; no wrong answer.</p>
        <div className="onb-r mt-5" style={{ '--d': '0.4s' } as React.CSSProperties}>
          <HistoryResponse onSubmit={onSubmitRank} />
        </div>
      </section>

      {/* 3 — Thanks. Three beats, each landing in a different place on the page —
             left, right, centre — so the eye moves and the slide doesn't read as
             one block. The long --d gaps are the point: they're pauses, not
             decoration. */}
      <section data-idx={2} className="onb-panel onb-bottom" style={vis(2)}>
        <p className="onb-q onb-r" style={{ '--d': '0.1s', color: 'var(--th-primary)', fontSize: 'clamp(30px, 8.5vw, 46px)' } as React.CSSProperties}>Thanks for sharing<br />what you think.</p>
        <p className="onb-lead onb-r mt-20" style={{ '--d': '0.9s' } as React.CSSProperties}>Maybe your experience was different&hellip;</p>
        <p className="onb-lead onb-r mt-6 ml-auto text-right" style={{ '--d': '1.8s', maxWidth: '26ch' } as React.CSSProperties}>
          &hellip; but most of us have been taught history as lists of <strong><em>people, dates, and events</em></strong>.
        </p>
        <p className="onb-lead onb-r mt-6 text-center italic" style={{ '--d': '2.7s' } as React.CSSProperties}>Perhaps as a story!</p>
      </section>

      {/* 4 — Fragments. The word itself is scattered and pulled back together
             (Pieces), which is the slide's whole argument in one image. */}
      <section data-idx={3} className="onb-panel onb-top" style={vis(3)}>
        <p className="onb-lead onb-r">But people, dates, and events are like <Pieces text="fragments" />.</p>
        <p className="onb-lead onb-r mt-14 text-center" style={{ '--d': '1.1s' } as React.CSSProperties}>
          They tell you <em>what happened</em>, but not always <strong style={{ color: 'var(--th-primary)' }}>why it happened</strong>.
        </p>
      </section>

      {/* 5 — The bigger picture, then the payoff line centred underneath. */}
      <section data-idx={4} className="onb-panel" style={vis(4)}>
        <p className="onb-lead onb-r" style={{ '--d': '0.1s' } as React.CSSProperties}>
          To understand the past, we need to piece those fragments into the{' '}
          <strong style={{ color: 'var(--th-primary)', fontSize: 'clamp(34px, 10vw, 56px)', display: 'inline-block', lineHeight: 1.05 }}>bigger picture.</strong>
        </p>
        <p className="onb-lead onb-r mt-16 text-center" style={{ '--d': '1.4s' } as React.CSSProperties}><strong>That&rsquo;s how a historian thinks.</strong></p>
      </section>

      {/* 6 — Reconstruct (letters shuffle and settle), then the world it rebuilds. */}
      <section data-idx={5} className="onb-panel" style={vis(5)}>
        <p className="onb-lead onb-r" style={{ '--d': '0.1s' } as React.CSSProperties}>
          To understand the past, they first <Reconstruct text="reconstruct" />{' '}the bigger picture&hellip;
        </p>
        <p className="onb-lead onb-r mt-10 ml-auto text-right" style={{ '--d': '1.2s', maxWidth: '24ch' } as React.CSSProperties}>
          &hellip; the world around the <em>people</em> and <em>events</em>.
        </p>
      </section>

      {/* 7 — The word itself. Nothing else on the page; the long delay and slow
             fade give it room to land. */}
      <section data-idx={6} className="onb-panel onb-cx" style={vis(6)}>
        <p className="onb-lead onb-r italic" style={{ '--d': '0.2s' } as React.CSSProperties}>That world is what historians call&hellip;</p>
        <p className="onb-r mt-8" style={{ '--d': '1.4s', transitionDuration: '1.3s' } as React.CSSProperties}><span className="onb-ctx" style={{ fontSize: 'clamp(46px, 15vw, 74px)' }}>Context</span></p>
      </section>

      {/* 8 — The definition, in four beats. Left, left, right, right: the two
             halves of the sentence sit on opposite sides of the page. */}
      <section data-idx={7} className="onb-panel" style={vis(7)}>
        <p className="onb-lead onb-r" style={{ '--d': '0.1s', opacity: 0.85 } as React.CSSProperties}>Contextualising is&hellip;</p>
        <p className="onb-lead onb-r mt-10" style={{ '--d': '0.9s' } as React.CSSProperties}>
          <Reconstruct text="Reconstructing" />{' '}the world during a <em>time and place</em>&hellip;
        </p>
        <p className="onb-lead onb-r mt-8 ml-auto text-right" style={{ '--d': '1.8s', maxWidth: '24ch' } as React.CSSProperties}>
          {/* {' '} not a plain space: a JSX text chunk containing a newline gets
              BOTH ends trimmed, so a space after an element that runs to the end
              of the line is silently eaten ("understandwhy"). */}
          &hellip; then using that world to <strong>understand</strong>{' '}why people did what they did&hellip;
        </p>
        <p className="onb-lead onb-r mt-5 ml-auto text-right" style={{ '--d': '2.5s', maxWidth: '24ch' } as React.CSSProperties}>
          &hellip; and why <strong>events happened</strong>.
        </p>
      </section>

      {/* 9 — Places. Centre, then left, then right — the turn at "But often" lands
             on the opposite side from the line before it. */}
      <section data-idx={8} className="onb-panel" style={vis(8)}>
        <p className="onb-q onb-r text-center" style={{ '--d': '0.1s', color: 'var(--th-primary)', fontSize: 'clamp(28px, 7.5vw, 44px)' } as React.CSSProperties}>The places around us are full of history!</p>
        <p className="onb-lead onb-r mt-14" style={{ '--d': '1.1s' } as React.CSSProperties}>It&rsquo;s where we often learn about the past.</p>
        <p className="onb-lead onb-r mt-8 ml-auto text-right" style={{ '--d': '2.0s', maxWidth: '24ch' } as React.CSSProperties}>
          But often, we only see <strong>what is in front of us</strong>.
        </p>
      </section>

      {/* 10 — Provenance. */}
      <section data-idx={9} className="onb-panel onb-bottom" style={vis(9)}>
        <p className="onb-q onb-r" style={{ '--d': '0.1s', color: 'var(--th-text)', fontSize: 'clamp(28px, 7.5vw, 44px)' } as React.CSSProperties}>
          This is where <span style={{ color: 'var(--th-primary)' }}>Provenance</span> comes in.
        </p>
        <p className="onb-lead onb-r mt-14 text-center" style={{ '--d': '1.1s' } as React.CSSProperties}>
          We want to help you see <strong style={{ color: 'var(--th-primary)' }}>beyond</strong>{' '}what&rsquo;s in front.
        </p>
      </section>

      {/* 11 — The promise. First line centred in the middle of the page, second
             pushed to the bottom-right corner (mt-auto against the panel's own
             padding), so the sentence physically spans the slide. */}
      <section data-idx={10} className="onb-panel" style={vis(10)}>
        <p className="onb-lead onb-r text-center" style={{ '--d': '0.2s' } as React.CSSProperties}>
          We want to help you <strong style={{ color: 'var(--th-primary)' }}>contextualise</strong> and <Reconstruct text="reconstruct" />
        </p>
        <p className="onb-lead onb-r mt-auto pt-24 ml-auto text-right" style={{ '--d': '1.5s', maxWidth: '22ch' } as React.CSSProperties}>
          the world of the past using <strong>what&rsquo;s in front of you</strong>.
        </p>
      </section>

      {/* 12 — Explore → Contextualise → Reflect */}
      <section data-idx={11} className="onb-panel" style={vis(11)}>
        <p className="onb-lead onb-r italic" style={{ opacity: 0.85 }}>In this experience, you will&hellip;</p>
        <div className="mt-8 flex flex-col items-center text-center">
          {FLOW.map((f, i) => (
            <div key={f.word} className="onb-r flex flex-col items-center" style={{ '--d': `${0.25 + i * 0.5}s` } as React.CSSProperties}>
              <p className="font-display leading-none" style={{ color: f.colour, fontSize: 'clamp(46px, 14vw, 74px)' }}>{f.word}</p>
              <p className="mt-1 font-serif text-[17px]" style={{ color: 'var(--th-text)', opacity: 0.8 }}>{f.sub}</p>
              {i < FLOW.length - 1 && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--th-secondary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="my-3"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 13 — Off to explore */}
      <section data-idx={12} className="onb-panel onb-cx" style={vis(12)}>
        <SlideExplore onDone={onDone} />
      </section>
    </div>
  );
});

/* ── 1 · Welcome — CTA appears after the logo/wordmark animation ─────── */
function SlideWelcome({ onBegin }: { onBegin: () => void }) {
  const [showReady, setShowReady] = useState(false);
  const [showBtn, setShowBtn] = useState(false);
  useEffect(() => {
    const t1 = window.setTimeout(() => setShowReady(true), 1700);
    const t2 = window.setTimeout(() => setShowBtn(true), 2500);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_transparent.png" alt="" width={200} height={200} className="splash-pin block w-44 h-auto select-none" draggable={false} />
        <div className="splash-shadow absolute left-1/2 -bottom-3 h-3 w-36 rounded-[50%]" style={{ backgroundColor: 'rgba(0,0,0,0.1)', filter: 'blur(5px)' }} />
      </div>
      <p className="splash-wordmark onb-title mt-6">Welcome to Provenance!</p>
      {/* "Ready…" fades in first, the button follows. */}
      <p className="onb-lead mt-5 transition-opacity duration-700" style={{ opacity: showReady ? 1 : 0 }}>Ready to think like a historian?</p>
      <button onClick={onBegin} className="mt-9 px-9 py-4 rounded-full text-[17px] font-semibold transition-opacity duration-500" style={{ opacity: showBtn ? 1 : 0, pointerEvents: showBtn ? 'auto' : 'none', backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
        Let&rsquo;s begin &darr;
      </button>
    </div>
  );
}

/* ── 12 · Explore → Contextualise → Reflect ────────────────────────── */
const FLOW = [
  { word: 'Explore', sub: 'Find stops like you are on a tour', colour: 'var(--th-primary)' },
  { word: 'Contextualise', sub: 'Ask questions! Reconstruct the past.', colour: '#E08A5F' },
  { word: 'Reflect', sub: 'Share your thoughts!', colour: 'var(--th-secondary)' },
];

/* ── 13 · Off to explore ───────────────────────────────────────────── */
function SlideExplore({ onDone }: { onDone: () => void }) {
  return (
    <>
      <h2 className="onb-q onb-r" style={{ '--d': '0.1s', color: 'var(--th-text)', fontSize: 'clamp(30px, 8vw, 46px)', maxWidth: '18ch' } as React.CSSProperties}>
        But before we learn to <span style={{ color: 'var(--th-primary)' }}>contextualise</span>, let&rsquo;s start by <span style={{ color: 'var(--th-primary)' }}>exploring</span>.
      </h2>
      <button
        onClick={() => { haptic(); onDone(); }}
        className="onb-r mt-10 px-12 py-4 rounded-full text-[18px] font-semibold"
        style={{ '--d': '1.1s', backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' } as React.CSSProperties}
      >
        Let&rsquo;s explore! &rarr;
      </button>
    </>
  );
}

/* ── Free response — record or type "How have you been taught history?" ─ */
const HISTORY_KEY = 'provenance.historyTaught';
function HistoryResponse({ onSubmit }: { onSubmit: () => void }) {
  const [text, setText] = useState('');
  const submit = () => {
    try { localStorage.setItem(HISTORY_KEY, text.trim()); } catch { /* ignore */ }
    onSubmit();
  };
  return (
    <>
      <RecordButton onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="…or type your answer"
        className="w-full mt-3 px-4 py-3 rounded-2xl border-2 font-serif text-[16px] focus:outline-none"
        style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface)', color: 'var(--th-text)' }}
      />
      <button
        onClick={submit}
        disabled={!text.trim()}
        className="mt-4 w-full py-3.5 rounded-full text-[17px] font-semibold disabled:opacity-40"
        style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
      >
        Continue
      </button>
    </>
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
