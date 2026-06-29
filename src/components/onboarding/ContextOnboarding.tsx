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
import { usePathname } from 'next/navigation';
import PastFramework from './PastFramework';

const LEAVE_MS = 500;

export default function ContextOnboarding({ children }: { children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const screenRef = useRef<HTMLDivElement | null>(null);
  // The teaching intro is for explorers, not the builder — skip it on admin.
  const onAdmin = usePathname()?.startsWith('/admin') ?? false;

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
      {!dismissed && !onAdmin && (
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

          {/* 1 — the question (sits low-left, oversized) */}
          <section className="onb-panel onb-bottom">
            <span className="onb-num">01</span>
            <hr className="onb-rule onb-r mb-7" />
            <h1 className="onb-title onb-r" style={{ '--d': '0.1s' } as React.CSSProperties}>How do we<br />understand<br />the&nbsp;past?</h1>
            <div className="onb-scrollhint">scroll ↓</div>
          </section>

          {/* 2 — how we usually learn it (right-aligned) */}
          <section className="onb-panel onb-rt">
            <span className="onb-num">02</span>
            <p className="onb-lead onb-measure onb-r">Most of us learn the past as <strong>lists of people, dates, and&nbsp;events.</strong></p>
            <p className="onb-lead onb-measure onb-r" style={{ '--d': '0.3s', marginTop: '22px' } as React.CSSProperties}>Often we just hear them as a <span className="onb-em">story…</span></p>
          </section>

          {/* 3 — reconstruct (anagram) */}
          <section className="onb-panel">
            <span className="onb-num">03</span>
            <p className="onb-lead onb-measure onb-r">But the past exists in a <span className="onb-em-red">world we no longer live&nbsp;in.</span></p>
            <p className="onb-lead onb-measure onb-r" style={{ '--d': '0.2s', marginTop: '16px' } as React.CSSProperties}>So to understand it, we first have to <Reconstruct text="reconstruct" /> that&nbsp;world.</p>
            <p className="onb-q onb-r" style={{ '--d': '1s', marginTop: '26px', fontSize: 'clamp(28px, 8vw, 44px)', color: 'var(--th-primary)' } as React.CSSProperties}>That&rsquo;s the challenge of history.</p>
          </section>

          {/* 4 — CONTEXT, introduced (centred, the chip is the moment) */}
          <section className="onb-panel onb-cx">
            <span className="onb-num">04</span>
            <p className="onb-lead onb-r">That world is what<br />historians&nbsp;call&hellip;</p>
            <p className="onb-r" style={{ marginTop: '30px', '--d': '0.35s' } as React.CSSProperties}>
              <span className="onb-ctx" style={{ fontSize: 'clamp(42px, 14vw, 70px)' }}>Context</span>
            </p>
          </section>

          {/* 5 — contextualisation (sits high) */}
          <section className="onb-panel onb-top">
            <span className="onb-num">05</span>
            <p className="onb-lead onb-measure onb-r">To reconstruct context, we place people and events within the conditions of their <strong>own <span className="onb-time">time</span> and <span className="onb-place">place</span>.</strong></p>
            <p className="onb-lead onb-measure onb-r" style={{ '--d': '0.3s', marginTop: '20px' } as React.CSSProperties}>We let that shape how we read the past. This is <span className="onb-em">contextualisation.</span></p>
          </section>

          {/* 6 — like empathy (centred) */}
          <section className="onb-panel onb-cx">
            <span className="onb-num">06</span>
            <p className="onb-q onb-r" style={{ fontSize: 'clamp(30px, 8.5vw, 46px)' }}>It seems easy.</p>
            <p className="onb-lead onb-measure onb-r" style={{ '--d': '0.3s', marginTop: '20px' } as React.CSSProperties}>It&rsquo;s a lot like <span className="onb-em">empathy and imagination</span> — but for the past. We enter someone else&rsquo;s world to understand them better.</p>
          </section>

          {/* 7 — intentional & practiced (right-aligned, the claim oversized) */}
          <section className="onb-panel onb-rt">
            <span className="onb-num">07</span>
            <p className="onb-lead onb-measure onb-r">And yet, we often don&rsquo;t ask for context. We take the explanations we&rsquo;re&nbsp;given.</p>
            <hr className="onb-rule onb-r" style={{ '--d': '0.25s', marginTop: '24px', marginBottom: '20px' } as React.CSSProperties} />
            <p className="onb-q onb-r" style={{ '--d': '0.4s', fontSize: 'clamp(30px, 8vw, 46px)' } as React.CSSProperties}>Context must be <span style={{ color: 'var(--th-primary)' }}>intentional<br />and practiced.</span></p>
          </section>

          {/* 8 — the P.A.S.T. framework (sits high; swipe to reveal) */}
          <section className="onb-panel onb-top">
            <span className="onb-num">08</span>
            <p className="onb-q onb-r" style={{ fontSize: 'clamp(30px, 8vw, 44px)', color: 'var(--th-primary)' }}>So how do we contextualise?</p>
            <p className="onb-lead onb-r" style={{ '--d': '0.18s', marginTop: '12px', fontSize: 'clamp(18px, 4.6vw, 21px)' } as React.CSSProperties}>Here&rsquo;s a nifty framework to help you reconstruct the world of the past!</p>
            <p className="onb-lead onb-r" style={{ '--d': '0.28s', marginTop: '8px', fontSize: 'clamp(18px, 4.6vw, 21px)' } as React.CSSProperties}>Use the <PastWord /> lenses to help frame context questions you could ask.</p>
            <div className="onb-r" style={{ '--d': '0.4s', marginTop: '18px' } as React.CSSProperties}>
              <PastFramework />
            </div>
          </section>

          {/* 9 — enter (centred) */}
          <section className="onb-panel onb-cx">
            <span className="onb-num">09</span>
            <div className="flex items-center justify-center gap-3 onb-r">
              <h2 className="onb-title" style={{ fontSize: 'clamp(38px, 11vw, 58px)' }}>Enter Provenance</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_transparent.png" alt="" width={64} height={64} className="onb-logo-pop w-14 h-auto select-none" draggable={false} />
            </div>
            <p className="onb-lead onb-measure onb-r" style={{ '--d': '0.3s', marginTop: '22px' } as React.CSSProperties}>
              Explore the past all around us — and practice <span className="onb-em">asking the questions</span> that reconstruct the world it belongs to.
            </p>
            <button
              onClick={dismiss}
              className="onb-r mt-9 px-9 py-4 rounded-full text-[16px] font-semibold"
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
