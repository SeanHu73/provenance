'use client';

/**
 * Learner-facing photo display.
 *
 * Shows a single photo (no carousel) with:
 *   - numbered annotation dots at the annotations' x/y percentages
 *   - a caption line (caption + source attribution)
 *   - a "Show hints" button that reveals annotation captions and the
 *     category-relevant clue text
 *
 * Mobile-first: photos sit in the middle third of the screen, capped with
 * max-height so they never dominate on a 390px-wide device.
 */

import { useMemo, useState } from 'react';
import { Photo, PhotoAnnotation, QuestionCategory } from '@/lib/types';

interface Props {
  photo: Photo;
  categories: QuestionCategory[];  // question categories → pick which clue to show
}

function attributionLine(photo: Photo): string {
  if (photo.type === 'onsite') {
    return photo.credit || 'Taken on site';
  }
  if (photo.type === 'contributor') {
    return photo.credit || 'Learner contribution';
  }
  // archival
  const parts: string[] = [];
  if (photo.credit) parts.push(photo.credit);
  if (photo.year) parts.push(photo.year);
  return parts.join(', ') || 'Archival source';
}

/**
 * Given an annotation + the current question categories, return the single
 * most relevant clue string. Falls back to the annotation caption if no
 * category-specific clue applies.
 */
function relevantClue(annotation: PhotoAnnotation, categories: QuestionCategory[]): string {
  for (const cat of categories) {
    if (annotation.clues[cat]) return annotation.clues[cat]!;
  }
  // fallback: any clue the annotator wrote
  const firstAvailable = Object.values(annotation.clues).find(Boolean);
  return firstAvailable || '';
}

export default function PhotoDisplay({ photo, categories }: Props) {
  const [hintsShown, setHintsShown] = useState(false);
  const [activeAnnotationIdx, setActiveAnnotationIdx] = useState<number | null>(null);

  const attribution = useMemo(() => attributionLine(photo), [photo]);
  const hasAnnotations = photo.annotations && photo.annotations.length > 0;

  const toggleDot = (idx: number) => {
    setHintsShown(true);
    setActiveAnnotationIdx(activeAnnotationIdx === idx ? null : idx);
  };

  const toggleHints = () => {
    if (hintsShown) {
      setHintsShown(false);
      setActiveAnnotationIdx(null);
    } else {
      setHintsShown(true);
    }
  };

  const activeAnnotation = activeAnnotationIdx !== null ? photo.annotations[activeAnnotationIdx] : null;

  return (
    <div className="my-5 animate-fade-in">
      {/*
        Photo frame — `object-contain` fits tall portraits, wide landscapes,
        and squares without cropping. `w-full h-auto` gives the image the
        full card width and computes height from aspect; `max-h-[50vh]`
        prevents a tall photo from dominating the middle of a 390px phone,
        at which point object-contain letterboxes vertically. Background
        fills the letterbox so it reads as a frame.
      */}
      <div className="relative rounded-xl overflow-hidden bg-sandstone-light/30 border border-sandstone-light/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || 'Provenance photograph'}
          className="w-full h-auto max-h-[50vh] object-contain block"
          loading="lazy"
        />

        {/* Annotation dots, shown once hints are revealed.
            Positioned as percentages of the container (not the rendered
            image bounds), so letterbox may shift dots slightly when a
            portrait photo is contained inside a wider container. For most
            dots (which cluster near the middle of the subject), this is
            acceptable. */}
        {hintsShown && hasAnnotations && photo.annotations.map((ann, idx) => (
          <button
            key={idx}
            onClick={() => toggleDot(idx)}
            aria-label={`Annotation ${idx + 1}: ${ann.caption}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-warm-white shadow-md flex items-center justify-center text-[11px] font-sans font-bold transition-all active:scale-90 ${
              activeAnnotationIdx === idx
                ? 'bg-aged-gold text-warm-white scale-110'
                : 'bg-mosaic-blue text-warm-white hover:scale-110'
            }`}
            style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* Caption + attribution */}
      <div className="mt-2 px-1">
        {photo.caption && (
          <p className="font-serif text-xs text-text-secondary leading-snug">{photo.caption}</p>
        )}
        <p className="font-sans text-[10px] text-text-muted uppercase tracking-wider mt-1">{attribution}</p>
      </div>

      {/* Show hints toggle + active annotation detail */}
      {hasAnnotations && (
        <div className="mt-3">
          <button
            onClick={toggleHints}
            className="text-xs font-sans font-medium text-mosaic-blue hover:text-mosaic-blue-light px-3 py-1.5 rounded-full border border-mosaic-blue/30 bg-warm-white transition-all active:scale-[.97]"
          >
            {hintsShown ? 'Hide hints' : `Show hints (${photo.annotations.length})`}
          </button>

          {hintsShown && activeAnnotation && (
            <div className="mt-3 p-3 rounded-lg border border-aged-gold/30 bg-warm-white animate-fade-in">
              <p className="font-serif text-sm text-text-primary leading-relaxed mb-1">
                <span className="font-sans text-[10px] font-bold text-aged-gold uppercase tracking-wider mr-2">
                  {activeAnnotationIdx! + 1}
                </span>
                {activeAnnotation.caption}
              </p>
              {relevantClue(activeAnnotation, categories) && (
                <p className="font-serif text-xs text-text-secondary italic leading-relaxed mt-1">
                  {relevantClue(activeAnnotation, categories)}
                </p>
              )}
            </div>
          )}

          {hintsShown && !activeAnnotation && (
            <p className="mt-2 font-sans text-[11px] text-text-muted leading-relaxed">
              Tap a number to read its hint.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
