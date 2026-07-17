'use client';

/**
 * The FIND activity — first snap section of a context stop.
 *
 * The explorer arrives from the map with only the notice prompt as instructions:
 * no photo, because the photo is the answer. They shoot what they think it is,
 * submit, and only then does the real notice photo come in beside theirs to
 * compare. That comparison is the whole activity — it's the difference between
 * reading a caption and actually looking at the thing.
 *
 * Their photo is never uploaded. It's held as an object URL for this screen and
 * revoked on unmount; nothing reaches Firestore or Storage. It exists to make
 * them look, not to be kept.
 *
 * Both photos render `object-contain` — a shot framed by a person on a phone is
 * whatever shape it is, and cropping it to fill would hide the very detail they
 * were asked to notice.
 */

import { useEffect, useRef, useState } from 'react';
import { Stop } from '@/lib/types';
import ActionTitle from './ActionTitle';

/** Height cap for each revealed photo. The "Did you find it?" line sits above the
 *  pair and each photo carries a caption below it, so this leaves room for both
 *  on a phone. `vh` (not `%`) so the cap actually resolves — see the reveal
 *  block. */
const PHOTO_CAP = '38vh';

interface Props {
  stop: Stop;
  /** Fires once, when the reveal happens — lets the parent mount what's below. */
  onFound?: () => void;
}

type Shot = { url: string; portrait: boolean };

/**
 * Notice prompts embed `[photo:N]` markers that PhotoContent normally swaps for
 * the photo itself. Here the photo is the answer, so the markers have to come out
 * rather than render — otherwise the instructions read "[photo:1] Can you find…".
 */
function stripPhotoMarkers(text: string): string {
  return text.replace(/\[photo:\d+\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
}

export default function FindActivityCard({ stop, onFound }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [revealed, setRevealed] = useState(false);
  const objectUrl = useRef<string | null>(null);

  // The browser holds the file in memory until the object URL is revoked; without
  // this a walk-through of a ten-stop tour leaks ten full-res photos.
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const instructions = stripPhotoMarkers(stop.notice.prompt || '');
  const noticePhoto = (stop.notice.photos || []).find((p) => p.url)
    ?? (stop.notice.photoUrl ? { url: stop.notice.photoUrl, caption: stop.notice.photoCaption } : null);

  const onPick = (file: File | undefined) => {
    if (!file) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    // Read the shot's orientation off the decoded bitmap — it decides the reveal
    // layout (portrait shots sit side by side, landscape ones stack).
    const img = new Image();
    img.onload = () => {
      setShot({ url, portrait: img.naturalHeight >= img.naturalWidth });
      // One frame of the bare shot before the reveal, so the transition reads as
      // a response to their submission rather than a jump cut.
      window.setTimeout(() => { setRevealed(true); onFound?.(); }, 450);
    };
    img.onerror = () => { setShot({ url, portrait: true }); setRevealed(true); onFound?.(); };
    img.src = url;
  };

  const sideBySide = shot?.portrait ?? true;

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      <div>
        <ActionTitle action="FIND" />
        {/* The stop's name. Upright and in the theme red rather than the grey
            italic the other cards use — on this screen it's the target being
            named, not a subtitle, and it centres to sit with the mission block
            below. */}
        {stop.title && (
          <p
            className="mt-1 font-serif text-[26px] leading-snug text-center"
            style={{ color: 'var(--th-primary)' }}
          >
            {stop.title}
          </p>
        )}
      </div>

      {/* The instructions — the notice prompt, and deliberately nothing else.
          Set as a briefing rather than body copy: centred, ruled off, with an
          eyebrow, so it reads as a task to go and do rather than something to
          read past on the way down the page. */}
      {instructions && (
        <div className="py-2 text-center">
          <div className="mx-auto mb-3 h-px w-12" style={{ backgroundColor: 'var(--th-primary)', opacity: 0.5 }} />
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-3"
            style={{ color: 'var(--th-primary)' }}
          >
            Your mission
          </p>
          <p className="text-[24px] leading-relaxed font-serif text-text-primary whitespace-pre-line max-w-xl mx-auto">
            {instructions}
          </p>
          <div className="mx-auto mt-3 h-px w-12" style={{ backgroundColor: 'var(--th-primary)', opacity: 0.5 }} />
        </div>
      )}

      {!revealed ? (
        <div className="flex flex-col items-center gap-3 pt-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--th-primary)', color: '#fff' }}
            aria-label="Take a photo of what you found"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <p className="text-[13px] text-text-secondary text-center">
            {shot ? 'Looking…' : 'Found it? Take a photo.'}
          </p>
        </div>
      ) : (
        // pb keeps the photo captions clear of the Journal's "keep scrolling"
        // pill, which is absolutely positioned over the bottom centre.
        <div className="animate-fade-in space-y-4 pb-20">
          <p
            className="text-center font-serif italic text-[32px] leading-snug"
            style={{ color: 'var(--th-primary)' }}
          >
            Did you find it?
          </p>
          {/* The cap lives on the <img> in vh, not on a wrapper as a percentage.
              A percentage max-height resolves against the parent's *definite*
              height; these wrappers size to their content, so `max-h-full` was
              silently ignored and both photos rendered at natural size and got
              clipped. vh is definite, so the image really does fit. */}
          <div className={sideBySide ? 'grid grid-cols-2 gap-2 items-start' : 'flex flex-col gap-2 items-center'}>
            <figure className="min-w-0 flex flex-col items-center">
              <div className="rounded-xl overflow-hidden bg-black/[0.04]">
                {/* eslint-disable-next-line @next/next/no-img-element -- object URL, not a served asset */}
                <img
                  src={shot!.url}
                  alt="The photo you took"
                  className="block object-contain"
                  style={{ maxHeight: PHOTO_CAP, maxWidth: '100%' }}
                />
              </div>
              <figcaption className="mt-1 text-[11px] uppercase tracking-wider text-text-secondary text-center">Yours</figcaption>
            </figure>
            {noticePhoto && (
              <figure className="min-w-0 flex flex-col items-center">
                <div className="rounded-xl overflow-hidden bg-black/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic-sized; next/image wants fixed dims */}
                  <img
                    src={noticePhoto.url}
                    alt={noticePhoto.caption || 'The stop'}
                    className="block object-contain"
                    style={{ maxHeight: PHOTO_CAP, maxWidth: '100%' }}
                  />
                </div>
                <figcaption className="mt-1 text-[11px] uppercase tracking-wider text-text-secondary text-center">The stop</figcaption>
              </figure>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
