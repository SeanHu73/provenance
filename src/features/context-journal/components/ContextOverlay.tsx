'use client';

/**
 * Immersive reader for a single context (Slice 2). Replaces the old
 * ContextFullScreen: the context's **map + timeline are pinned at the top** of a
 * scroll-unlocked sheet, TTS **auto-reads Title → ~1s pause → Long explanation**
 * (autoplay attempted; a play/stop button always shows), the long explanation is
 * hidden behind an **"expand to read along"** control sitting between the map and
 * the photos, then photos, audio, and related questions follow.
 *
 * Serves both entry points:
 *   • authored *question* → pass `onAdd` (adds a learner copy, closes the overlay)
 *   • an already-added context's "tap 2" full page → pass `onDelete` (remove)
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LENS_BY_KEY, formatYear, contextPhotos, contextAudio, clampRange } from '../constants';
import type { ContextEntry, TimeRange } from '../types';
import BookmarkButton from './BookmarkButton';
import ContextMapLoader from './ContextMapLoader';
import ContextTimeline from './ContextTimeline';
import { useReadAloud } from './useReadAloud';
import { useReadMode } from '@/lib/read-mode';
import OpenAiSpeechBar from '@/components/tour/cards/OpenAiSpeechBar';
import { contextNarrationText } from '@/lib/tts-narration';
import { hashText, ttsSanitize } from '@/lib/tts-text';

interface Props {
  entry: ContextEntry;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
  /** Timeline domain (the journal's), and the admin default map view. */
  domain: { start: number; end: number };
  defaultView: { center: [number, number]; zoom: number } | null;
  /** Authored context not yet added → shows an "Add to Context Journal" footer. */
  onAdd?: () => void;
  /** Added context → shows a "remove from journal" control. */
  onDelete?: () => void;
  /** Added context → shows an "edit" control (opens the editor on the copy). */
  onEdit?: () => void;
}

export default function ContextOverlay({
  entry, saved, onToggleSave, onClose, domain, defaultView, onAdd, onDelete, onEdit,
}: Props) {
  const lens = LENS_BY_KEY[entry.pastCategory];
  const colour = lens.colour;
  const photos = contextPhotos(entry);
  const audio = contextAudio(entry);
  const sources = entry.sources ?? [];
  const related = entry.taggedQuestions ?? [];

  const [confirmDel, setConfirmDel] = useState(false);
  const [readModePref] = useReadMode();
  const [readAlong, setReadAlong] = useState(readModePref);

  // The overlay's map/timeline are contextual to this entry: the timeline opens
  // on the entry's own span, the map focuses its geometry. Both stay interactive
  // (unlocked) but their state is ephemeral to the overlay.
  const [range, setRange] = useState<TimeRange>(() => clampRange(entry.timeRange, domain));
  const [localDomain, setLocalDomain] = useState(domain);
  const changeDomain = (next: { start: number; end: number }) => {
    setLocalDomain(next);
    setRange((r) => clampRange(r, next));
  };

  // Browser (free) TTS is disabled on the context page — no autoplay, no "Read
  // aloud" button. useReadAloud is kept only for the read-along text segments.
  const { currentIdx, segments } = useReadAloud({
    lead: entry.title, body: entry.longExplanation, gapMs: 1000,
  });

  return (
    <motion.div
      className="fixed inset-0 z-[1200] flex flex-col"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        className="relative mt-auto w-full max-w-lg mx-auto bg-warm-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '94vh' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        {/* compact sticky header — controls always reachable */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--th-border)' }}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colour }} />
          <p className="flex-1 min-w-0 truncate text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: colour }}>
            {lens.label} · {formatYear(entry.timeRange.start)}–{formatYear(entry.timeRange.end)}
          </p>
          <BookmarkButton saved={saved} onToggle={onToggleSave} colour={colour} />
          {onEdit && (
            <button onClick={onEdit} aria-label="Edit this context"
              className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-black/5">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
          )}
          {onDelete && (confirmDel ? (
            <span className="flex items-center gap-1 shrink-0">
              <button onClick={onDelete} className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700">Remove</button>
              <button onClick={() => setConfirmDel(false)} className="px-2 py-1 text-xs text-text-secondary">Cancel</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDel(true)} aria-label="Remove from journal"
              className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-red-50 hover:text-red-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          ))}
          <button onClick={onClose} aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-black/5 text-2xl leading-none">
            &times;
          </button>
        </div>

        {/* scroll body — map/timeline pinned at the top, scrolls away as you read */}
        <div className="flex-1 overflow-y-auto">
          {/* 1 — the context's map + timeline (only when the editor opted in) */}
          {(entry.includePlaceTime ?? !!entry.geometry) && (
            <>
              <div style={{ height: '34vh', minHeight: 220 }}>
                <ContextMapLoader
                  mode="browse"
                  defaultView={defaultView}
                  mapType={entry.mapType}
                  focus={{ geometry: entry.geometry, camera: entry.camera, colour }}
                />
              </div>
              <div className="border-t border-b" style={{ borderColor: 'var(--th-border)' }}>
                <ContextTimeline value={range} onChange={setRange} domain={localDomain} onDomainChange={changeDomain} />
              </div>
            </>
          )}

          {/* 2 — title, question, quick answer */}
          <div className="px-5 pt-4">
            <h2 className="font-display text-[26px] leading-tight text-text-primary">{entry.title}</h2>
            {entry.question && (
              <p className="mt-1 font-serif italic text-[15px] text-text-secondary leading-snug">{entry.question}</p>
            )}
            {/* OpenAI narration (Title + Full Explanation). Reuses the cached
                authored-context audio when the hash matches; otherwise generates
                on demand. (The free browser voice stays disabled here.) */}
            {entry.longExplanation.trim() && (
              <div className="mt-3">
                <OpenAiSpeechBar
                  text={contextNarrationText(entry)}
                  title={entry.title}
                  cachedUrl={entry.ttsAudioHash && entry.ttsAudioHash === hashText(ttsSanitize(contextNarrationText(entry))) ? entry.ttsAudioUrl : null}
                />
              </div>
            )}
          </div>

          {/* 3 — expand to read along (the long explanation), between map and photos */}
          {entry.longExplanation.trim() && (
            <div className="px-5 pt-3">
              <button
                onClick={() => setReadAlong((v) => !v)}
                aria-expanded={readAlong}
                className="w-full flex items-center justify-between py-2 text-sm font-semibold text-text-secondary border-t"
                style={{ borderColor: 'var(--th-border)' }}
              >
                <span>{readAlong ? 'Hide the full explanation' : 'Expand to read along'}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${readAlong ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {readAlong && (
                <p className="pb-1 text-[17px] font-serif text-text-primary leading-relaxed whitespace-pre-wrap">
                  {segments.map((s, i) => (
                    s.isSpace
                      ? <span key={i}>{s.text}</span>
                      : <span key={i} style={i === currentIdx ? { backgroundColor: `${colour}33`, borderRadius: 3 } : undefined}>{s.text}</span>
                  ))}
                </p>
              )}
            </div>
          )}

          {/* 4 — photos */}
          {photos.length > 0 && (
            <div className={`px-5 pt-4 ${photos.length > 1 ? 'flex gap-3 overflow-x-auto cj-hscroll' : ''}`}>
              {photos.map((p) => (
                <figure key={p.id} className={photos.length > 1 ? 'shrink-0 w-[80%]' : ''} style={{ scrollSnapAlign: 'start' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.title} className="w-full max-h-[42vh] object-cover rounded-xl" />
                  {p.title && <figcaption className="mt-1 text-xs text-text-muted">{p.title}</figcaption>}
                </figure>
              ))}
            </div>
          )}

          {/* 5 — audio clips */}
          {audio.length > 0 && (
            <div className="px-5 pt-5 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-text-secondary">Audio</p>
              {audio.map((a) => (
                <div key={a.id}>
                  {a.title && <p className="text-sm font-semibold text-text-primary mb-1">{a.title}</p>}
                  <audio src={a.url} controls preload="none" className="w-full" />
                </div>
              ))}
            </div>
          )}

          {/* 6 — cited sources */}
          {sources.length > 0 && (
            <div className="px-5 pt-5 space-y-2">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-text-secondary">Sources</p>
              {sources.map((s) => (
                <div key={s.id} className="flex items-start gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--th-border)' }}>
                  {s.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-serif text-[15px] leading-snug underline break-words"
                        style={{ color: colour }}
                      >
                        {s.name}
                      </a>
                    ) : (
                      <p className="font-serif text-[15px] text-text-primary leading-snug">{s.name}</p>
                    )}
                    {(s.author || s.date) && (
                      <p className="mt-0.5 text-xs text-text-muted">{[s.author, s.date].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 7 — related questions */}
          {related.length > 0 && (
            <div className="px-5 pt-5 space-y-2">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-text-secondary">Related questions</p>
              {related.map((q) => (
                <div key={q.id} className="flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5" style={{ borderColor: 'var(--th-border)' }}>
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: LENS_BY_KEY[q.lens]?.colour ?? colour }} />
                  <span className="flex-1 min-w-0 font-serif text-[15px] text-text-primary leading-snug">{q.text}</span>
                </div>
              ))}
            </div>
          )}

          <div className="h-6" />
        </div>

        {/* Add to context (authored, not yet added) — adding closes the overlay */}
        {onAdd && (
          <div className="shrink-0 px-5 py-3 border-t" style={{ borderColor: 'var(--th-border)' }}>
            <button onClick={onAdd} className="w-full py-3 rounded-xl text-base font-semibold text-warm-white" style={{ backgroundColor: colour }}>
              + Add to Context Journal
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
