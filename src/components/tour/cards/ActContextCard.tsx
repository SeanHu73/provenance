'use client';

/**
 * Context-Prototype — the "Add Context" page shown to the learner after a stop
 * (its framing question was just posed by ContextIntroCard). Shows the Title +
 * Full Explanation (read aloud with word highlighting) + any photos/audio. At
 * the bottom, "Add to Context Journal" clones it into the learner's journal
 * (auto-filled, editable later); admin-authored context is NOT auto-added.
 */

import { useState, useEffect } from 'react';
import { useTour } from '@/context/TourContext';
import { currentContextItem, findActOfStop } from '@/lib/tour-session';
import { LENS_BY_KEY } from '@/features/context-journal/constants';
import { addContextEntry } from '@/features/context-journal/store';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { hashText, ttsSanitize } from '@/lib/tts-text';
import { contextNarrationText } from '@/lib/tts-narration';
import AudioButton from './AudioButton';
import OpenAiSpeechBar from './OpenAiSpeechBar';
import BackButton from './BackButton';
import FormattedText from './FormattedText';

interface Props {
  onComplete: () => void;
}

export default function ActContextCard({ onComplete }: Props) {
  const { tour, session, currentStop, recordContextViewed } = useTour();
  const [autoplayPref] = useAudioAutoplay();
  const ctx = currentContextItem(tour, session);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Record that the explorer opened this authored context (deduped in-session).
  // Keyed on the context id so it fires once per context, not on every persist.
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
  const audio = ctx.media.filter((m) => m.kind === 'audio');

  const addToJournal = async () => {
    if (adding || added) return;
    setAdding(true);
    try {
      await addContextEntry({
        question: ctx.question ?? '', title: ctx.title, shortSummary: ctx.shortSummary,
        longExplanation: ctx.longExplanation, pastCategory: ctx.pastCategory,
        timeRange: ctx.timeRange, geometry: ctx.geometry, camera: ctx.camera,
        mapType: ctx.mapType, media: ctx.media, thumbnailMediaId: ctx.thumbnailMediaId,
        placeId: tour.id,
      });
      setAdded(true);
    } catch (err) {
      console.error('[tour] add to context journal failed:', err);
    }
    setAdding(false);
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
          {ctx.question && (
            <p className="font-serif italic mt-1 leading-snug" style={{ fontSize: 16, color: 'var(--th-text-muted)' }}>
              <FormattedText text={ctx.question} />
            </p>
          )}
        </div>

        {/* Narration. Priority: an uploaded voiceover (authored contexts) →
            a saved OpenAI clip when pre-generated → generated on demand (also
            covers a brand-new context) → the free browser voice. Reads only the
            Title + Full Explanation, and only on its own when Autoplay is on. */}
        {(ctx.voiceoverUrl || ctx.longExplanation) && (() => {
          if (ctx.voiceoverUrl) {
            return <AudioButton audioUrl={ctx.voiceoverUrl} title={ctx.voiceoverTitle || ctx.title || 'Context'} autoplay={autoplayPref} />;
          }
          const narration = contextNarrationText(ctx);
          const cached = ctx.ttsAudioUrl && ctx.ttsAudioHash === hashText(ttsSanitize(narration)) ? ctx.ttsAudioUrl : null;
          return <OpenAiSpeechBar text={narration} title={ctx.title || 'Context'} autoplay={autoplayPref} cachedUrl={cached} />;
        })()}

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

        {ctx.shortSummary && (
          <p className="font-display text-lg leading-snug" style={{ color: 'var(--th-text)' }}>{ctx.shortSummary}</p>
        )}

        {/* full explanation */}
        {ctx.longExplanation && (
          <div className="text-[17px] font-serif text-text-primary leading-relaxed">
            <FormattedText text={ctx.longExplanation} />
          </div>
        )}

        {/* audio clips */}
        {audio.length > 0 && (
          <div className="space-y-3">
            {audio.map((a) => (
              <div key={a.id}>
                {a.title && <p className="text-sm font-semibold mb-1" style={{ color: 'var(--th-text)' }}>{a.title}</p>}
                <audio src={a.url} controls preload="none" className="w-full" />
              </div>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Add to Context Journal — only on the learner's tap, never auto */}
        <button
          onClick={addToJournal}
          disabled={adding || added}
          className="w-full py-3 rounded-xl text-base font-semibold disabled:opacity-70"
          style={{ backgroundColor: added ? `${lens.colour}22` : `${lens.colour}`, color: added ? lens.colour : '#fff' }}
        >
          {added ? '✓ Added to your Context Journal' : adding ? 'Adding…' : '+ Add to Context Journal'}
        </button>

        <div className="flex gap-2">
          <BackButton />
          <button onClick={onComplete} className="flex-1 py-3 rounded-lg text-base font-semibold bg-accent-dark text-white">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
