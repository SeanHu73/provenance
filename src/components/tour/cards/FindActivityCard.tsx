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
import { createPortal } from 'react-dom';
import { Stop } from '@/lib/types';
import ActionTitle from './ActionTitle';
import FormattedText from './FormattedText';
import { CheckIcon, CloseIcon, EyeIcon, MapPinIcon } from '@/components/icons';

/** Height cap for each revealed photo. The "Did you find it?" line sits above the
 *  pair and each photo carries a caption below it, so this leaves room for both
 *  on a phone. `vh` (not `%`) so the cap actually resolves — see the reveal
 *  block. */
const PHOTO_CAP = '38vh';

/** The FIND briefing's font — the app's body serif (Newsreader), the face used
 *  for reading copy everywhere else, so the FIND page sits with the rest of the
 *  tour instead of jarring against it. */
const CLUE_FONT = 'var(--th-font-body)';

interface Props {
  stop: Stop;
  /** Fires once, when the reveal happens — lets the parent mount what's below. */
  onFound?: () => void;
  /** The "Tap to reveal answer" escape hatch: skip the photo compare entirely and
   *  take them straight to the Background section. */
  onRevealAnswer?: () => void;
  /** Opens the map peek so the explorer can locate the stop. Present only when a
   *  location exists (gated upstream in page.tsx), so no extra location check here. */
  onPeekMap?: () => void;
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

export default function FindActivityCard({ stop, onFound, onRevealAnswer, onPeekMap }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [revealed, setRevealed] = useState(false);
  // Tapping either photo opens it full-screen — a phone-sized side-by-side is
  // too small to actually compare details in.
  const [zoom, setZoom] = useState<{ url: string; alt: string } | null>(null);
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
    // layout (portrait shots sit side by side, landscape ones stack). Taking the
    // photo no longer auto-advances: the button turns into a green pulsing check
    // and they tap it to submit, so the compare is a choice, not a jump cut.
    const img = new Image();
    img.onload = () => setShot({ url, portrait: img.naturalHeight >= img.naturalWidth });
    img.onerror = () => setShot({ url, portrait: true });
    img.src = url;
  };

  const submit = () => { setRevealed(true); onFound?.(); };
  // The escape hatch skips the photo compare and drops straight to Background.
  const revealAnswer = () => { onRevealAnswer?.(); };

  const sideBySide = shot?.portrait ?? true;

  return (
    <div className="animate-fade-in space-y-4 min-h-full flex flex-col justify-center">
      <div>
        <ActionTitle action="FIND" centered />
        {stop.title && <p className="mt-1 text-center font-serif italic text-text-secondary text-[22px] leading-snug">{stop.title}</p>}
      </div>

      {/* The instructions — the notice prompt, and deliberately nothing else.
          Set as a briefing rather than body copy: centred, ruled off, with an
          eyebrow, so it reads as a task to go and do. Montserrat (see CLUE_FONT)
          so the ask reads friendly and legible. */}
      {instructions && (
        <div className="py-1 text-center" style={{ fontFamily: CLUE_FONT }}>
          <div className="mx-auto mb-3 h-px w-12" style={{ backgroundColor: 'var(--th-primary)', opacity: 0.5 }} />
          <p
            className="text-[15px] font-semibold uppercase tracking-[0.22em] mb-3"
            style={{ color: 'var(--th-primary)' }}
          >
            Your Clue
          </p>
          {/* Through FormattedText, not raw — prompts are authored with the
              app's markup (**bold**, *italic*, {{#hex}}colour{{/}}), and a plain
              <p> renders the asterisks literally. */}
          <p className="text-[29px] leading-snug text-text-primary whitespace-pre-line max-w-xl mx-auto">
            <FormattedText text={instructions} />
          </p>
          <div className="mx-auto mt-3 h-px w-12" style={{ backgroundColor: 'var(--th-primary)', opacity: 0.5 }} />
        </div>
      )}

      {/* Locate the stop. Sized as a real button (not the old 11px pill) — the ask
          is "go find this thing", so the way to find it has to be obvious. Gone
          once they've taken the photo. */}
      {!revealed && onPeekMap && (
        <div className="flex justify-center">
          <button
            onClick={onPeekMap}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[16px] font-semibold shadow-sm active:scale-95 transition-transform"
            style={{ fontFamily: CLUE_FONT, color: 'var(--th-primary)', border: '2px solid var(--th-primary)', backgroundColor: 'color-mix(in srgb, var(--th-primary) 8%, transparent)' }}
            aria-label="Find this stop on the map"
          >
            <MapPinIcon width={20} height={20} aria-hidden />
            Find on map
          </button>
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

          <p className="text-[18px] text-center font-semibold" style={{ fontFamily: CLUE_FONT, color: 'var(--text-primary)' }}>
            Found it? Take a photo!
          </p>

          {/* One control, two states. Tapping it opens the camera; once a shot is
              taken the *same* button turns green and submits. The old flow put a
              preview screen with its own Submit in between, which read as a second
              approval of a photo they had already confirmed in the camera. */}
          <button
            onClick={() => (shot ? submit() : inputRef.current?.click())}
            className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${shot ? 'submit-pulse' : ''}`}
            style={shot
              ? { backgroundColor: '#16A34A', color: '#fff' }
              : { backgroundColor: 'var(--th-surface)', color: 'var(--th-primary)' }}
            aria-label={shot ? 'Submit your photo' : 'Take a photo of what you found'}
          >
            {shot ? (
              <CheckIcon width={40} height={40} aria-hidden />
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
          </button>

          {/* A compact confirmation of what they shot — tappable to check it full
              screen, with a retake beside it. Not a gate: the green button above
              submits whenever they are ready. */}
          {shot && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setZoom({ url: shot.url, alt: 'The photo you took' })}
                className="rounded-lg overflow-hidden bg-black/[0.04] shrink-0"
                aria-label="View your photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- object URL, not a served asset */}
                <img src={shot.url} alt="The photo you took" className="block object-cover" style={{ width: 56, height: 56 }} />
              </button>
              <button
                onClick={() => inputRef.current?.click()}
                className="text-[13px] underline"
                style={{ fontFamily: CLUE_FONT, color: 'var(--text-secondary)' }}
              >
                Retake
              </button>
            </div>
          )}

          {/* Escape hatch, always available and sitting under the camera. Can't
              reach or photograph the spot? This drops straight to the Background,
              so a hard-to-find stop never dead-ends the tour. */}
          <button
            onClick={revealAnswer}
            className="mt-1 inline-flex items-center gap-2 px-6 py-3 rounded-full text-[16px] font-semibold shadow-sm active:scale-95 transition-transform"
            style={{ fontFamily: CLUE_FONT, color: 'var(--th-primary)', border: '2px solid var(--th-primary)', backgroundColor: 'color-mix(in srgb, var(--th-primary) 8%, transparent)' }}
          >
            <EyeIcon width={20} height={20} aria-hidden />
            Tap to reveal answer
          </button>
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
              <button
                onClick={() => setZoom({ url: shot!.url, alt: 'The photo you took' })}
                className="rounded-xl overflow-hidden bg-black/[0.04] block"
                aria-label="View your photo full screen"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- object URL, not a served asset */}
                <img
                  src={shot!.url}
                  alt="The photo you took"
                  className="block object-contain"
                  style={{ maxHeight: PHOTO_CAP, maxWidth: '100%' }}
                />
              </button>
              <figcaption className="mt-1 text-[11px] uppercase tracking-wider text-text-secondary text-center">Yours</figcaption>
            </figure>
            {noticePhoto && (
              <figure className="min-w-0 flex flex-col items-center">
                <button
                  onClick={() => setZoom({ url: noticePhoto.url, alt: noticePhoto.caption || 'The stop' })}
                  className="rounded-xl overflow-hidden bg-black/[0.04] block"
                  aria-label="View the stop's photo full screen"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic-sized; next/image wants fixed dims */}
                  <img
                    src={noticePhoto.url}
                    alt={noticePhoto.caption || 'The stop'}
                    className="block object-contain"
                    style={{ maxHeight: PHOTO_CAP, maxWidth: '100%' }}
                  />
                </button>
                <figcaption className="mt-1 text-[11px] uppercase tracking-wider text-text-secondary text-center">The stop</figcaption>
              </figure>
            )}
          </div>
        </div>
      )}

      {zoom && <PhotoZoom url={zoom.url} alt={zoom.alt} onClose={() => setZoom(null)} />}
    </div>
  );
}

/**
 * Full-screen look at one photo. Tapping anywhere (or the close control) shuts
 * it.
 *
 * Portalled to <body> rather than rendered in place: the card sits inside the
 * Journal's animated scroll container, and a transformed ancestor becomes the
 * containing block for `position: fixed` — so in place this covered only the
 * scroll area, leaving the header and footer on top of it.
 */
function PhotoZoom({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal((
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-white"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
      >
        <CloseIcon width={18} height={18} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- object URL / intrinsic-sized */}
      <img src={url} alt={alt} className="block object-contain" style={{ maxHeight: '90vh', maxWidth: '100%' }} />
    </div>
  ), document.body);
}
