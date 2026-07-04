'use client';

/**
 * The Context Journal's "Ask your own question" — the Context Detective flow.
 * Pick a P.A.S.T. lens → type or dictate the question → the Detective
 * (/api/context-answer) researches and answers. The answer can be added to the
 * journal as a context (built from the returned handout). Replaces the old
 * placeholder that opened the manual add form.
 */

import { useState } from 'react';
import { LENSES, LENS_BY_KEY } from '../constants';
import type { ContextDraft, ContextSource, PastCategory } from '../types';
import ResponseInput from '@/components/tour/cards/ResponseInput';
import ContextAskLoading from '@/components/tour/cards/ContextAskLoading';

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
  const [resp, setResp] = useState<DetectiveResp | null>(null);
  const [adding, setAdding] = useState(false);

  const ask = async () => {
    const question = text.trim();
    if (!question) return;
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

  const buildDraft = (): ContextDraft => {
    const card = resp?.handout?.cards?.[0];
    const sources: ContextSource[] = (resp?.sources || [])
      .filter((s) => s.url || s.name)
      .map((s, i) => ({ id: `src_${i}`, name: s.name || s.url || 'Source', author: s.author || '', date: s.date || '', imageUrl: null, url: s.url || null }));
    return {
      question: text.trim(),
      title: card?.title || text.trim(),
      shortSummary: card?.summary || '',
      longExplanation: card?.explanation || resp?.narrative || '',
      pastCategory: card?.lens || lens,
      timeRange: { start: 1900, end: 1950 },
      geometry: null,
      camera: null,
      mapType: 'default',
      includePlaceTime: false,
      media: [],
      thumbnailMediaId: null,
      sources,
    };
  };

  const add = async () => {
    setAdding(true);
    await onAdd(buildDraft());
    onClose();
  };

  const answered = resp?.status === 'answered' && !!(resp?.narrative || resp?.handout?.cards?.length);

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5"
        style={{ backgroundColor: 'var(--th-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-[20px]" style={{ color: 'var(--th-primary)' }}>Ask your own question</h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full" style={{ color: 'var(--text-secondary)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {phase === 'lens' && (
          <div className="space-y-3">
            <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Which lens are you asking through?</p>
            <div className="grid grid-cols-2 gap-2.5">
              {LENSES.map((l) => (
                <button key={l.key} onClick={() => { setLens(l.key); setPhase('compose'); }} className="py-3.5 px-3 rounded-xl text-white text-[15px] font-semibold text-left" style={{ backgroundColor: l.colour }}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'compose' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[13px]">
              <span style={{ color: 'var(--text-secondary)' }}>Asking through</span>
              <span className="px-2.5 py-1 rounded-full text-white font-semibold" style={{ backgroundColor: LENS_BY_KEY[lens]?.colour }}>{LENS_BY_KEY[lens]?.label}</span>
              <button onClick={() => setPhase('lens')} className="underline" style={{ color: 'var(--text-secondary)' }}>change</button>
            </div>
            <ResponseInput value={text} onChange={setText} placeholder="Type or record your question…" />
            {text.trim() && (
              <button onClick={ask} className="w-full py-3 rounded-lg text-base font-semibold text-white" style={{ backgroundColor: 'var(--th-primary)' }}>Ask this question</button>
            )}
          </div>
        )}

        {phase === 'busy' && <ContextAskLoading />}

        {phase === 'result' && (answered ? (
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--th-primary)' }}>Answer</p>
            <p className="text-[16px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>{resp?.narrative}</p>
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
            <button onClick={add} disabled={adding} className="w-full py-3 rounded-lg text-base font-semibold text-white disabled:opacity-40" style={{ backgroundColor: 'var(--th-primary)' }}>
              {adding ? 'Adding…' : 'Add to my journal'}
            </button>
            <button onClick={onClose} className="w-full py-2 text-sm underline" style={{ color: 'var(--text-secondary)' }}>Done</button>
          </div>
        ) : (
          <div className="space-y-3 text-center py-4">
            <p className="text-[15px]" style={{ color: 'var(--text-primary)' }}>Saved — I&apos;ll help you find this. I couldn&apos;t pull a solid answer just now.</p>
            <button onClick={onClose} className="w-full py-3 rounded-lg text-base font-semibold text-white" style={{ backgroundColor: 'var(--th-primary)' }}>Done</button>
          </div>
        ))}
      </div>
    </div>
  );
}
