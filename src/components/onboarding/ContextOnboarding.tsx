'use client';

/**
 * First-open contextualization onboarding — a 12-slide teaching flow.
 *
 * Step-based (not scroll): one slide at a time with a progress bar showing which
 * of the 12 slides they're on (the Welcome slide counts as #1). Skip top-right.
 * Teaches what context / contextualisation is and the P.A.S.T. framework, then
 * hands off to a tour ("Find a Tour"). The per-tour audio (Listen/Read) setup no
 * longer lives here — it now runs at the start of each tour (see TourAudioSetup).
 *
 * The map renders underneath so it's ready by the time the explorer enters.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import PastFramework from './PastFramework';

const LEAVE_MS = 500;
const TOTAL = 12;

/** Light haptic tick (matches the repo pattern). */
function haptic(ms = 10) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

export default function ContextOnboarding({ children }: { children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState(0); // 0..11  → slide 1..12
  // The teaching intro is for explorers, not the builder — skip it on admin.
  const onAdmin = usePathname()?.startsWith('/admin') ?? false;

  // Suppress the legacy splash this session so it never double-runs.
  useEffect(() => {
    try { sessionStorage.setItem('splash_seen', '1'); } catch { /* ignore */ }
  }, []);

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(() => setDismissed(true), LEAVE_MS);
  };
  const next = () => { haptic(); setStep((s) => Math.min(s + 1, TOTAL - 1)); };
  const back = () => { haptic(6); setStep((s) => Math.max(s - 1, 0)); };

  if (dismissed || onAdmin) return <>{children}</>;

  return (
    <>
      {children}
      <div
        className={`fixed inset-0 z-[1100] flex flex-col transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
        style={{
          backgroundColor: 'var(--th-bg)',
          // P.A.S.T. lens colour-coding vars (normally scoped to .onb-screen).
          ['--onb-place' as string]: '#347C4A',
          ['--onb-time' as string]: '#2C6488',
          ['--onb-society' as string]: '#9B6FC9',
        } as React.CSSProperties}
        aria-label="Introduction"
      >
        {/* Top bar: progress + skip */}
        <div className="shrink-0 px-5 pt-5 pb-2 flex items-center gap-3">
          <button onClick={back} disabled={step === 0} aria-label="Back"
            className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-0 transition-opacity"
            style={{ color: 'var(--th-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <ProgressBar step={step} total={TOTAL} />
          <button onClick={dismiss} className="text-[13px] font-semibold shrink-0" style={{ color: 'var(--th-primary)' }}>Skip</button>
        </div>

        {/* Slide */}
        <div key={step} className="flex-1 min-h-0 relative animate-fade-in">
          {step === 0 && <SlideWelcome onNext={next} />}
          {step === 1 && <SlideRank />}
          {step === 2 && <SlideThanks />}
          {step === 3 && <SlideFragments />}
          {step === 4 && <SlideReconstruct />}
          {step === 5 && <SlideDefinition />}
          {step === 6 && <SlideAsk />}
          {step === 7 && <SlideProvenance />}
          {step === 8 && <SlideLenses />}
          {step === 9 && <SlideFlow />}
          {step === 10 && <SlideWhy />}
          {step === 11 && <SlideReady onDone={dismiss} />}
        </div>

        {/* Bottom Next control (slides that don't render their own primary CTA) */}
        {step !== 0 && step !== 11 && (
          <div className="shrink-0 px-7 pb-8 pt-2">
            <PrimaryButton onClick={next}>Continue</PrimaryButton>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Shared bits ──────────────────────────────────────────────────── */

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 h-1.5 rounded-full transition-colors" style={{ backgroundColor: i <= step ? 'var(--th-primary)' : 'var(--th-border)' }} />
        ))}
      </div>
      <p className="mt-1 text-[11px] font-semibold tracking-wide" style={{ color: 'var(--th-primary)' }}>{step + 1} of {total}</p>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-3.5 rounded-full text-[17px] font-semibold transition-opacity disabled:opacity-40"
      style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
      {children}
    </button>
  );
}

/** Slide body: scrollable, vertically centred, generous padding. */
function Body({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`absolute inset-0 overflow-y-auto flex flex-col justify-center px-7 py-6 ${className}`}>{children}</div>;
}

/** "P.A.S.T." with each letter coloured to match its lens. */
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

/* ── 1 · Welcome ──────────────────────────────────────────────────── */
function SlideWelcome({ onNext }: { onNext: () => void }) {
  return (
    <Body className="items-center text-center">
      <div className="flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_transparent.png" alt="" width={200} height={200} className="splash-pin block w-44 h-auto select-none" draggable={false} />
          <div className="splash-shadow absolute left-1/2 -bottom-3 h-3 w-36 rounded-[50%]" style={{ backgroundColor: 'rgba(0,0,0,0.1)', filter: 'blur(5px)' }} />
        </div>
        <p className="splash-wordmark onb-title mt-6">Welcome to Provenance!</p>
        <p className="mt-4 font-serif text-[19px]" style={{ color: 'var(--text-secondary)' }}>Ready to think like a historian?</p>
        <button onClick={onNext} className="mt-9 px-9 py-4 rounded-full text-[16px] font-semibold" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
          Let&rsquo;s begin →
        </button>
      </div>
    </Body>
  );
}

/* ── 2 · Rank: the meaning of history ─────────────────────────────── */
const RANK_KEY = 'provenance.historyRanking';
function SlideRank() {
  const [order, setOrder] = useState<string[]>([
    'Reconstruction and explanation of the past',
    'What people remember about the past',
    'Names, dates, and events of what happened',
  ]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    setOrder((prev) => { const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; try { localStorage.setItem(RANK_KEY, JSON.stringify(n)); } catch {} return n; });
    haptic(14);
  };
  return (
    <Body>
      <p className="font-serif text-[18px]" style={{ color: 'var(--text-secondary)' }}>But first&hellip;</p>
      <h2 className="font-display text-[26px] leading-tight mt-1" style={{ color: 'var(--text-primary)' }}>Let&rsquo;s see how we understand the past.</h2>
      <p className="mt-4 font-serif text-[18px]" style={{ color: 'var(--text-primary)' }}>What do you think is the meaning of history? <span className="italic" style={{ color: 'var(--text-secondary)' }}>Rank them — no wrong answer.</span></p>
      <div className="mt-4 space-y-2.5">
        {order.map((label, i) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border-2 px-3 py-3" style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-bg)' }}>
            <span className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[15px] shrink-0" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>{i + 1}</span>
            <span className="flex-1 text-[15px] font-serif" style={{ color: 'var(--text-primary)' }}>{label}</span>
            <span className="flex flex-col shrink-0">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-0.5 disabled:opacity-25" style={{ color: 'var(--th-primary)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
              </button>
              <button onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Move down" className="p-0.5 disabled:opacity-25" style={{ color: 'var(--th-primary)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </span>
          </div>
        ))}
      </div>
    </Body>
  );
}

/* ── 3 · Thanks ───────────────────────────────────────────────────── */
function SlideThanks() {
  return (
    <Body>
      <h2 className="font-display text-[26px] leading-tight" style={{ color: 'var(--th-primary)' }}>Thanks for sharing what you think.</h2>
      <p className="mt-4 font-serif text-[19px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        We might have different thoughts of the meaning of history&hellip; but most people learned the past as <strong>lists of people, dates, and events</strong> &mdash; perhaps in the form of a <span className="onb-em">story.</span>
      </p>
    </Body>
  );
}

/* ── 4 · Fragments → bigger picture ───────────────────────────────── */
function SlideFragments() {
  return (
    <Body>
      <p className="font-serif text-[19px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        But people, dates, and events are like <Fragmented text="fragments" />. To understand the past, we need to piece those fragments back into the <span className="font-display" style={{ color: 'var(--th-primary)', fontSize: '1.35em' }}>bigger picture.</span>
      </p>
      <p className="mt-5 font-serif text-[18px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        That bigger picture connects the fragments to the scene around it &mdash; which could support or change its meaning.
      </p>
    </Body>
  );
}

/* ── 5 · Reconstruct → Context ────────────────────────────────────── */
function SlideReconstruct() {
  return (
    <Body>
      <p className="font-serif text-[19px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        That&rsquo;s how a historian thinks. To understand the past, they first <Fragmented text="reconstruct" assemble /> that picture &mdash; the world around the people and events.
      </p>
      <p className="mt-6 font-serif text-[18px]" style={{ color: 'var(--text-secondary)' }}>That world is what historians call&hellip;</p>
      <p className="mt-3"><span className="onb-ctx" style={{ fontSize: 'clamp(42px, 14vw, 68px)' }}>Context</span></p>
    </Body>
  );
}

/* ── 6 · Definition ───────────────────────────────────────────────── */
function SlideDefinition() {
  return (
    <Body>
      <p className="font-serif text-[19px]" style={{ color: 'var(--text-secondary)' }}>Therefore, contextualising is&hellip;</p>
      <p className="mt-4 font-display text-[26px] leading-snug" style={{ color: 'var(--text-primary)' }}>
        Reconstructing a <span style={{ color: 'var(--th-primary)' }}>time and place</span> in the past&hellip;
      </p>
      <p className="mt-3 font-display text-[26px] leading-snug" style={{ color: 'var(--text-primary)' }}>
        then using it to understand its <span style={{ color: 'var(--th-primary)' }}>people and events.</span>
      </p>
    </Body>
  );
}

/* ── 7 · So how? Ask the right questions (tap to reveal) ───────────── */
function SlideAsk() {
  const [revealed, setRevealed] = useState(false);
  return (
    <Body className="items-center text-center">
      <h2 className="font-display text-[30px]" style={{ color: 'var(--th-primary)' }}>So how do we do it?!</h2>
      <p className="mt-6 font-serif text-[22px]" style={{ color: 'var(--text-primary)' }}>By&hellip;</p>
      <button
        onClick={() => { if (!revealed) { setRevealed(true); haptic(18); } }}
        className="mt-2 font-display text-[28px] leading-tight transition-all duration-500"
        style={{ color: 'var(--th-primary)', filter: revealed ? 'none' : 'blur(9px)', cursor: revealed ? 'default' : 'pointer' }}
      >
        asking the right questions.
      </button>
      {!revealed && <p className="mt-6 text-[14px] italic" style={{ color: 'var(--text-secondary)' }}>Tap to reveal</p>}
    </Body>
  );
}

/* ── 8 · Provenance + P.A.S.T. ────────────────────────────────────── */
function SlideProvenance() {
  return (
    <Body>
      <h2 className="font-display text-[26px]" style={{ color: 'var(--text-primary)' }}>This is where Provenance comes in.</h2>
      <p className="mt-4 font-serif text-[19px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        We use the <PastWord /> framework to help you think about different lenses of context&hellip;
      </p>
      <p className="mt-4 font-serif text-[19px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        then <span className="onb-em">ask questions</span> to <Fragmented text="reconstruct" assemble /> the world around you.
      </p>
    </Body>
  );
}

/* ── 9 · The P.A.S.T. lenses ──────────────────────────────────────── */
function SlideLenses() {
  return (
    <Body>
      <p className="font-serif text-[18px] mb-4" style={{ color: 'var(--text-primary)' }}>
        Here are the lenses of the <PastWord /> to help frame your questions.
      </p>
      <PastFramework />
    </Body>
  );
}

/* ── 10 · Explore → Contextualise → Reflect ───────────────────────── */
const FLOW = [
  { word: 'Explore', sub: 'Find stops like you are on a tour', colour: 'var(--th-primary)' },
  { word: 'Contextualise', sub: 'Apply the P.A.S.T. and ask for more context', colour: '#E08A5F' },
  { word: 'Reflect', sub: 'Share your thoughts!', colour: 'var(--th-secondary)' },
];
function SlideFlow() {
  return (
    <Body>
      <p className="font-serif text-[19px] text-center" style={{ color: 'var(--text-secondary)' }}>In this experience you will&hellip;</p>
      <div className="mt-6 space-y-5">
        {FLOW.map((f) => (
          <div key={f.word}>
            <p className="font-display leading-none" style={{ color: f.colour, fontSize: 'clamp(30px, 9vw, 44px)' }}>{f.word}</p>
            <p className="mt-1 font-serif text-[16px]" style={{ color: 'var(--text-secondary)' }}>{f.sub}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 font-serif text-[19px] text-center" style={{ color: 'var(--text-primary)' }}>&hellip; to think like a historian.</p>
    </Body>
  );
}

/* ── 11 · Why it matters (fade in one at a time) ──────────────────── */
const WHY = [
  'Question and see past what is in front of us.',
  'Connect better to the past.',
  'Map out the past from one place to another using context!',
];
function SlideWhy() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = WHY.map((_, i) => window.setTimeout(() => setShown((s) => Math.max(s, i + 1)), 500 + i * 900));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <Body>
      <h2 className="font-display text-[24px] leading-snug" style={{ color: 'var(--text-primary)' }}>Contextualising is important because it helps us&hellip;</h2>
      <div className="mt-6 space-y-4">
        {WHY.map((line, i) => (
          <p key={i} className="font-serif text-[19px] leading-snug transition-all duration-700"
            style={{ color: 'var(--th-primary)', opacity: i < shown ? 1 : 0, transform: i < shown ? 'translateY(0)' : 'translateY(10px)' }}>
            {line}
          </p>
        ))}
      </div>
    </Body>
  );
}

/* ── 12 · Ready → Find a Tour ─────────────────────────────────────── */
function SlideReady({ onDone }: { onDone: () => void }) {
  const [yes, setYes] = useState(false);
  return (
    <Body className="items-center text-center">
      <h2 className="font-display text-[27px] leading-tight" style={{ color: 'var(--text-primary)' }}>You think you&rsquo;re ready to think like a historian?</h2>
      {!yes ? (
        <button onClick={() => { setYes(true); haptic(); }} className="mt-8 px-10 py-4 rounded-full text-[17px] font-semibold" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
          Yes!
        </button>
      ) : (
        <div className="mt-7 animate-fade-in flex flex-col items-center">
          <p className="font-serif text-[19px] leading-relaxed" style={{ color: 'var(--text-primary)', maxWidth: '24ch' }}>
            Let&rsquo;s go explore the world! Remember to use the <PastWord /> to ask questions along the way.
          </p>
          <button onClick={onDone} className="mt-8 px-10 py-4 rounded-full text-[17px] font-semibold" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
            Find a Tour →
          </button>
        </div>
      )}
    </Body>
  );
}

/* ── "fragments/reconstruct" effect: letters start scattered (a derangement)
   and assemble into place. `assemble` variants settle immediately on mount;
   both share the same scatter→settle motion so "fragments" and "reconstruct"
   read as pieces coming together. ─────────────────────────────────── */
function Fragmented({ text, assemble = false }: { text: string; assemble?: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll('span[data-l]')) as HTMLElement[];
    if (spans.length < 2) return;
    const xs = spans.map((s) => s.offsetLeft);
    const shuffle = (a: number[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const derange = (n: number) => { let o: number[]; do { o = shuffle([...Array(n).keys()]); } while (n > 1 && o.some((v, i) => v === i)); return o; };
    const order = derange(spans.length);
    spans.forEach((s, i) => {
      s.style.transition = 'none';
      const tx = xs[order[i]] - xs[i];
      s.style.transform = `translate(${tx.toFixed(1)}px, ${(Math.random() * 6 - 3).toFixed(1)}px) rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;
      s.style.opacity = '0.8';
    });
    void el.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      spans.forEach((s, i) => {
        s.style.transition = 'transform .6s cubic-bezier(.34,1.32,.5,1), opacity .45s ease';
        s.style.transitionDelay = `${(i * 0.05).toFixed(2)}s`;
        s.style.transform = 'none';
        s.style.opacity = '1';
      });
    }));
  }, [assemble]);
  return (
    <span ref={ref} className="onb-em" style={{ display: 'inline-block' }}>
      {text.split('').map((c, i) => (
        <span key={i} data-l style={{ display: 'inline-block', whiteSpace: 'pre', willChange: 'transform' }}>{c}</span>
      ))}
    </span>
  );
}
