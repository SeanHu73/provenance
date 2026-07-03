'use client';

/**
 * Quick Set Up — the short wizard at the end of the opening onboarding (after
 * "Enter Provenance"). Replaces the old in-tour IntroScreens: audio choice →
 * the Explore/Contextualise/Reflect arc → a sample pin on a mock map → the
 * per-stop Find/Learn steps → "Ready to Begin?" which drops the explorer onto
 * the real map. Self-contained (no tour needed — it runs before one is chosen).
 */

import { useEffect, useRef, useState } from 'react';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

const TOTAL = 5;

export default function QuickSetUp({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const next = () => setStep((s) => Math.min(s + 1, TOTAL - 1));

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ backgroundColor: 'var(--th-surface)' }}>
      {/* progress dots */}
      <div className="shrink-0 flex justify-center gap-2 pt-6">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full transition-colors" style={{ backgroundColor: i <= step ? 'var(--th-primary)' : 'var(--th-border)' }} />
        ))}
      </div>

      <p className="shrink-0 text-center mt-4 text-[13px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--th-primary)' }}>
        Quick Set Up
      </p>

      <div className="flex-1 min-h-0 relative">
        {step === 0 && <AudioStep onNext={next} />}
        {step === 1 && <FlowStep onNext={next} />}
        {step === 2 && <MapStep onNext={next} />}
        {step === 3 && <FindLearnStep onNext={next} />}
        {step === 4 && <ReadyStep onDone={onDone} />}
      </div>
    </div>
  );
}

function StepShell({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 overflow-y-auto flex flex-col justify-center px-7 py-8 animate-fade-in">{children}</div>;
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3.5 rounded-full text-[17px] font-semibold text-white transition-opacity disabled:opacity-40"
      style={{ backgroundColor: 'var(--th-primary)' }}
    >
      {children}
    </button>
  );
}

/* ── 0 · Audio ─────────────────────────────────────────────────── */
function AudioStep({ onNext }: { onNext: () => void }) {
  const [, setAutoplayPref] = useAudioAutoplay();
  const [choice, setChoice] = useState<'on' | 'off' | null>(null);
  const pick = (c: 'on' | 'off') => { setChoice(c); setAutoplayPref(c === 'on'); };

  return (
    <StepShell>
      <h2 className="font-display text-[30px] font-bold text-text-primary text-center">Audio</h2>
      <p className="mt-3 text-[19px] font-serif text-text-secondary text-center leading-relaxed">
        Some screens have narration. Should it play automatically?
      </p>
      <div className="mt-6 flex gap-3 justify-center">
        {(['on', 'off'] as const).map((opt) => {
          const selected = choice === opt;
          return (
            <button
              key={opt}
              onClick={() => pick(opt)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-[17px] font-semibold border-2 transition-colors"
              style={selected
                ? { background: 'var(--th-primary)', color: 'var(--th-surface)', borderColor: 'var(--th-primary)' }
                : { background: 'transparent', color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}
            >
              {opt === 'on' ? 'Auto-play' : 'Tap to play'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill={opt === 'on' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><polygon points="6,4 20,12 6,20" /></svg>
            </button>
          );
        })}
      </div>

      {choice !== null && (
        <div className="mt-6 flex items-start justify-center gap-3 px-2 animate-fade-in">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--th-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
            <path d="M3 14v-3a9 9 0 0 1 18 0v3" /><path d="M21 17a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2v2z" /><path d="M3 17a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2v2z" />
          </svg>
          <p className="text-[17px] leading-relaxed text-text-primary text-left">
            This experience is best with <strong>earphones</strong> — or read aloud to each other.
          </p>
        </div>
      )}

      <div className="mt-8"><PrimaryButton onClick={onNext} disabled={choice === null}>Next</PrimaryButton></div>
    </StepShell>
  );
}

/* ── 1 · Explore → Contextualise → Reflect ─────────────────────── */
const FLOW = [
  { word: 'Explore', colour: 'var(--th-primary)' },
  { word: 'Contextualise', colour: '#E08A5F' },
  { word: 'Reflect', colour: 'var(--th-secondary)' },
];
function FlowStep({ onNext }: { onNext: () => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = FLOW.map((_, i) => setTimeout(() => setShown((n) => Math.max(n, i + 1)), 500 + i * 750));
    return () => timers.forEach(clearTimeout);
  }, []);
  const allShown = shown >= FLOW.length;

  return (
    <StepShell>
      <p className="text-[19px] font-serif italic text-text-secondary text-center">In this experience, you will</p>
      <div className="mt-6 flex flex-col items-center gap-3">
        {FLOW.map((f, i) => (
          <div
            key={f.word}
            className="flex flex-col items-center"
            style={{
              opacity: i < shown ? 1 : 0,
              transform: i < shown ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 500ms ease-out, transform 500ms ease-out',
            }}
          >
            {i > 0 && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--th-border)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
                <path d="M12 5v14M6 13l6 6 6-6" />
              </svg>
            )}
            <span className="font-display font-bold leading-none" style={{ fontSize: 'clamp(34px, 10vw, 54px)', color: f.colour }}>{f.word}</span>
          </div>
        ))}
      </div>
      <div className="mt-10"><PrimaryButton onClick={onNext} disabled={!allShown}>Next</PrimaryButton></div>
    </StepShell>
  );
}

/* ── 2 · Sample pin on a mock map ──────────────────────────────── */
type MapPhase = 'intro' | 'spotlight' | 'card';
function MapStep({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState<MapPhase>('intro');
  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => setPhase('spotlight'), 1100); // shorter delay before it's tappable
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="absolute inset-0 overflow-hidden animate-fade-in">
      {/* mock map backdrop */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, #4a5d43 0%, #37432f 55%, #2a3325 100%)' }} />
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(var(--th-surface) 1px, transparent 1px), linear-gradient(90deg, var(--th-surface) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      {/* dim once we spotlight the pin (pointer-events-none so the pin stays tappable) */}
      {phase === 'spotlight' && <div className="absolute inset-0 bg-black/45 pointer-events-none animate-fade-in" />}

      {/* top + bottom instructions */}
      <div className="absolute top-14 left-0 right-0 px-5 flex justify-center pointer-events-none">
        <div className="px-5 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <p className="text-[21px] font-serif text-warm-white leading-snug text-center">You will find <strong>pins</strong> on a map.</p>
        </div>
      </div>
      {phase !== 'card' && (
        <div className="absolute bottom-10 left-0 right-0 px-5 flex justify-center pointer-events-none">
          <p className="text-[16px] font-serif italic text-warm-white/90 text-center">You will walk to the pin.</p>
        </div>
      )}

      {/* the sample pin */}
      <button
        onClick={() => { if (phase === 'spotlight') setPhase('card'); }}
        disabled={phase !== 'spotlight'}
        aria-label="Sample pin"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
      >
        <span className="relative flex items-center justify-center">
          {phase === 'spotlight' && <span className="absolute w-16 h-16 rounded-full animate-ping" style={{ backgroundColor: 'var(--th-primary)', opacity: 0.4 }} />}
          <span className="relative w-12 h-12 rounded-full flex items-center justify-center border-2 border-white shadow-lg" style={{ backgroundColor: 'var(--th-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" /><circle cx="12" cy="9" r="2" fill="#fff" stroke="none" /></svg>
          </span>
        </span>
      </button>
      {phase === 'spotlight' && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 mt-10 z-20 text-[15px] font-semibold text-warm-white text-center w-48" style={{ transform: 'translate(-50%, 40px)' }}>
          Tap the pin
        </p>
      )}

      {/* Sample Stop card */}
      {phase === 'card' && (
        <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-3 animate-slide-up">
          <div className="rounded-2xl shadow-lg p-5 space-y-4 text-left" style={{ backgroundColor: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
            <p className="text-[14px] uppercase tracking-[0.18em] font-display font-semibold" style={{ color: 'var(--th-primary)' }}>Sample Stop</p>
            <p className="text-[15px] font-serif text-text-secondary leading-relaxed">This is where a real stop&rsquo;s details would appear once you walk to it.</p>
            <PrimaryButton onClick={onNext}>I&rsquo;m here — explore this stop</PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 3 · Find / Learn ──────────────────────────────────────────── */
function FindLearnStep({ onNext }: { onNext: () => void }) {
  return (
    <StepShell>
      <p className="text-[19px] font-serif italic text-text-secondary text-center">On each stop, you will</p>
      <div className="mt-6 space-y-6">
        <ActionRow
          label="FIND"
          desc="Look for something in the area."
          glyph={<><circle cx="6" cy="15" r="4" /><circle cx="18" cy="15" r="4" /><path d="M10 15a2 2 0 0 1 4 0" /><path d="M6 11V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v5" /><path d="M18 11V6a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v5" /></>}
        />
        <ActionRow
          label="LEARN"
          desc="Read or listen to learn about the site."
          glyph={<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2z" /></>}
        />
      </div>
      <div className="mt-10"><PrimaryButton onClick={onNext}>Next</PrimaryButton></div>
    </StepShell>
  );
}

function ActionRow({ label, desc, glyph }: { label: string; desc: string; glyph: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4" style={{ color: 'var(--th-accent-dark)' }}>
      <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{glyph}</svg>
      <div className="min-w-0">
        <h3 className="uppercase tracking-[0.12em] font-display font-bold leading-none" style={{ fontSize: 34 }}>{label}</h3>
        <p className="mt-1 text-[16px] font-serif italic text-text-secondary">{desc}</p>
      </div>
    </div>
  );
}

/* ── 4 · Ready ─────────────────────────────────────────────────── */
function ReadyStep({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <StepShell>
      <div ref={ref} className="text-center">
        <h2 className="font-display font-bold text-text-primary leading-tight" style={{ fontSize: 'clamp(34px, 10vw, 54px)' }}>Ready to Begin?</h2>
        <div className="mt-10">
          <PrimaryButton onClick={onDone}>Begin →</PrimaryButton>
        </div>
      </div>
    </StepShell>
  );
}
