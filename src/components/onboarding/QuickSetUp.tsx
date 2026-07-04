'use client';

/**
 * Quick Set Up — the short wizard at the end of the opening onboarding (after
 * "Enter Provenance"). Replaces the old in-tour IntroScreens: audio choice →
 * the Explore/Contextualise/Reflect arc → a sample pin on a mock map → the
 * per-stop Find/Learn steps → "Ready to Begin?" which drops the explorer onto
 * the real map. Self-contained (no tour needed — it runs before one is chosen).
 */

import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map as GoogleMap } from '@vis.gl/react-google-maps';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useReadMode } from '@/lib/read-mode';

const TOTAL = 5;
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = 'b8f339c02d8c7d5bd3f12d1b';
const FIRST_STOP = { lat: 37.42700, lng: -122.17015 }; // Stanford Memorial Church (first stop)

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
        Set Up + Instructions
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
  const [autoplayPref, setAutoplayPref] = useAudioAutoplay();
  const [, setReadMode] = useReadMode();
  // Level 1: prefer listening or reading. Level 2 (listen only): autoplay.
  const [mode, setMode] = useState<'listen' | 'read' | null>(null);
  const [autoChoice, setAutoChoice] = useState<'on' | 'off' | null>(null);

  const pickListen = () => { setMode('listen'); setReadMode(false); };
  const pickRead = () => { setMode('read'); setReadMode(true); setAutoplayPref(false); setAutoChoice(null); };
  const pickAuto = (c: 'on' | 'off') => { setAutoChoice(c); setAutoplayPref(c === 'on'); };

  const canContinue = mode === 'read' || (mode === 'listen' && autoChoice !== null);
  const selStyle = { background: 'var(--th-primary)', color: 'var(--th-surface)', borderColor: 'var(--th-primary)' };
  const unselStyle = { background: 'transparent', color: 'var(--th-primary)', borderColor: 'var(--th-primary)' };

  return (
    <div className="absolute inset-0 flex flex-col animate-fade-in">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center px-7 py-8">
        <h2 className="font-display text-[30px] font-bold text-text-primary text-center">Audio</h2>
        <p className="mt-3 text-[18px] font-serif text-text-secondary text-center leading-relaxed">
          <strong>Earphones</strong> are recommended for the best experience.
        </p>

        {/* Level 1 — Listen or Read */}
        <p className="mt-6 text-[17px] font-semibold text-text-primary text-center">What is your preferred default?</p>
        <div className="mt-4 flex gap-3 justify-center">
          <button
            onClick={pickListen}
            className="flex items-center gap-2 px-6 py-3 rounded-lg text-[17px] font-semibold border-2 transition-colors"
            style={mode === 'listen' ? selStyle : unselStyle}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14v-3a9 9 0 0 1 18 0v3" /><path d="M21 17a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2v2z" /><path d="M3 17a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2v2z" /></svg>
            Listen
          </button>
          <button
            onClick={pickRead}
            className="flex items-center gap-2 px-6 py-3 rounded-lg text-[17px] font-semibold border-2 transition-colors"
            style={mode === 'read' ? selStyle : unselStyle}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
            Read
          </button>
        </div>

        {/* Level 2 — Listen only: autoplay choice */}
        {mode === 'listen' && (
          <div className="mt-7 animate-fade-in">
            <p className="text-[17px] font-semibold text-text-primary text-center">Should the audio play automatically?</p>
            <div className="mt-4 flex gap-3 justify-center">
              {(['on', 'off'] as const).map((opt) => {
                const selected = autoChoice === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => pickAuto(opt)}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg text-[17px] font-semibold border-2 transition-colors"
                    style={selected ? selStyle : unselStyle}
                  >
                    {opt === 'on' ? 'Auto-play' : 'Tap to play'}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={opt === 'on' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><polygon points="6,4 20,12 6,20" /></svg>
                  </button>
                );
              })}
            </div>
            {autoChoice !== null && (
              <p className="mt-5 text-[14px] text-text-secondary text-center px-3 animate-fade-in">
                Change option anytime with the <strong>Auto</strong> button below.
              </p>
            )}
          </div>
        )}

        <div className="mt-8"><PrimaryButton onClick={onNext} disabled={!canContinue}>{mode === 'read' ? 'Continue' : 'Next'}</PrimaryButton></div>
      </div>

      {/* Mock tour footer — points to where the Auto toggle lives (Listen only). */}
      {mode === 'listen' && autoChoice !== null && (
        <div className="shrink-0 px-4 py-3 border-t flex items-center gap-3 justify-between animate-fade-in" style={{ backgroundColor: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}>
          <span
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-warm-white bg-white/25 border border-white/50"
            style={{ boxShadow: '0 3px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)' }}
            aria-hidden="true"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </span>
          <div className="flex-1 min-w-0 text-center leading-tight text-warm-white uppercase tracking-[0.14em] opacity-85" style={{ fontSize: 11 }}>
            Set Up + Instructions
          </div>
          <div className="relative shrink-0">
            <span className="absolute left-1/2 bottom-full mb-1 -translate-x-1/2 pointer-events-none">
              <svg className="animate-bounce" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--th-secondary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}>
                <line x1="12" y1="3" x2="12" y2="17" /><polyline points="5 11 12 18 19 11" />
              </svg>
            </span>
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] uppercase tracking-wider font-semibold border ${autoplayPref ? 'bg-warm-white text-journal border-warm-white shadow' : 'text-warm-white/85 bg-black/15 border-white/20'}`}>
              Auto
              <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill={autoplayPref ? 'currentColor' : 'none'}><polygon points="6,4 20,12 6,20" /></svg>
            </div>
          </div>
        </div>
      )}
    </div>
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
      <p className="text-[24px] font-serif italic text-text-secondary text-center">In this experience, you will</p>
      <div className="mt-8 flex flex-col items-center gap-6">
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
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--th-border)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                <path d="M12 5v14M6 13l6 6 6-6" />
              </svg>
            )}
            <span className="font-display font-bold leading-none" style={{ fontSize: 'clamp(42px, 13vw, 66px)', color: f.colour }}>{f.word}</span>
          </div>
        ))}
      </div>
      {allShown && (
        <p className="mt-8 px-2 text-[23px] font-serif text-text-secondary text-center leading-relaxed animate-fade-in">
          &hellip;to learn to <strong>think like a historian</strong> in the world around you.
        </p>
      )}
      <div className="mt-10"><PrimaryButton onClick={onNext} disabled={!allShown}>Next</PrimaryButton></div>
    </StepShell>
  );
}

/* ── 2 · Sample pin on a mock map ──────────────────────────────── */
function MapStep({ onNext }: { onNext: () => void }) {
  const [reveal, setReveal] = useState(0); // number of instruction lines shown (0–3)
  const [tapped, setTapped] = useState(false);
  useEffect(() => {
    const timers = [
      setTimeout(() => setReveal(1), 400),
      setTimeout(() => setReveal(2), 1600),
      setTimeout(() => setReveal(3), 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  const pinActive = reveal >= 3 && !tapped;

  // Shared fade+rise for each diagonal instruction pill.
  const pillReveal = (n: number) => ({
    opacity: reveal >= n ? 1 : 0,
    transform: reveal >= n ? 'translateY(0)' : 'translateY(12px)',
    transition: 'opacity 450ms ease-out, transform 450ms ease-out',
  });

  return (
    <div className="absolute inset-0 overflow-hidden animate-fade-in">
      {/* Real (locked) Google Maps view of the first stop — non-interactive so
          it reads like a screenshot. The wrapper is shifted so the map centre
          (where the pin sits) lands a little below the middle, leaving room for
          the diagonal instructions above it. */}
      <div className="absolute left-0 right-0" style={{ top: '-8%', bottom: 0 }}>
        {MAPS_API_KEY ? (
          <APIProvider apiKey={MAPS_API_KEY}>
            <GoogleMap
              mapId={MAP_ID}
              defaultCenter={FIRST_STOP}
              defaultZoom={18}
              defaultTilt={0}
              mapTypeId="satellite"
              gestureHandling="none"
              disableDefaultUI
              clickableIcons={false}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            />
          </APIProvider>
        ) : (
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, #4a5d43 0%, #37432f 55%, #2a3325 100%)' }} />
        )}
      </div>

      {/* Spotlight vignette on the pin once it's tappable. */}
      {pinActive && (
        <div
          className="absolute inset-0 pointer-events-none animate-fade-in"
          style={{ background: 'radial-gradient(circle at 50% 46%, transparent 15%, rgba(0,0,0,0.55) 60%)' }}
        />
      )}

      {/* Diagonal instructions, cascading left→right and revealed one after another. */}
      {!tapped && (
        <>
          <div className="absolute pointer-events-none px-5 py-2.5 rounded-full shadow-lg" style={{ top: '8%', left: '4%', backgroundColor: 'rgba(0,0,0,0.62)', ...pillReveal(1) }}>
            <p className="text-[21px] font-serif font-semibold text-warm-white leading-snug">You will find <strong>pins</strong> on a map.</p>
          </div>
          <div className="absolute pointer-events-none px-5 py-2.5 rounded-full shadow-lg" style={{ top: '18%', right: '16%', backgroundColor: 'color-mix(in srgb, var(--th-primary) 50%, #000)', ...pillReveal(2) }}>
            <p className="text-[21px] font-serif font-semibold text-warm-white leading-snug">Walk to the pin.</p>
          </div>
          <div className="absolute pointer-events-none px-5 py-2.5 rounded-full shadow-lg" style={{ top: '28%', right: '4%', backgroundColor: 'var(--th-primary)', ...pillReveal(3) }}>
            <p className="text-[21px] font-serif font-semibold text-warm-white leading-snug">Tap the pin.</p>
          </div>
        </>
      )}

      {/* the sample pin — anchored to the map centre, a bit below the middle */}
      <button
        onClick={() => { if (pinActive) setTapped(true); }}
        disabled={!pinActive}
        aria-label="Sample pin"
        className="absolute left-1/2 z-20"
        style={{ top: '46%', transform: 'translate(-50%, -50%)' }}
      >
        <span className="relative flex items-center justify-center">
          {pinActive && <span className="absolute w-16 h-16 rounded-full animate-ping" style={{ backgroundColor: 'var(--th-primary)', opacity: 0.4 }} />}
          <span className="relative w-12 h-12 rounded-full flex items-center justify-center border-2 border-white shadow-lg" style={{ backgroundColor: 'var(--th-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" /><circle cx="12" cy="9" r="2" fill="#fff" stroke="none" /></svg>
          </span>
        </span>
      </button>

      {/* Sample Stop card */}
      {tapped && (
        <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-3 animate-slide-up">
          <div className="rounded-2xl shadow-lg overflow-hidden text-left" style={{ backgroundColor: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/photos/archival/memorial_court_post1906_arch.jpg" alt="" className="w-full h-40 object-cover" />
            <div className="p-5 space-y-4">
              <p className="text-[14px] uppercase tracking-[0.18em] font-display font-semibold" style={{ color: 'var(--th-primary)' }}>Sample Stop</p>
              <p className="text-[15px] font-serif text-text-secondary leading-relaxed">This is where a real stop&rsquo;s details would appear once you walk to it.</p>
              <PrimaryButton onClick={onNext}>I&rsquo;m here — explore this stop</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 3 · Find / Discover ───────────────────────────────────────── */
const STOP_ACTIONS = [
  {
    label: 'FIND',
    desc: 'Look for something in the area.',
    glyph: (<><path d="M4 9.5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2V15a2.5 2 0 0 1-5 0z" /><path d="M15 9.5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2V15a2.5 2 0 0 1-5 0z" /><path d="M9 11h6" /><path d="M5 7.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1" /><path d="M16 7.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1" /></>),
  },
  {
    label: 'DISCOVER',
    desc: 'Listen or read to discover the history of a site.',
    glyph: (<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2z" /></>),
  },
];

function FindLearnStep({ onNext }: { onNext: () => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = STOP_ACTIONS.map((_, i) => setTimeout(() => setShown((n) => Math.max(n, i + 1)), 500 + i * 900));
    return () => timers.forEach(clearTimeout);
  }, []);
  const allShown = shown >= STOP_ACTIONS.length;

  return (
    <StepShell>
      <p className="text-[24px] font-serif italic text-text-secondary text-center">On each stop, you will</p>
      <div className="mt-8 flex flex-col items-center gap-5">
        {STOP_ACTIONS.map((a, i) => (
          <div
            key={a.label}
            className="flex flex-col items-center w-full"
            style={{
              opacity: i < shown ? 1 : 0,
              transform: i < shown ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 500ms ease-out, transform 500ms ease-out',
            }}
          >
            {i > 0 && (
              <span className="font-serif font-bold text-text-secondary mb-4" style={{ fontSize: 30 }}>and</span>
            )}
            <div className="flex flex-col items-center text-center" style={{ color: 'var(--th-accent-dark)' }}>
              <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{a.glyph}</svg>
              <h3 className="uppercase tracking-[0.1em] font-display font-bold leading-none mt-2" style={{ fontSize: 'clamp(42px, 13vw, 66px)' }}>{a.label}</h3>
              <p className="mt-2 font-serif italic text-text-secondary" style={{ fontSize: 19 }}>{a.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10"><PrimaryButton onClick={onNext} disabled={!allShown}>Next</PrimaryButton></div>
    </StepShell>
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
