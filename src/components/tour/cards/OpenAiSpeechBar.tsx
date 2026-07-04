'use client';

/**
 * On-demand OpenAI narration bar, for text that can't be pre-cached — namely the
 * AI answers to context questions (each answer is unique). On play (or autoplay
 * when the learner has Autoplay on) it generates the audio via /api/tts, then
 * plays the real MP3 through the normal AudioButton (seekable, high quality).
 * The result is memoised per session so a replay doesn't regenerate/bill again.
 *
 * If generation fails (e.g. no OPENAI_API_KEY, offline), it falls back to the
 * free browser voice via SpeechBar so the answer is still narrated.
 */

import { useEffect, useState } from 'react';
import AudioButton from './AudioButton';
import SpeechBar from './SpeechBar';
import { fetchTtsObjectUrl } from '@/lib/tts-client';

interface Props {
  text: string;
  title?: string | null;
  autoplay?: boolean;
  /** A pre-generated, saved narration file for this exact text (authored context
   *  pages). When present it's played directly — no generation, no cost. */
  cachedUrl?: string | null;
}

export default function OpenAiSpeechBar({ text, title, autoplay = false, cachedUrl }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Whether the produced audio should start playing (autoplay, or a manual tap).
  const [playOnReady, setPlayOnReady] = useState(autoplay);

  const generate = async (shouldPlay: boolean) => {
    if (loading || url) return;
    setLoading(true);
    setPlayOnReady(shouldPlay);
    try {
      setUrl(await fetchTtsObjectUrl(text));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Skip generation when a saved clip exists — it's played directly below.
    if (autoplay && !cachedUrl) generate(true);
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A saved clip for this exact text (authored context) → play it, no generation.
  if (cachedUrl) return <AudioButton audioUrl={cachedUrl} title={title || 'Narration'} autoplay={autoplay} />;

  // Generation failed → free browser voice so the answer is still narrated.
  if (failed) return <SpeechBar text={text} title={title} autoplay={autoplay} />;

  // Ready → play the real MP3 through the standard audio bar.
  if (url) return <AudioButton audioUrl={url} title={title || 'Answer'} autoplay={playOnReady} />;

  // Not generated yet — a matching bar with a play button (or a spinner).
  return (
    <div className="rounded-lg bg-sandstone border border-sandstone-light p-4 flex items-center gap-2">
      <button
        onClick={() => generate(true)}
        disabled={loading}
        aria-label="Play narration"
        className="w-10 h-10 rounded-full bg-sandstone-light text-journal flex items-center justify-center shrink-0"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20" /></svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[18px] font-semibold text-text-primary truncate">{title || 'Answer'}</p>
        <p className="text-xs text-text-secondary">{loading ? 'Generating narration…' : 'Tap to listen'}</p>
      </div>
    </div>
  );
}
