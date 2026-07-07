'use client';

/**
 * Context-Prototype — the context step shown after a question is asked (an
 * authored one tapped, or the learner's own → an AI response).
 *
 * Two screens:
 *   1. READ — just the title, photo(s), full explanation, and (if it applies) the
 *      map + timeline, narrated. At the bottom: for an authored context the
 *      learner chooses "Edit Context" or "Add Context"; for an AI response they
 *      must go through "Edit Context". If they're listening, the narration
 *      finishing auto-advances them to the edit screen.
 *   2. EDIT — the full editor (short summary + every field). Approving it at the
 *      bottom ("Add Context") saves the context to their journal.
 */

import { useState, useEffect } from 'react';
import { useTour } from '@/context/TourContext';
import { currentContextItem, findActOfStop } from '@/lib/tour-session';
import { LENS_BY_KEY, DEFAULT_DOMAIN, clampRange } from '@/features/context-journal/constants';
import { addContextEntry } from '@/features/context-journal/store';
import AddContextFlow from '@/features/context-journal/components/AddContextFlow';
import ContextMapLoader from '@/features/context-journal/components/ContextMapLoader';
import ContextTimeline from '@/features/context-journal/components/ContextTimeline';
import type { ContextDraft, TimeRange } from '@/features/context-journal/types';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { hashText, ttsSanitize } from '@/lib/tts-text';
import { contextNarrationText } from '@/lib/tts-narration';
import AudioButton from './AudioButton';
import OpenAiSpeechBar from './OpenAiSpeechBar';
import BackButton from './BackButton';
import FormattedText from './FormattedText';

interface Props {
  onComplete: () => void;
  /** When true, this context is an AI response to the learner's question, so
   *  they must review it in the editor before adding (no direct "Add"). */
  aiResponse?: boolean;
}

export default function ActContextCard({ onComplete, aiResponse = false }: Props) {
  const { tour, session, currentStop, recordContextViewed } = useTour();
  const [autoplayPref] = useAudioAutoplay();
  const ctx = currentContextItem(tour, session);

  const [screen, setScreen] = useState<'read' | 'edit'>('read');
  const [adding, setAdding] = useState(false);
  const [autoAdvanced, setAutoAdvanced] = useState(false);
  // Ephemeral timeline state for the read view (the map/timeline are just a
  // preview here). Seeded from the context's own span.
  const [domain, setDomain] = useState(DEFAULT_DOMAIN);
  const [range, setRange] = useState<TimeRange>(() =>
    ctx ? clampRange(ctx.timeRange, DEFAULT_DOMAIN) : { start: DEFAULT_DOMAIN.start, end: DEFAULT_DOMAIN.end },
  );

  // Record that the explorer opened this authored context (deduped in-session).
  useEffect(() => {
    if (!ctx || !tour) return;
    const act = currentStop ? findActOfStop(tour, currentStop.id) : null;
    recordContextViewed({
      contextId: ctx.id, title: ctx.title, lens: ctx.pastCategory,
      question: ctx.question || undefined, actId: act?.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.id, tour?.id]);

  if (!ctx || !tour) {
    return (
      <div className="animate-fade-in min-h-full flex flex-col justify-center space-y-5 px-5">
        <button onClick={onComplete} className="w-full py-3 rounded-lg text-base font-semibold bg-accent-dark text-white">Continue</button>
      </div>
    );
  }

  const lens = LENS_BY_KEY[ctx.pastCategory];
  const photos = ctx.media.filter((m) => m.kind === 'photo');

  // The editable draft this context maps to (used for both "Add as-is" and the
  // pre-filled editor).
  const baseDraft: ContextDraft = {
    question: ctx.question ?? '', title: ctx.title, shortSummary: ctx.shortSummary,
    longExplanation: ctx.longExplanation, pastCategory: ctx.pastCategory,
    timeRange: ctx.timeRange, geometry: ctx.geometry, camera: ctx.camera,
    mapType: ctx.mapType, media: ctx.media, thumbnailMediaId: ctx.thumbnailMediaId,
    sources: ctx.sources,
    voiceoverUrl: ctx.voiceoverUrl, voiceoverTitle: ctx.voiceoverTitle,
  };

  const addAsIs = async () => {
    if (adding) return;
    setAdding(true);
    try {
      await addContextEntry({ ...baseDraft, placeId: tour.id });
    } catch (err) {
      console.error('[tour] add context failed:', err);
    }
    setAdding(false);
    onComplete();
  };

  const saveEdited = async (draft: ContextDraft) => {
    await addContextEntry({ ...draft, placeId: tour.id });
    onComplete();
  };

  // Listening → when the narration finishes, move straight to the edit screen.
  const narrationEnded = () => {
    if (autoplayPref && !autoAdvanced && screen === 'read') { setAutoAdvanced(true); setScreen('edit'); }
  };

  // ── Edit screen — the full editor; "Add Context" saves to the journal ──
  if (screen === 'edit') {
    return (
      <AddContextFlow
        heading={aiResponse ? 'Review & add context' : 'Edit context'}
        submitLabel="Add Context"
        initial={baseDraft}
        onClose={() => setScreen('read')}
        onSubmit={saveEdited}
      />
    );
  }

  // ── Read screen — title, photo, full explanation, map/timeline, narrated ──
  const narration = () => {
    if (ctx.voiceoverUrl) {
      return <AudioButton audioUrl={ctx.voiceoverUrl} title={ctx.voiceoverTitle || ctx.title || 'Context'} autoplay={autoplayPref} onEnded={narrationEnded} />;
    }
    const text = contextNarrationText(ctx);
    const cached = ctx.ttsAudioUrl && ctx.ttsAudioHash === hashText(ttsSanitize(text)) ? ctx.ttsAudioUrl : null;
    return <OpenAiSpeechBar text={text} title={ctx.title || 'Context'} autoplay={autoplayPref} cachedUrl={cached} onEnded={narrationEnded} />;
  };

  return (
    <div className="animate-fade-in absolute inset-0 overflow-y-auto">
      <div className="min-h-full flex flex-col px-5 pt-10 pb-6 space-y-4">
        <div>
          <p className="uppercase tracking-[0.18em] font-display font-semibold mb-2" style={{ fontSize: 13, color: lens.colour }}>
            {lens.label}
          </p>
          {ctx.title && (
            <h1 className="font-display leading-tight" style={{ fontSize: 30, color: 'var(--th-primary)' }}>{ctx.title}</h1>
          )}
        </div>

        {/* Narration — voiceover → cached OpenAI → on-demand → browser voice. */}
        {(ctx.voiceoverUrl || ctx.longExplanation) && narration()}

        {/* photo gallery */}
        {photos.length > 0 && (
          <div className={photos.length > 1 ? 'flex gap-3 overflow-x-auto -mx-1 px-1' : ''}>
            {photos.map((p) => (
              <figure key={p.id} className={photos.length > 1 ? 'shrink-0 w-[80%]' : ''}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.title} className="w-full max-h-[40vh] object-cover rounded-xl" />
                {p.title && <figcaption className="mt-1 text-xs text-text-muted">{p.title}</figcaption>}
              </figure>
            ))}
          </div>
        )}

        {/* full explanation */}
        {ctx.longExplanation && (
          <div className="text-[17px] font-serif text-text-primary leading-relaxed">
            <FormattedText text={ctx.longExplanation} />
          </div>
        )}

        {/* map + timeline — only when the editor opted in (old items: if a location was set) */}
        {(ctx.includePlaceTime ?? !!ctx.geometry) && ctx.geometry && (
          <div className="space-y-3">
            <div className="h-64 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
              <ContextMapLoader
                mode="browse"
                mapType={ctx.mapType}
                lensColour={lens.colour}
                initialGeometry={ctx.geometry}
                initialCamera={ctx.camera}
              />
            </div>
            <ContextTimeline value={range} onChange={setRange} domain={domain} onDomainChange={setDomain} />
          </div>
        )}

        <div className="flex-1" />

        {/* Choice: an authored context can be added as-is or edited first; an AI
            response must be reviewed in the editor before it's added. */}
        {aiResponse ? (
          <button
            onClick={() => setScreen('edit')}
            className="w-full py-3.5 rounded-xl text-base font-semibold text-white"
            style={{ backgroundColor: lens.colour }}
          >
            Edit Context
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setScreen('edit')}
              className="flex-1 py-3.5 rounded-xl text-base font-semibold border-2"
              style={{ color: lens.colour, borderColor: lens.colour }}
            >
              Edit Context
            </button>
            <button
              onClick={addAsIs}
              disabled={adding}
              className="flex-1 py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-70"
              style={{ backgroundColor: lens.colour }}
            >
              {adding ? 'Adding…' : 'Add Context'}
            </button>
          </div>
        )}

        <BackButton />
      </div>
    </div>
  );
}
