import { hashText, ttsSanitize } from './tts-text';

/** The narration for a context page is only its Title + Full Explanation
 *  (never the short summary, question, or other fields). Shared by the admin
 *  generator and the runtime card so their cache keys match. */
export function contextNarrationText(item: { title?: string; longExplanation?: string }): string {
  const title = (item.title || '').trim();
  const body = (item.longExplanation || '').trim();
  return title ? `${title}. ${body}` : body;
}

/** The audio-bearing fields of a stop section (seed / reveal). */
export interface NarrationSection {
  audioUrl?: string | null;
  audioAutoplayDisabled?: boolean;
  audioIsVoiceover?: boolean;
  ttsAudioUrl?: string | null;
  ttsAudioHash?: string | null;
}

export interface Narration {
  hasAudio: boolean;
  isVoiceover: boolean;
  /** A fresh cached OpenAI narration file for the current text, or null. */
  cachedUrl: string | null;
  /** Show the cached OpenAI file as the narration. */
  showCached: boolean;
  /** Fall back to the free browser voice (no uploaded/cached narration). */
  showBrowser: boolean;
  /** Any narration exists (used to decide whether to collapse the text). */
  hasNarration: boolean;
  /** Autoplay flags — at most one is true, so two streams never autoplay. */
  uploadedAutoplay: boolean;
  cachedAutoplay: boolean;
  browserAutoplay: boolean;
}

/**
 * Decide how a screen narrates its text. Priority: an uploaded voiceover, else a
 * cached OpenAI narration of the current text, else the free browser voice. A
 * non-voiceover uploaded clip is kept as extra audio but never steals autoplay
 * from the actual narration — only one source autoplays at a time.
 */
export function resolveNarration(section: NarrationSection, sourceText: string, autoplayPref: boolean): Narration {
  const hasAudio = !!section.audioUrl;
  const isVoiceover = hasAudio && section.audioIsVoiceover === true;
  const fresh =
    section.ttsAudioUrl && section.ttsAudioHash && section.ttsAudioHash === hashText(ttsSanitize(sourceText))
      ? section.ttsAudioUrl
      : null;
  const showCached = !isVoiceover && !!fresh;
  const showBrowser = !isVoiceover && !fresh && !!sourceText.trim();
  const hasNarration = hasAudio || showCached || showBrowser;
  const disabled = !!section.audioAutoplayDisabled;

  // The uploaded clip autoplays only when it IS the narration (a voiceover) or
  // when there's no separate TTS narration to take priority.
  const uploadedAutoplay = autoplayPref && !disabled && (isVoiceover || (!showCached && !showBrowser));
  const cachedAutoplay = autoplayPref && showCached;
  const browserAutoplay = autoplayPref && showBrowser;

  return {
    hasAudio, isVoiceover, cachedUrl: fresh, showCached, showBrowser, hasNarration,
    uploadedAutoplay, cachedAutoplay, browserAutoplay,
  };
}
