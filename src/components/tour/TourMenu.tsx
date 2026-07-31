'use client';

/**
 * Always-present tour menu — a top-right hamburger button that opens a small
 * dropdown. It owns the Auto-Play toggle (headphone icon) that used to live in
 * the footer. Mounted alongside TourFooter in both chrome renderers
 * (Journal.tsx for in-stop phases, page.tsx for map phases) so it's on screen
 * throughout the tour.
 *
 * Right after onboarding, `requestAutoplayHint()` makes it open on its own and
 * highlight the Auto-Play toggle with a one-line explanation.
 */

import { useEffect, useState } from 'react';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useAutoplayHint } from '@/lib/autoplay-hint';
import { useDevJump, useDevJumpOn } from '@/lib/dev-jump';
import { subscribeAppSettings, setResearchBackend } from '@/lib/app-settings-store';
import { useTourOptional } from '@/context/TourContext';
import { getActs } from '@/lib/tour-session';
import { getActiveStops } from '@/lib/tours-store';
import type { ResearchBackend, Stop, TourPhase } from '@/lib/types';

/** One jumpable destination. `stopIndex` is required for anything inside an act —
 *  the act is derived from the stop the session is parked on, so a phase alone is
 *  not enough to say *which* act's Context step you meant. */
type JumpTarget = { label: string; phase: TourPhase; stopIndex?: number };

/**
 * The jump list, built from the tour's real acts rather than hardcoded — acts are
 * authored content and a tour can have any number.
 *
 * Onboarding starts at `meet_guide`, not `intro`: `intro` is a pass-through that
 * auto-completes on mount (Journal.tsx:124), so jumping there just bounces you to
 * `meet_guide` anyway. `eq_discuss` and `eq_opening` are deliberately absent — the
 * phases still exist in the union and still render, but this tour's onboarding does
 * not use them, so offering them would jump you somewhere the tour never goes. Add
 * rows here if onboarding grows steps.
 *
 * Each act offers its three stages using the app's own grouping (PhaseHeader's
 * `phaseGroup`): Explore is everything before Context, so the act's entry splash
 * `act_intro` is its head; then `act_context_intro` and `act_reflection_intro`.
 * Intro phases (not the bodies) are the targets so each stage plays from its start.
 */
function useJumpTargets(): JumpTarget[] {
  const tour = useTourOptional()?.tour;
  if (!tour) return [];
  const stops = getActiveStops(tour);
  const indexOf = (stopId: string) => stops.findIndex((s: Stop) => s.id === stopId);

  // Context-Prototype tours set the scene via `opening_frame`; essential-question
  // tours use `eq_scene`. Jump to whichever this tour actually plays.
  const targets: JumpTarget[] = [
    { label: 'Onboarding — meet the guide', phase: 'meet_guide' },
    { label: 'Onboarding — the scene', phase: tour.openingFrame ? 'opening_frame' : 'eq_scene' },
  ];
  if (tour.openingFrame?.themeQuestion?.trim()) {
    targets.push({ label: 'Onboarding — theme question', phase: 'theme_question' });
  }

  const acts = getActs(tour);
  acts.forEach((act, i) => {
    const at = indexOf(act.stopIds[0]);
    if (at < 0) return; // act's stops no longer resolve — skip rather than jump blind
    const n = i + 1;
    targets.push(
      { label: `Act ${n} — Explore`, phase: 'act_intro', stopIndex: at },
      { label: `Act ${n} — Context`, phase: 'act_context_intro', stopIndex: at },
    );
  });

  // Reflection is the tour's closing stage now, not each act's — one entry, and
  // it plays from the last act's stops (where the merged picker lives).
  const lastAct = acts[acts.length - 1];
  const lastAt = lastAct ? indexOf(lastAct.stopIds[0]) : -1;
  if (lastAt >= 0) {
    targets.push({ label: 'Closing — Reflection', phase: 'act_reflection_intro', stopIndex: lastAt });
  }

  targets.push({ label: 'Closing — questions', phase: 'eq_questions' });
  return targets;
}

/** The Dev Jump toggle + (when on) the stage list. Admin-only escape hatch: it
 *  disables the tour's gates, so it is off by default and says so.
 *
 *  Rendered in two menus — TourMenu (the tour's own) and the Context Journal's,
 *  because `act_context` portals over the tour chrome at z-55 and takes the tour
 *  menu with it. Optional context throughout: the Journal also mounts standalone
 *  at `/context-journal` with no provider, where there is no session to jump. */
export function DevJumpMenuItem() {
  const [on, setOn] = useDevJump();
  const ctx = useTourOptional();
  const targets = useJumpTargets();
  const cur = ctx?.session?.currentPhase;
  const curStop = ctx?.session?.currentStopIndex;
  const devJumpTo = ctx?.devJumpTo;
  // Phase alone is ambiguous across acts — every act's Explore is `act_intro`, so
  // matching on phase lit up Act 1 and Act 2 at once. The stop index disambiguates.
  const isHere = (t: JumpTarget) => cur === t.phase && (t.stopIndex === undefined || t.stopIndex === curStop);

  // No tour running — nothing to jump between, so don't offer the control at all.
  if (!ctx?.session) return null;

  return (
    <div className="border-t" style={{ borderColor: 'var(--th-border)' }}>
      <button
        onClick={() => setOn(!on)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03]"
        aria-pressed={on}
      >
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: on ? '#7c3aed' : 'var(--th-border)', color: on ? '#fff' : 'var(--text-secondary)' }}
        >
          {/* compass icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="m15.5 8.5-2 5-5 2 2-5z" />
          </svg>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-text-primary">Dev Jump {on ? 'on' : 'off'}</span>
          <span className="block text-xs text-text-secondary leading-snug">
            {on ? 'Gates are off. Jump to any stage below.' : 'Admin only — skip between stages, ignore gates.'}
          </span>
        </span>
        <span className="shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors" style={{ backgroundColor: on ? '#7c3aed' : 'var(--th-border)' }}>
          <span className="block w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }} />
        </span>
      </button>

      {on && (
        <div className="max-h-64 overflow-y-auto border-t" style={{ borderColor: 'var(--th-border)' }}>
          {targets.length === 0 ? (
            <p className="px-4 py-3 text-xs text-text-secondary">No tour loaded.</p>
          ) : targets.map((t) => {
            const here = isHere(t);
            return (
              <button
                key={`${t.phase}:${t.stopIndex ?? '-'}`}
                onClick={() => devJumpTo?.(t.phase, t.stopIndex)}
                className={`w-full px-4 py-2 text-left text-[13px] flex items-center gap-2 transition-colors ${here ? 'font-semibold' : 'hover:bg-black/[0.03]'}`}
                style={here ? { backgroundColor: 'rgba(124,58,237,0.08)', color: '#7c3aed' } : { color: 'var(--text-secondary)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: here ? '#7c3aed' : 'var(--th-border)' }} />
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The Context Detective's research backend — a global switch, not a device one.
 *
 * Flipping it writes one Firestore document that the answer route reads on every
 * ask, so it changes the Detective for **every explorer on every device**, mid-tour
 * included, until it is flipped back. That is the point of it: the two pipelines
 * are being compared on real questions, and a per-device flag would only ever
 * compare them on this phone.
 *
 * Sits under Dev Jump and only appears when Dev Jump is on — it is an admin
 * control with app-wide blast radius, so it should not be one stray tap away for
 * a learner who opened the menu looking for the audio toggle.
 */
export function ResearchBackendMenuItem() {
  const devOn = useDevJumpOn();
  const [backend, setBackend] = useState<ResearchBackend | null>(null);
  const [changedAt, setChangedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Live, so a flip made on the laptop shows as flipped here without a reload.
  useEffect(() => subscribeAppSettings((s) => {
    setBackend(s.researchBackend);
    setChangedAt(s.updatedAt);
  }), []);

  if (!devOn) return null;

  const on = backend === 'perplexity';
  const toggle = async () => {
    if (busy || backend === null) return;
    setBusy(true);
    const next: ResearchBackend = on ? 'claude' : 'perplexity';
    setBackend(next); // optimistic; the subscription confirms or corrects it
    try {
      await setResearchBackend(next);
    } catch (err) {
      console.error('[app-settings] could not switch the research backend:', err);
      setBackend(on ? 'perplexity' : 'claude');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy || backend === null}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03] disabled:opacity-60 border-t"
      style={{ borderColor: 'var(--th-border)' }}
      aria-pressed={on}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: on ? '#0ea5e9' : 'var(--th-border)', color: on ? '#fff' : 'var(--text-secondary)' }}
      >
        {/* magnifier icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        {/* Named by number, not by vendor: the label is on screen during a live
            tour, and which engine is behind which mode is nobody's business but
            the admin's. 1 = Claude, 2 = Perplexity. */}
        <span className="block font-semibold text-text-primary">
          Research mode {backend === null ? '…' : on ? '2' : '1'}
        </span>
        <span className="block text-xs text-text-secondary leading-snug">
          {backend === null
            ? 'Reading the global setting…'
            : `Applies to everyone, everywhere${changedAt ? ` · set ${new Date(changedAt).toLocaleString()}` : ''}`}
        </span>
        <span className="block text-[11px] text-text-secondary opacity-70 leading-snug mt-0.5">
          Tap to switch to mode {on ? '1' : '2'}
        </span>
      </span>
      <span className="shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors" style={{ backgroundColor: on ? '#0ea5e9' : 'var(--th-border)' }}>
        <span className="block w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }} />
      </span>
    </button>
  );
}

/** The Auto-Play on/off row — a headphone icon, a label, and a switch. Shared by
 *  this menu and the Context Journal's menu so it looks/behaves identically. */
export function AutoPlayMenuItem({ highlight = false }: { highlight?: boolean }) {
  const [autoplay, setAutoplay] = useAudioAutoplay();
  return (
    <button
      onClick={() => setAutoplay(!autoplay)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${highlight ? 'bg-[color:var(--th-primary)]/[0.08] ring-2 ring-inset' : 'hover:bg-black/[0.03]'}`}
      style={highlight ? { boxShadow: 'inset 0 0 0 2px var(--th-primary)' } : undefined}
      aria-pressed={autoplay}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: autoplay ? 'var(--th-primary)' : 'var(--th-border)', color: autoplay ? '#fff' : 'var(--text-secondary)' }}
      >
        {/* headphone icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
          <rect x="17" y="12" width="4" height="7" rx="1.5" />
          <rect x="3" y="12" width="4" height="7" rx="1.5" />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-text-primary">Auto-Play {autoplay ? 'on' : 'off'}</span>
        <span className="block text-xs text-text-secondary leading-snug">
          {autoplay ? 'Audio plays automatically.' : 'Tap-to-Play — you control when it plays.'}
        </span>
      </span>
      <span className="shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors" style={{ backgroundColor: autoplay ? 'var(--th-primary)' : 'var(--th-border)' }}>
        <span className="block w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: autoplay ? 'translateX(16px)' : 'translateX(0)' }} />
      </span>
    </button>
  );
}

export default function TourMenu({ inline = false, onDark = false }: { inline?: boolean; onDark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hint, clearHint] = useAutoplayHint();

  // Open when the user taps the button OR when onboarding fires the hint. Closing
  // clears the (one-shot) hint so it can't force the menu back open. Derived — no
  // effect needed.
  const shown = open || hint;
  const close = () => { setOpen(false); if (hint) clearHint(); };

  return (
    <>
      <button
        onClick={() => (shown ? close() : setOpen(true))}
        aria-label="Menu" aria-expanded={shown}
        className={onDark
          ? 'shrink-0 rounded-full flex items-center justify-center border-0 text-white'
          : inline
            ? 'w-9 h-9 rounded-full flex items-center justify-center bg-warm-white hover:bg-black/[0.04] border-2'
            : 'fixed top-3 right-3 z-[46] w-10 h-10 rounded-full flex items-center justify-center text-warm-white bg-black/35 hover:bg-black/50 backdrop-blur border border-white/30 shadow-lg'}
        style={onDark
          // matches JourneyBar's BarButton so the two controls on the bar pair up
          ? { width: 'var(--ds-nav-button-size)', height: 'var(--ds-nav-button-size)', backgroundColor: 'var(--ds-nav-button-bg)' }
          : inline ? { color: 'var(--text-secondary)', borderColor: 'var(--th-border)' } : undefined}
      >
        {/* three horizontal lines */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {shown && (
        <>
          <div className="fixed inset-0 z-[45]" onClick={close} />
          <div
            className="fixed top-14 right-3 z-[47] w-72 rounded-2xl shadow-2xl bg-warm-white border overflow-hidden"
            style={{ borderColor: 'var(--th-border)' }}
          >
            <AutoPlayMenuItem highlight={hint} />
            {hint && (
              <div className="px-4 py-2.5 border-t text-[13px] leading-snug" style={{ borderColor: 'var(--th-border)', color: 'var(--th-primary)' }}>
                Audio plays automatically. Turn it off here to control when it plays.
              </div>
            )}
            <DevJumpMenuItem />
            <ResearchBackendMenuItem />
          </div>
        </>
      )}
    </>
  );
}
