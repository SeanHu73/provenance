'use client';

/**
 * The Context Journal's "Ask your own question" — the Context Detective flow.
 *
 * Pick a P.A.S.T. lens → record/type the question → a fast **Framing Coach**
 * (/api/context-frame) reorients and, only when the question is too narrow,
 * offers tap-to-use reframes → on proceed the heavy answer (/api/context-answer)
 * runs in the *background* while the learner writes their **own theory** (predict
 * then reveal); a "Cancel search" backs out any time → when the answer is ready a
 * "Reveal" button appears → the result shows the answer with their theory kept
 * for comparison; "Add to my journal" saves it (their prediction rides along).
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LENSES, LENS_BY_KEY } from '../constants';
import type { ContextDraft, ContextSource, PastCategory } from '../types';
import RecordButton from '@/components/tour/cards/RecordButton';
import OpenAiSpeechBar from '@/components/tour/cards/OpenAiSpeechBar';
import ContextAskLoading from '@/components/tour/cards/ContextAskLoading';
import ImageSearchModal from '@/components/ImageSearchModal';
import { contextNarrationText } from '@/lib/tts-narration';
import { uploadSharePhoto } from '@/lib/community-store';

/** A firm two-buzz haptic to draw the learner back when the answer is ready. */
function readyHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([60, 50, 60, 50, 140]);
  }
}

interface RespSource { kind?: string; url?: string; name?: string; author?: string; date?: string; verified?: boolean }
interface RespCard { lens?: PastCategory; title?: string; summary?: string; explanation?: string }
interface DetectiveResp {
  status?: 'answered' | 'banked' | 'declined';
  narrative?: string;
  handout?: { cards?: RespCard[] } | null;
  sources?: RespSource[];
}
interface FrameResp {
  ok: boolean;
  reorientation: string;
  needsReframe: boolean;
  reframeTip: string;
  suggestedQuestions: string[];
}

type Phase = 'lens' | 'compose' | 'coaching' | 'reframe' | 'researching' | 'result';

interface Props {
  tourId: string;
  actId?: string;
  /** Titles of stops the learner has already completed — sent to the Detective as
   *  their prior knowledge (background only; it never argues from stop content). */
  priorStops?: string[];
  /** Modal title (defaults to "Ask your own question"). */
  heading?: string;
  /** Optional lead line shown above the lens picker — used by the "ask first" gate
   *  to frame this as the required first step. */
  intro?: string;
  onClose: () => void;
  onAdd: (draft: ContextDraft) => Promise<void> | void;
  /** Fired once when the learner reaches the revealed response (the "sees a
   *  response" moment). Carries the question + AI answer so the journal can record
   *  it for the admin, and is used by the ask-first gate to unlock the journal. */
  onAnswered?: (info: { question: string; answer: string | null; status: 'answered' | 'banked' }) => void;
}

export default function ContextAskFlow({ tourId, actId, priorStops, heading = 'Ask your own question', intro, onClose, onAdd, onAnswered }: Props) {
  const [phase, setPhase] = useState<Phase>('lens');
  const [lens, setLens] = useState<PastCategory>('society');
  const [text, setText] = useState('');
  const [asked, setAsked] = useState('');
  const [coach, setCoach] = useState<FrameResp | null>(null);
  const [theory, setTheory] = useState('');
  const [resp, setResp] = useState<DetectiveResp | null>(null);
  const [researchReady, setResearchReady] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // The learner's first-asked question, captured before any coach reframe.
  const originalQuestionRef = useRef('');

  const lensLabel = LENS_BY_KEY[lens]?.label ?? 'this';

  // Pulse + a firm haptic the moment the background answer lands, to draw the
  // learner back from writing their theory.
  useEffect(() => {
    if (phase === 'researching' && researchReady) readyHaptic();
  }, [phase, researchReady]);

  // Signal (once) the moment the learner reaches the revealed response — the
  // "posed their own question and saw a response" milestone the ask-first gate
  // waits on. `result` covers both the answered and the banked/declined outcome.
  const answeredRef = useRef(false);
  useEffect(() => {
    if (phase === 'result' && !answeredRef.current) {
      answeredRef.current = true;
      const c = resp?.handout?.cards?.[0];
      const ans = c?.explanation || resp?.narrative || '';
      onAnswered?.({ question: asked, answer: ans || null, status: resp?.status === 'answered' ? 'answered' : 'banked' });
    }
  }, [phase, onAnswered, asked, resp]);

  const addPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(Array.from(files).map((f) => uploadSharePhoto(f)));
      setPhotos((p) => [...p, ...urls]);
    } catch (err) {
      console.error('[ask] photo upload failed:', err);
    }
    setUploading(false);
  };

  // 1. Fast framing coach — reorients + (only when needed) offers reframes.
  const runCoach = async () => {
    const question = text.trim();
    if (!question) return;
    originalQuestionRef.current = question;
    setPhase('coaching');
    let out: FrameResp | null = null;
    try {
      const r = await fetch('/api/context-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, tourId, actId, lens }),
      });
      if (r.ok) out = await r.json();
    } catch { /* degrade to proceed */ }
    if (out && out.needsReframe) {
      setCoach(out);
      setPhase('reframe');
    } else {
      // Good question (or coach unavailable) — straight to research.
      proceedToResearch(question);
    }
  };

  // 2. Fire the heavy answer in the background; the learner writes a theory
  //    meanwhile. `q` may be the original or a coach-suggested reframe.
  const proceedToResearch = (q: string) => {
    const question = q.trim();
    if (!question) return;
    setAsked(question);
    setResp(null);
    setResearchReady(false);
    setPhase('researching');

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fetch('/api/context-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, originalQuestion: originalQuestionRef.current || question, tourId, actId, lens, priorStops }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { status: 'banked' }))
      .then((data: DetectiveResp) => { setResp(data); setResearchReady(true); })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setResp({ status: 'banked' });
        setResearchReady(true);
      });
  };

  // Bail out of an in-flight search — keeps the question + theory so they can
  // rework and re-ask.
  const cancelSearch = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setText(asked || text);
    setResearchReady(false);
    setResp(null);
    setPhase('compose');
  };

  const card = resp?.handout?.cards?.[0];
  const title = card?.title || asked;
  const answer = card?.explanation || resp?.narrative || '';
  const answered = resp?.status === 'answered' && !!answer;

  const buildDraft = (): ContextDraft => {
    const sources: ContextSource[] = (resp?.sources || [])
      .filter((s) => s.url || s.name)
      .map((s, i) => ({ id: `src_${i}`, name: s.name || s.url || 'Source', author: s.author || '', date: s.date || '', imageUrl: null, url: s.url || null }));
    return {
      question: asked,
      title,
      shortSummary: card?.summary || '',
      longExplanation: answer,
      pastCategory: card?.lens || lens,
      timeRange: { start: 1900, end: 1950 },
      geometry: null,
      camera: null,
      mapType: 'default',
      includePlaceTime: false,
      media: photos.map((url, i) => ({ id: `ph_${i}`, kind: 'photo' as const, url, title: '' })),
      thumbnailMediaId: photos.length ? 'ph_0' : null,
      sources,
      learnerPrediction: theory.trim() || undefined,
      // Record the pre-coach question only when they actually took a reframe.
      originalQuestion: (originalQuestionRef.current && originalQuestionRef.current !== asked)
        ? originalQuestionRef.current : undefined,
    };
  };

  const add = async () => {
    setAdding(true);
    await onAdd(buildDraft());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl h-[92vh] sm:h-auto sm:max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6"
        style={{ backgroundColor: 'var(--th-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-[22px]" style={{ color: 'var(--th-primary)' }}>{heading}</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: 'var(--text-secondary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {phase === 'lens' && (
          <div className="space-y-3">
            {intro && (
              <p className="text-[15px] font-serif italic leading-snug" style={{ color: 'var(--th-primary)' }}>{intro}</p>
            )}
            <p className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>Which lens are you asking through?</p>
            <div className="grid grid-cols-2 gap-3">
              {LENSES.map((l) => (
                <button key={l.key} onClick={() => { setLens(l.key); setPhase('compose'); }} className="py-4 px-3 rounded-xl text-white text-[16px] font-semibold text-left" style={{ backgroundColor: l.colour }}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'compose' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[13px]">
              <span style={{ color: 'var(--text-secondary)' }}>Asking through</span>
              <span className="px-2.5 py-1 rounded-full text-white font-semibold" style={{ backgroundColor: LENS_BY_KEY[lens]?.colour }}>{LENS_BY_KEY[lens]?.label}</span>
              <button onClick={() => setPhase('lens')} className="underline" style={{ color: 'var(--text-secondary)' }}>change</button>
            </div>
            <RecordButton onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="…or type your question"
              className="w-full px-4 py-3 rounded-xl border-2 bg-white text-[18px] font-serif text-text-primary focus:outline-none"
              style={{ borderColor: 'var(--th-border)' }}
            />
            {text.trim() && (
              <button onClick={runCoach} className="w-full py-3.5 rounded-xl text-base font-semibold text-white" style={{ backgroundColor: 'var(--th-primary)' }}>Ask this question</button>
            )}
          </div>
        )}

        {phase === 'coaching' && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--th-primary)', borderTopColor: 'transparent' }} />
            <p className="text-[15px] italic" style={{ color: 'var(--text-secondary)' }}>Reading your question…</p>
          </div>
        )}

        {phase === 'reframe' && coach && (
          <div className="space-y-4">
            {coach.reorientation && (
              <p className="text-[16px] font-serif leading-snug" style={{ color: 'var(--text-primary)' }}>{coach.reorientation}</p>
            )}
            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: 'var(--th-bg)' }}>
              <p className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--th-primary)' }}>Make it a context question</p>
              {coach.reframeTip && <p className="text-[15px] leading-snug" style={{ color: 'var(--text-primary)' }}>{coach.reframeTip}</p>}
              {coach.suggestedQuestions.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>A direction you could take it — write your own inspired by this, or tap to use one.</p>
                  {coach.suggestedQuestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => proceedToResearch(s)}
                      className="w-full flex items-center gap-2.5 text-left rounded-xl border-2 bg-white px-4 py-3 hover:bg-black/[0.02]"
                      style={{ borderColor: 'var(--th-border)' }}
                    >
                      <span className="flex-1 min-w-0 font-serif text-[15px] leading-snug" style={{ color: 'var(--text-primary)' }}>{s}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--th-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* keep-your-own controls */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border-2 bg-white text-[17px] font-serif text-text-primary focus:outline-none"
              style={{ borderColor: 'var(--th-border)' }}
            />
            <div className="flex gap-2">
              <button onClick={() => setPhase('compose')} className="flex-1 py-3 rounded-xl text-[15px] font-semibold border-2" style={{ color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}>Rewrite it</button>
              <button onClick={() => proceedToResearch(text)} disabled={!text.trim()} className="flex-1 py-3 rounded-xl text-[15px] font-semibold text-white disabled:opacity-40" style={{ backgroundColor: 'var(--th-primary)' }}>Ask this anyway</button>
            </div>
          </div>
        )}

        {phase === 'researching' && (
          <div className="space-y-4">
            <p className="font-serif italic text-[16px] leading-snug" style={{ color: 'var(--text-secondary)' }}>&ldquo;{asked}&rdquo;</p>

            {/* Predict-then-reveal: scaffold the learner's own theory while the
                Detective researches in the background. */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--th-bg)' }}>
              <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>While it researches — what&apos;s your own theory?</p>
              <p className="mt-1 text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                There&apos;s no wrong answer. Think through the <span className="font-semibold" style={{ color: LENS_BY_KEY[lens]?.colour }}>{lensLabel}</span> lens:
                what conditions, people, or changes might explain this? Say or jot a sentence or two — you&apos;ll compare it to what the Detective finds.
              </p>
            </div>
            <RecordButton onTranscript={(t) => setTheory((prev) => (prev ? `${prev} ${t}` : t))} />
            <textarea
              value={theory}
              onChange={(e) => setTheory(e.target.value)}
              rows={4}
              placeholder="…or type your theory"
              className="w-full px-4 py-3 rounded-xl border-2 bg-white text-[17px] font-serif text-text-primary focus:outline-none"
              style={{ borderColor: 'var(--th-border)' }}
            />

            {researchReady ? (
              // Ready: a bright, distinct colour (green = "go") with a pulsing ring
              // — clearly different from the researching state.
              <motion.button
                onClick={() => setPhase('result')}
                className="relative w-full py-3.5 rounded-xl text-base font-semibold text-white overflow-visible"
                style={{ backgroundColor: '#16a34a' }}
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut' }}
              >
                {/* pulsing ring cueing that the answer is ready */}
                <span className="pointer-events-none absolute inset-0 rounded-xl animate-ping" style={{ boxShadow: '0 0 0 3px #16a34a', opacity: 0.35 }} aria-hidden />
                <span className="relative inline-flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Your answer is ready — reveal it
                </span>
              </motion.button>
            ) : (
              <div className="space-y-3">
                {/* Once they've written their theory they needn't wait on this
                    screen — reassure them they can keep exploring meanwhile. Only
                    shown while researching (not during compose). */}
                <p className="text-[13px] font-semibold leading-snug text-center" style={{ color: '#16a34a' }}>
                  Done proposing your own theory? Feel free to keep looking around while you wait — we&apos;ll let you know the moment your answer&apos;s ready.
                </p>
                {/* the research animation, back while it's being looked up */}
                <ContextAskLoading />
                {/* the primary button starts as a plain outline "Researching…"
                    and only flips to the filled green button above once ready. */}
                <div className="w-full py-3.5 rounded-xl text-base font-semibold border-2 flex items-center justify-center gap-2" style={{ color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}>
                  <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--th-primary)', borderTopColor: 'transparent' }} />
                  Researching…
                </div>
                <button onClick={cancelSearch} className="w-full py-2.5 rounded-xl text-[14px] font-semibold border-2" style={{ color: 'var(--text-secondary)', borderColor: 'var(--th-border)' }}>
                  Cancel search / change question
                </button>
              </div>
            )}
          </div>
        )}

        {phase === 'result' && (answered ? (
          <div className="space-y-4">
            {/* their question first, italicised */}
            <p className="font-serif italic text-[16px] leading-snug" style={{ color: 'var(--text-secondary)' }}>&ldquo;{asked}&rdquo;</p>
            {/* generated title */}
            <h4 className="font-display font-bold text-[22px] leading-tight" style={{ color: 'var(--text-primary)' }}>{title}</h4>
            {/* on-demand audio */}
            <div>
              <p className="text-[12px] mb-1.5" style={{ color: 'var(--text-secondary)' }}>Tap to hear this read aloud — it may take a moment to generate.</p>
              {/* Narration reads the context's Title + Full Explanation. */}
              <OpenAiSpeechBar text={contextNarrationText({ title, longExplanation: answer })} title={title} autoplay={false} />
            </div>
            {/* the answer */}
            <p className="text-[16px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>{answer}</p>
            {(resp?.sources || []).length > 0 && (
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                <p className="font-semibold uppercase tracking-wide mb-1">Where this comes from</p>
                <ul className="space-y-0.5">
                  {(resp?.sources || []).map((s, i) => (
                    <li key={i}>
                      {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.name || s.url}</a> : (s.name || 'Source')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* their own theory, kept for comparison */}
            {theory.trim() && (
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--th-bg)' }}>
                <p className="text-[12px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--th-primary)' }}>Your theory</p>
                <p className="text-[15px] font-serif leading-snug whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>{theory}</p>
              </div>
            )}
            {/* optional photos — saved with the context when added; the first
                one becomes the journal thumbnail. */}
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>Add photos (optional)</p>
              <div className="flex flex-wrap gap-2 items-center">
                {photos.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[9px] text-center leading-tight py-0.5">Thumbnail</span>}
                    <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute top-0 right-0 w-5 h-5 bg-black/60 text-white text-xs flex items-center justify-center rounded-bl">×</button>
                  </div>
                ))}
                <label className="w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer text-xl" style={{ borderColor: 'var(--th-border)', color: 'var(--text-secondary)' }}>
                  {uploading ? '…' : '+'}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                </label>
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-[13px] font-semibold border-2"
                  style={{ color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                  Find online
                </button>
              </div>
            </div>

            <button onClick={add} disabled={adding} className="w-full py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-40" style={{ backgroundColor: 'var(--th-primary)' }}>
              {adding ? 'Adding…' : 'Add to my journal'}
            </button>
            <button onClick={onClose} className="w-full py-2 text-sm underline" style={{ color: 'var(--text-secondary)' }}>Done</button>
          </div>
        ) : (
          <div className="space-y-3 text-center py-6">
            <p className="font-serif italic text-[15px]" style={{ color: 'var(--text-secondary)' }}>&ldquo;{asked}&rdquo;</p>
            <p className="text-[15px]" style={{ color: 'var(--text-primary)' }}>Saved — I&apos;ll help you find this. I couldn&apos;t pull a solid answer just now.</p>
            {theory.trim() && (
              <div className="rounded-xl p-4 text-left" style={{ backgroundColor: 'var(--th-bg)' }}>
                <p className="text-[12px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--th-primary)' }}>Your theory</p>
                <p className="text-[15px] font-serif leading-snug whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>{theory}</p>
              </div>
            )}
            <button onClick={onClose} className="w-full py-3.5 rounded-xl text-base font-semibold text-white" style={{ backgroundColor: 'var(--th-primary)' }}>Done</button>
          </div>
        ))}
      </div>

      {searchOpen && (
        <ImageSearchModal
          onClose={() => setSearchOpen(false)}
          onPick={(url) => { setPhotos((p) => [...p, url]); setSearchOpen(false); }}
        />
      )}
    </div>
  );
}
