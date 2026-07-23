'use client';

/**
 * Combined FIND page (formerly "Background + Look Around").
 *
 * One scrolling page labelled FIND: the find instructions (notice prompt +
 * photo) sit at the top, with the Background reading below. No snap-scroll —
 * it's a single continuous scroll; the Journal's "Keep scrolling" indicator
 * cues that there's more below. When the stop has no notice content the page
 * falls back to a Background-only ("DISCOVER") layout.
 */

import { useState, useEffect } from 'react';
import { Stop } from '@/lib/types';
import PhotoContent from './PhotoContent';
import AudioButton from './AudioButton';
import SpeechBar from './SpeechBar';
import { resolveNarration } from '@/lib/tts-narration';
import BackButton from './BackButton';
import NoticeMapDisplay from './NoticeMapDisplay';
import ActionTitle, { SectionSubtitle } from './ActionTitle';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useReadMode } from '@/lib/read-mode';
import { usePhotoCues } from '../usePhotoCues';

interface Props {
  stop: Stop;
  onContinue?: () => void;
  /** Optional handler for the "find me on the map" button. Visible only
   *  when the stop has a location. */
  onPeekMap?: () => void;
  /** When true this is the FIND section of a merged FIND+DISCOVER page: no
   *  footer/continue button (the reader snap-scrolls down to DISCOVER); a
   *  "scroll to discover" cue replaces it. */
  embedded?: boolean;
  /** Drop the find instructions + notice photos, leaving Background only. Set by
   *  FindDiscoverCard, where FindActivityCard is now its own snap section above
   *  and has already given the instructions — and, crucially, controls when the
   *  notice photo is allowed to appear. Rendering them here too would both repeat
   *  the prompt and spoil the activity. */
  hideFindInstructions?: boolean;
}

/**
 * Does this stop have a Background worth a screen of its own?
 *
 * Exported because FindDiscoverCard has to answer the same question to decide
 * whether to render the Background section at all — a stop with no Background is
 * a snap section holding a title and a scroll cue, which stops the reader in the
 * middle of the flow for nothing. Both callers must agree, hence one predicate.
 *
 * Audio counts: a stop can have narration and no written text.
 */
export function hasBackgroundContent(stop: Stop): boolean {
  return !!(stop.seed.text || stop.seed.audioUrl);
}

export default function SeedCard({ stop, onContinue, onPeekMap, embedded = false, hideFindInstructions = false }: Props) {
  const [autoplayPref] = useAudioAutoplay();
  // Background narration source: uploaded voiceover → cached OpenAI narration →
  // free browser voice. The narration takes autoplay priority — a non-voiceover
  // clip and the notice audio never autoplay alongside it (never two at once).
  const seedTtsSource = stop.seed.ttsText || stop.seed.text;
  const seedNar = resolveNarration(stop.seed, seedTtsSource, autoplayPref);
  const bgNarrationAutoplays = seedNar.uploadedAutoplay || seedNar.cachedAutoplay || seedNar.browserAutoplay;
  const noticeAutoplay = autoplayPref && !stop.notice.audioAutoplayDisabled && !bgNarrationAutoplays;

  // Audio-synced photo highlights for the Background (seed) and Find
  // (notice) narrations.
  const seedCues = usePhotoCues(stop.seed.photoCues, stop.seed.photos || [], stop.seed.photoCuesHoldLast);
  const noticeCues = usePhotoCues(stop.notice.photoCues, stop.notice.photos || [], stop.notice.photoCuesHoldLast);
  // Background reading is collapsed behind "Read Along" when there's narration
  // (uploaded audio OR the auto text-to-speech) and the learner chose "Listen".
  // It opens by default only when they chose "Read", or when there's no
  // narration at all (so a text-only Background still shows).
  const [readMode] = useReadMode();
  const hasBgNarration = seedNar.hasNarration;
  const [bgReadAlong, setBgReadAlong] = useState(readMode || !hasBgNarration);

  const hasNoticeSection = !hideFindInstructions && !!(
    stop.notice.prompt
    || stop.notice.audioUrl
    || stop.notice.noticeMap?.url
    || (stop.notice.photos && stop.notice.photos.length > 0)
    || stop.notice.photoUrl
  );

  // Use the notice timer as the primary timer
  const noticeTimer = stop.notice.timerSeconds || 0;
  const seedTimer = stop.seed.timerSeconds ?? null;
  const totalTimer = seedTimer ?? (noticeTimer > 0 ? noticeTimer : null);

  const [secondsLeft, setSecondsLeft] = useState(totalTimer);
  const timerActive = totalTimer !== null && totalTimer > 0;
  const timerDone = !timerActive || (secondsLeft !== null && secondsLeft <= 0);

  useEffect(() => {
    if (!timerActive || timerDone) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max((s ?? 0) - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timerDone]);

  // SVG ring for the timer
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = timerDone || !totalTimer ? 0 : ((secondsLeft ?? 0) / totalTimer) * circumference;

  // Find instructions (notice prompt + photo) — sits at the TOP of the page.
  const findInstructions = (
    <>
      {onPeekMap && stop.location && (
        <div>
          <button
            onClick={onPeekMap}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider"
            style={{
              color: 'var(--th-primary)',
              border: '1px solid var(--th-primary)',
              backgroundColor: 'color-mix(in srgb, var(--th-primary) 6%, transparent)',
            }}
            title="Find this stop on the map"
            aria-label="Find this stop on the map"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" />
              <circle cx="12" cy="9" r="2" fill="currentColor" stroke="none" />
            </svg>
            Find pin
          </button>
        </div>
      )}
      {stop.notice.audioUrl && <AudioButton audioUrl={stop.notice.audioUrl} title={stop.notice.audioTitle} autoplay={noticeAutoplay} onTimeUpdate={noticeCues.onTimeUpdate} onEnded={noticeCues.onEnded} />}
      {stop.notice.noticeMap && stop.notice.noticeMap.url && (
        <NoticeMapDisplay map={stop.notice.noticeMap} />
      )}
      {(stop.notice.prompt || (stop.notice.photos && stop.notice.photos.length > 0) || stop.notice.photoUrl) && (
        <PhotoContent
          text={stop.notice.prompt}
          photos={stop.notice.photos || []}
          legacyPhotoUrl={stop.notice.photoUrl}
          legacyPhotoCaption={stop.notice.photoCaption}
          textClass="text-[23px] leading-relaxed font-serif text-text-primary"
          highlightedUrl={noticeCues.highlightedUrl}
        />
      )}
    </>
  );

  // The notice photos with no prompt — what the Background section shows once the
  // FIND activity above has been done. The prompt is spent by then (they've read
  // it, shot it, and compared); the photo stays because it's what the Background
  // is about. Empty `text` makes PhotoContent render photos only.
  const noticePhotosOnly = (stop.notice.photos?.some((p) => p.url) || stop.notice.photoUrl) ? (
    <PhotoContent
      text=""
      photos={stop.notice.photos || []}
      legacyPhotoUrl={stop.notice.photoUrl}
      legacyPhotoCaption={stop.notice.photoCaption}
      highlightedUrl={noticeCues.highlightedUrl}
    />
  ) : null;

  // Background reading — sits BELOW the find instructions. The audio narration
  // box sits directly under the "Background" title, and the reading itself is
  // collapsed behind a "Read Along" toggle.
  const backgroundContent = (
    <>
      {hasBackgroundContent(stop) ? (
        <div>
          <SectionSubtitle className="mb-2">Background</SectionSubtitle>
          {/* Uploaded audio (voiceover, or an extra non-voiceover clip). */}
          {stop.seed.audioUrl && <AudioButton audioUrl={stop.seed.audioUrl} title={stop.seed.audioTitle} autoplay={seedNar.uploadedAutoplay} onTimeUpdate={seedCues.onTimeUpdate} onEnded={seedCues.onEnded} />}
          {/* Cached OpenAI narration of the Background (also drives the photo cues). */}
          {seedNar.showCached && <AudioButton audioUrl={seedNar.cachedUrl!} title={stop.seed.audioTitle || 'Background'} autoplay={seedNar.cachedAutoplay} onTimeUpdate={seedCues.onTimeUpdate} onEnded={seedCues.onEnded} />}
          {/* Free browser voice when nothing is cached yet. */}
          {seedNar.showBrowser && <SpeechBar text={seedTtsSource} title={stop.seed.audioTitle || 'Background'} autoplay={seedNar.browserAutoplay} />}
          {stop.seed.text && (
            <>
              <button
                onClick={() => setBgReadAlong((v) => !v)}
                className="mt-2 text-base text-text-secondary flex items-center gap-2 py-2 px-3 rounded-lg border border-sandstone-light hover:bg-sandstone-light/20"
              >
                <span className="text-xs">{bgReadAlong ? '▼' : '▶'}</span>
                {bgReadAlong ? 'Hide text' : 'Read Along'}
              </button>
              {bgReadAlong && (
                <div className="mt-3 animate-fade-in">
                  <PhotoContent
                    text={stop.seed.text}
                    photos={stop.seed.photos || []}
                    legacyPhotoUrl={stop.seed.photoUrl}
                    legacyPhotoCaption={stop.seed.photoCaption}
                    highlightedUrl={seedCues.highlightedUrl}
                  />
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="text-base text-text-secondary italic">Take a moment to look around this spot.</p>
      )}
    </>
  );

  // Merged mode: a gentle "scroll down to DISCOVER" cue in place of the footer.
  const scrollCue = (
    <div className="flex flex-col items-center gap-1 pt-4 pb-2" style={{ color: 'var(--th-primary)' }}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">Scroll to discover</span>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce" aria-hidden="true">
        <path d="M12 5v14M6 13l6 6 6-6" />
      </svg>
    </div>
  );

  // Timer + continue/back row (always at the bottom)
  const footerBlock = (
    <>
      {timerActive && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--th-border)" strokeWidth="3" />
              <circle
                cx="32" cy="32" r={radius} fill="none" stroke="var(--th-accent-dark)" strokeWidth="3"
                strokeLinecap="round" strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-accent-dark">
              {secondsLeft}
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            {timerDone ? 'Ready when you are' : 'Take a moment...'}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className={`flex-1 py-3 rounded-lg text-base font-semibold transition-all ${
            timerDone ? 'bg-accent-dark text-white' : 'bg-accent-dark/20 text-accent-dark'
          }`}
        >
          We&apos;ve looked &mdash; continue
        </button>
      </div>
    </>
  );

  // Background-only fallback when there's nothing to "find" — no FIND label.
  if (!hasNoticeSection) {
    return (
      <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center">
        {/* In the FIND flow the title and the photo are one unit — the name
            captions the thing directly beneath it — so they group in their own
            wrapper at space-y-2 rather than taking the container's space-y-5.
            Everywhere else the title is a subtitle under FIND/DISCOVER. */}
        {hideFindInstructions ? (
          <div className="space-y-2">
            {stop.title && (
              <p
                className="font-serif font-bold text-[26px] leading-snug text-center"
                style={{ color: 'var(--th-primary)' }}
              >
                {stop.title}
              </p>
            )}
            {noticePhotosOnly}
            {/* Still stuck? A way back to the map from the Background too. */}
            {onPeekMap && stop.location && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={onPeekMap}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-semibold shadow-sm active:scale-95 transition-transform"
                  style={{ color: 'var(--th-primary)', border: '2px solid var(--th-primary)', backgroundColor: 'color-mix(in srgb, var(--th-primary) 8%, transparent)' }}
                  aria-label="Find this stop on the map"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" />
                    <circle cx="12" cy="9" r="2" fill="currentColor" stroke="none" />
                  </svg>
                  Find on map
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <ActionTitle action={embedded ? 'FIND' : 'DISCOVER'} />
            {stop.title && <p className="mt-1 font-serif italic text-text-secondary text-[22px] leading-snug">{stop.title}</p>}
          </div>
        )}
        {backgroundContent}
        {embedded ? scrollCue : footerBlock}
      </div>
    );
  }

  // Merged FIND page: find instructions + photo on top, Background below.
  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-5">
        <div>
          <ActionTitle action="FIND" />
          {stop.title && <p className="mt-1 font-serif italic text-text-secondary text-[22px] leading-snug">{stop.title}</p>}
        </div>
        {findInstructions}
      </div>

      <div className="space-y-5 pt-2">
        {backgroundContent}
      </div>

      {embedded ? scrollCue : footerBlock}
    </div>
  );
}
