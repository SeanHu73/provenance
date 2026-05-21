'use client';

import { useRef, useState, useEffect } from 'react';
import { Stop, Detour } from '@/lib/types';
import FormattedText from './FormattedText';
import FullscreenPhoto from './FullscreenPhoto';
import { useTour } from '@/context/TourContext';
import DetourFlow from './DetourFlow';
import BackButton from './BackButton';

interface Props {
  stop: Stop;
  isLastStop: boolean;
  onAskQuestion: () => void;
  onContinue: () => void;
}

export default function WhatsNext({ stop, isLastStop, onAskQuestion, onContinue }: Props) {
  const { isDetourVisited, recordDetourVisit } = useTour();
  const [activeDetour, setActiveDetour] = useState<Detour | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; caption: string | null } | null>(null);

  const continueRef = useRef<HTMLButtonElement>(null);
  const [showBottomContinue, setShowBottomContinue] = useState(false);

  useEffect(() => {
    if (!continueRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowBottomContinue(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(continueRef.current);
    return () => observer.disconnect();
  }, []);

  const handleDetourReturn = () => {
    if (activeDetour) recordDetourVisit(activeDetour.id);
    setActiveDetour(null);
  };

  const detours = stop.detours || [];

  if (activeDetour) {
    return (
      <div className="animate-fade-in">
        <DetourFlow detour={activeDetour} onReturn={handleDetourReturn} />
      </div>
    );
  }

  return (
    <>
      <p className="text-2xl uppercase tracking-[0.14em] text-aged-gold font-semibold">
        What&apos;s next...
      </p>
      {stop.reveal.bridgeText && (
        <p className="text-[18px] text-text-secondary italic leading-relaxed">
          <FormattedText text={stop.reveal.bridgeText} />
        </p>
      )}
      {(stop.reveal.bridgePhotos || []).map((photo, i) => (
        photo.url && (
          <button key={i} onClick={() => setFullscreenPhoto(photo)} className="w-full rounded-lg overflow-hidden shadow-md border border-sandstone-light my-3 text-left cursor-pointer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.caption || ''} className="w-full max-h-72 object-contain" />
            {photo.caption && <p className="text-xs text-text-secondary px-3 py-1.5 bg-sandstone/50 italic">{photo.caption}</p>}
          </button>
        )
      ))}

      <div className="space-y-3">
        <div className="flex gap-2">
          <BackButton />
          <button
            ref={continueRef}
            onClick={onContinue}
            className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white"
          >
            {isLastStop ? 'Finish the tour' : 'Continue the tour'}
          </button>
        </div>
      </div>

      {/* Related artefacts */}
      {detours.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold">
            Related artefacts
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {detours.map((detour) => {
              const visited = isDetourVisited(detour.id);
              return (
                <button
                  key={detour.id}
                  onClick={() => setActiveDetour(detour)}
                  className="shrink-0 rounded-lg overflow-hidden shadow-md border border-sandstone-light text-left transition-all hover:border-aged-gold"
                  style={{ width: 140, opacity: visited ? 0.7 : 1 }}
                >
                  {detour.coverPhoto.url && (
                    <div className="relative h-24 bg-sandstone">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={detour.coverPhoto.url}
                        alt={detour.coverPhoto.caption}
                        className="w-full h-full object-cover"
                      />
                      {visited && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-olive flex items-center justify-center">
                          <span className="text-white text-[10px]">&#10003;</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-2 bg-warm-white">
                    <p className="text-[11px] font-semibold text-text-primary line-clamp-1">{detour.title}</p>
                    {detour.coverPhoto.caption && (
                      <p className="text-[10px] text-text-secondary line-clamp-1 mt-0.5">{detour.coverPhoto.caption}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {showBottomContinue && (
            <button
              onClick={onContinue}
              className="w-full py-3 rounded-lg text-base font-semibold bg-olive text-white"
            >
              {isLastStop ? 'Finish the tour' : 'Continue the tour'}
            </button>
          )}
        </div>
      )}
      {fullscreenPhoto && (
        <FullscreenPhoto url={fullscreenPhoto.url} caption={fullscreenPhoto.caption} onClose={() => setFullscreenPhoto(null)} />
      )}
    </>
  );
}
