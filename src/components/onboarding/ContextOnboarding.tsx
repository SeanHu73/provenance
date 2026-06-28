'use client';

/**
 * First-open contextualization onboarding.
 *
 * Shown on every page load (no persistence — in-memory `dismissed` state only;
 * a refresh re-shows it, in-session navigation does not). A snap-scroll,
 * Provenance-styled teaching flow: what context / contextualisation is, and the
 * P.A.S.T. framework. Skip control top-right; "Enter Provenance" dismisses into
 * the app. Replaces the old logo splash (its welcome slide does the logo
 * bounce, reusing the .splash-* keyframes). The map renders underneath so it's
 * ready by the time the explorer enters.
 *
 * Future (accounts): a signed-in user who skips can have it remembered and only
 * see a brief intro fade — not built yet.
 */

import { useEffect, useRef, useState } from 'react';
import PastFramework from './PastFramework';

const LEAVE_MS = 500;

export default function ContextOnboarding({ children }: { children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const screenRef = useRef<HTMLDivElement | null>(null);

  // Suppress the legacy splash this session so it never double-runs.
  useEffect(() => {
    try { sessionStorage.setItem('splash_seen', '1'); } catch { /* ignore */ }
  }, []);

  // Reveal-on-scroll: toggle .onb-in on each panel as it enters the scroller.
  useEffect(() => {
    const root = screenRef.current;
    if (!root || dismissed) return;
    const panels = Array.from(root.querySelectorAll('.onb-panel'));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.toggle('onb-in', e.isIntersecting)),
      { root, threshold: 0.4 },
    );
    panels.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [dismissed]);

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(() => setDismissed(true), LEAVE_MS);
  };

  return (
    <>
      {children}
      {!dismissed && (
        <div className={`onb-screen ${leaving ? 'onb-leaving' : ''}`} ref={screenRef} aria-label="Introduction">
          <button className="onb-skip" onClick={dismiss}>Skip</button>

          {/* 0 — Welcome (logo bounces in and sticks) */}
          <section className="onb-panel onb-in">
            <div className="flex flex-col items-center text-center">
              <div className="relative flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo_transparent.png" alt="" width={200} height={200} className="splash-pin block w-44 h-auto select-none" draggable={false} />
                <div className="splash-shadow absolute left-1/2 -bottom-3 h-3 w-36 rounded-[50%]" style={{ backgroundColor: 'rgba(0,0,0,0.1)', filter: 'blur(5px)' }} />
              </div>
              <p className="splash-wordmark onb-title mt-6">Welcome to Provenance!</p>
            </div>
            <div className="onb-scrollhint">scroll ↓</div>
          </section>

          {/* 1 — the question */}
          <section className="onb-panel">
            <span className="onb-num">01</span>
            <h1 className="onb-title onb-r">How do we<br />understand<br />the&nbsp;past?</h1>
            <div className="onb-scrollhint">scroll ↓</div>
          </section>

          {/* 2 — how we usually learn it */}
          <section className="onb-panel">
            <span className="onb-num">02</span>
            <p className="onb-lead onb-r">Most of us learn the past as <strong>lists of people, dates, and events.</strong></p>
            <p className="onb-lead onb-r" style={{ '--d': '0.25s' } as React.CSSProperties}>Often we hear them in the form of a <span className="onb-em">story…</span></p>
          </section>

          {/* 3 — reconstruct (anagram) */}
          <section className="onb-panel">
            <span className="onb-num">03</span>
            <p className="onb-lead onb-r">But the past exists in a <span className="onb-em-red">world we no longer live in.</span></p>
            <p className="onb-lead onb-r" style={{ '--d': '0.2s' } as React.CSSProperties}>So to understand it, we have to first <Reconstruct text="reconstruct" /> that world.</p>
            <p className="onb-lead onb-r" style={{ '--d': '0.9s', marginTop: '20px', fontWeight: 700 } as React.CSSProperties}>That&rsquo;s the challenge of history.</p>
          </section>

          {/* 4 — CONTEXT, introduced */}
          <section className="onb-panel">
            <span className="onb-num">04</span>
            <p className="onb-lead onb-r">That world is what historians call:</p>
            <p className="onb-r" style={{ marginTop: '22px', '--d': '0.25s' } as React.CSSProperties}>
              <span className="onb-ctx" style={{ fontSize: 'clamp(34px, 11vw, 56px)' }}>Context</span>
            </p>
          </section>

          {/* 5 — contextualisation */}
          <section className="onb-panel">
            <span className="onb-num">05</span>
            <p className="onb-lead onb-r">To reconstruct context, we put people and events from the past within the conditions of their <strong>own <span className="onb-time">time</span> and <span className="onb-place">place</span>.</strong></p>
            <p className="onb-lead onb-r" style={{ '--d': '0.25s' } as React.CSSProperties}>We then use this context to shape our interpretation of the past. This is called <span className="onb-em">contextualisation.</span></p>
          </section>

          {/* 6 — like empathy */}
          <section className="onb-panel">
            <span className="onb-num">06</span>
            <p className="onb-lead onb-r">It seems easy — <span className="onb-em">contextualisation</span> is a lot like empathy and imagination, but for the past.</p>
            <p className="onb-lead onb-r" style={{ '--d': '0.25s' } as React.CSSProperties}>We are entering someone else&rsquo;s world to understand them better.</p>
          </section>

          {/* 7 — intentional & practiced */}
          <section className="onb-panel">
            <span className="onb-num">07</span>
            <p className="onb-lead onb-r">And yet, when we learn history, we often don&rsquo;t ask for more — we don&rsquo;t ask for context. We take the explanations given to us.</p>
            <p className="onb-lead onb-r" style={{ '--d': '0.3s', marginTop: '18px', fontWeight: 700 } as React.CSSProperties}>Contextualisation needs to be <span className="onb-em-red">intentional and practiced.</span></p>
          </section>

          {/* 8 — the P.A.S.T. framework (drag to reveal) */}
          <section className="onb-panel">
            <span className="onb-num">08</span>
            <p className="onb-q onb-r" style={{ fontSize: 'clamp(26px, 7vw, 36px)' }}>So how do we do it?</p>
            <p className="onb-lead onb-r" style={{ '--d': '0.2s', marginTop: '10px' } as React.CSSProperties}>Provenance gives you a framework to rebuild the world of the past. Use the <strong>P.A.S.T.</strong> lenses to frame your questions.</p>
            <div className="onb-r" style={{ '--d': '0.35s', marginTop: '16px' } as React.CSSProperties}>
              <PastFramework />
            </div>
          </section>

          {/* 9 — enter */}
          <section className="onb-panel">
            <span className="onb-num">09</span>
            <div className="flex items-center justify-center gap-3">
              <h2 className="onb-title onb-r" style={{ fontSize: 'clamp(34px, 9vw, 50px)' }}>Enter Provenance</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_transparent.png" alt="" width={64} height={64} className="onb-logo-pop w-12 h-auto select-none" draggable={false} />
            </div>
            <p className="onb-lead onb-r" style={{ '--d': '0.3s', marginTop: '18px' } as React.CSSProperties}>
              Explore the past that exists all around us — but practice <span className="onb-em">asking the questions</span> to reconstruct the world it belongs to.
            </p>
            <button
              onClick={dismiss}
              className="onb-r mt-8 self-start px-8 py-3.5 rounded-full text-[15px] font-semibold"
              style={{ '--d': '0.5s', backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' } as React.CSSProperties}
            >
              Begin →
            </button>
          </section>
        </div>
      )}
    </>
  );
}

/* ── "reconstruct" anagram: letters start scrambled (a derangement) and
   assemble into place when the word scrolls into view. ─────────────────── */
function Reconstruct({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll('span[data-l]')) as HTMLElement[];
    if (spans.length < 2) return;
    const xs = spans.map((s) => s.offsetLeft);

    const shuffle = (a: number[]) => {
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };
    const derange = (n: number) => {
      let o: number[];
      do { o = shuffle([...Array(n).keys()]); } while (n > 1 && o.some((v, i) => v === i));
      return o;
    };
    const scramble = () => {
      const order = derange(spans.length);
      spans.forEach((s, i) => {
        s.style.transition = 'none';
        const tx = xs[order[i]] - xs[i];
        s.style.transform = `translate(${tx.toFixed(1)}px, ${(Math.random() * 5 - 2.5).toFixed(1)}px) rotate(${(Math.random() * 6 - 3).toFixed(1)}deg)`;
        s.style.opacity = '0.85';
      });
    };
    const assemble = () => {
      spans.forEach((s, i) => {
        s.style.transition = 'transform .6s cubic-bezier(.34,1.32,.5,1), opacity .45s ease';
        s.style.transitionDelay = `${(i * 0.06).toFixed(2)}s`;
        s.style.transform = 'none';
        s.style.opacity = '1';
      });
    };

    let done = false;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting && !done) {
          done = true;
          scramble();
          void el.offsetWidth; // reflow so the scrambled state paints first
          requestAnimationFrame(() => requestAnimationFrame(assemble));
        }
      }),
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span ref={ref} className="onb-anagram onb-em">
      {text.split('').map((c, i) => (
        <span key={i} data-l style={{ whiteSpace: 'pre' }}>{c}</span>
      ))}
    </span>
  );
}
