'use client';

/**
 * The Context Journal's "Ask your own question" — the Context Detective flow.
 * Pick a P.A.S.T. lens → record (big circle) or type the question → the
 * Detective (/api/context-answer) researches and answers. The result shows the
 * learner's question (italic), a generated title, an on-demand audio button, then
 * the answer; "Add to my journal" saves it as a context built from the handout.
 */

import { useState } from 'react';
import { LENSES, LENS_BY_KEY } from '../constants';
import type { ContextDraft, ContextSource, PastCategory } from '../types';
import RecordButton from '@/components/tour/cards/RecordButton';
import OpenAiSpeechBar from '@/components/tour/cards/OpenAiSpeechBar';
import ContextAskLoading from '@/components/tour/cards/ContextAskLoading';
import { contextNarrationText } from '@/lib/tts-narration';
import { uploadSharePhoto } from '@/lib/community-store';

interface RespSource { kind?: string; url?: string; name?: string; author?: string; date?: string; verified?: boolean }
interface RespCard { lens?: PastCategory; title?: string; summary?: string; explanation?: string }
interface DetectiveResp {
  status?: 'answered' | 'banked' | 'declined';
  narrative?: string;
  handout?: { cards?: RespCard[] } | null;
  sources?: RespSource[];
}

interface Props {
  tourId: string;
  actId?: string;
  onClose: () => void;
  onAdd: (draft: ContextDraft) => Promise<void> | void;
}

export default function ContextAskFlow({ tourId, actId, onClose, onAdd }: Props) {
  const [phase, setPhase] = useState<'lens' | 'compose' | 'busy' | 'result'>('lens');
  const [lens, setLens] = useState<PastCategory>('society');
  const [text, setText] = useState('');
  const [asked, setAsked] = useState('');
  const [resp, setResp] = useState<DetectiveResp | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);

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

  const ask = async () => {
    const question = text.trim();
    if (!question) return;
    setAsked(question);
    setPhase('busy');
    try {
      const r = await fetch('/api/context-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, tourId, actId, lens }),
      });
      setResp(r.ok ? await r.json() : { status: 'banked' });
    } catch {
      setResp({ status: 'banked' });
    }
    setPhase('result');
  };

  const card = resp?.handout?.cards?.[0];
  const title = card?.title || asked;
  const answer = card?.explanation || resp?.narrative || '';

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
    };
  };

  const add = async () => {
    setAdding(true);
    await onAdd(buildDraft());
    onClose();
  };

  const answered = resp?.status === 'answered' && !!answer;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl h-[92vh] sm:h-auto sm:max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6"
        style={{ backgroundColor: 'var(--th-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-[22px]" style={{ color: 'var(--th-primary)' }}>Ask your own question</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: 'var(--text-secondary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {phase === 'lens' && (
          <div className="space-y-3">
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
              <button onClick={ask} className="w-full py-3.5 rounded-xl text-base font-semibold text-white" style={{ backgroundColor: 'var(--th-primary)' }}>Ask this question</button>
            )}
          </div>
        )}

        {phase === 'busy' && <ContextAskLoading />}

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
                      {!s.verified && ' · unverified'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* optional photos — saved with the context when added */}
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>Add photos (optional)</p>
              <div className="flex flex-wrap gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute top-0 right-0 w-5 h-5 bg-black/60 text-white text-xs flex items-center justify-center rounded-bl">×</button>
                  </div>
                ))}
                <label className="w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer text-xl" style={{ borderColor: 'var(--th-border)', color: 'var(--text-secondary)' }}>
                  {uploading ? '…' : '+'}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                </label>
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
            <button onClick={onClose} className="w-full py-3.5 rounded-xl text-base font-semibold text-white" style={{ backgroundColor: 'var(--th-primary)' }}>Done</button>
          </div>
        ))}
      </div>
    </div>
  );
}
