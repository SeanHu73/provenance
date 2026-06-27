'use client';

/**
 * Context-Prototype — the end-of-act "Share What You Think" reflection.
 *
 * The explorer responds to an admin-authored reflection prompt by typing or
 * recording (→ editable). They can attach photos and drop a single labelled map
 * pin ("design their own stop"), and optionally share the whole thing to the
 * community. Submitting writes the response to the session; if shared, it also
 * posts a CommunityShare (which surfaces on the next "Hear from the Community"
 * screen).
 */

import { useState } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useTour } from '@/context/TourContext';
import { findActOfStop, reflectionPromptOf } from '@/lib/tour-session';
import { ActReflectionResponse, ForumIdentity } from '@/lib/types';
import {
  uploadSharePhoto,
  submitShare,
  getForumIdentity,
  saveForumIdentity,
} from '@/lib/community-store';
import { logActReflection } from '@/lib/tour-logger';
import ResponseInput from './ResponseInput';
import BackButton from './BackButton';
import FormattedText from './FormattedText';

const MAP_ID = 'b8f339c02d8c7d5bd3f12d1b';
const FALLBACK_LOCATION = { lat: 37.42700, lng: -122.17015 };

interface Props {
  onComplete: (response: ActReflectionResponse) => void;
}

type Pin = { lat: number; lng: number; title?: string; note?: string };

export default function ActReflectionCard({ onComplete }: Props) {
  const { tour, session, currentStop } = useTour();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const act = tour && currentStop ? findActOfStop(tour, currentStop.id) : null;
  const prompt = reflectionPromptOf(act);

  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pin, setPin] = useState<Pin | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);

  const savedIdentity = getForumIdentity();
  const [name, setName] = useState(savedIdentity?.name || '');
  const needName = share && !savedIdentity;

  const handlePhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadSharePhoto(f));
      setPhotos((prev) => [...prev, ...urls]);
    } catch (err) {
      console.error('[reflection] photo upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const canSubmit = !!text.trim() && !busy && (!needName || !!name.trim());

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    const response: ActReflectionResponse = {
      text: text.trim(),
      photos,
      pin,
      sharedToCommunity: share,
    };
    if (share && tour && act) {
      let identity: ForumIdentity | undefined = savedIdentity ?? undefined;
      if (!identity && name.trim()) {
        identity = { name: name.trim(), about: '' };
        saveForumIdentity(identity);
      }
      try {
        response.shareId = await submitShare({
          tourId: tour.id,
          actId: act.id,
          text: response.text,
          photos,
          pin,
          sessionId: session?.id || 'unknown',
          name: identity?.name,
          about: identity?.about,
        });
      } catch (err) {
        console.error('[reflection] share failed:', err);
        response.sharedToCommunity = false;
      }
    }
    if (tour && act) {
      logActReflection({
        tourId: tour.id, sessionId: session?.id || 'unknown', tourTitle: tour.title,
        actTitle: act.title, prompt, response: response.text, shared: !!response.sharedToCommunity,
      });
    }
    onComplete(response);
  };

  return (
    <div className="animate-fade-in space-y-5">
      <h2
        className="font-display font-bold leading-tight"
        style={{ fontSize: 34, color: 'var(--th-primary)' }}
      >
        Share What You Think
      </h2>

      {prompt && (
        <p className="font-serif leading-snug" style={{ fontSize: 22, color: 'var(--th-accent-dark)' }}>
          <FormattedText text={prompt} />
        </p>
      )}

      <ResponseInput value={text} onChange={setText} placeholder="Your response…" />

      {/* Photos */}
      <div className="space-y-2">
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/55 text-white text-xs flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer"
          style={{ color: 'var(--th-primary)', border: '1px solid var(--th-primary)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
          {uploading ? 'Uploading…' : 'Add photos'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
        </label>
      </div>

      {/* Map pin — "design your own stop" */}
      <div className="space-y-2">
        {pin ? (
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
            <PinMap apiKey={apiKey} pin={pin} onPlace={setPin} />
            <div className="p-3 space-y-2">
              <input
                value={pin.title || ''}
                onChange={(e) => setPin({ ...pin, title: e.target.value })}
                placeholder="Name this spot…"
                className="w-full px-3 py-2 rounded-lg text-[16px] font-serif text-text-primary border-2 border-sandstone-light bg-white focus:outline-none"
              />
              <textarea
                value={pin.note || ''}
                onChange={(e) => setPin({ ...pin, note: e.target.value })}
                placeholder="What should others notice here? (optional)"
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-[15px] font-serif text-text-primary border-2 border-sandstone-light bg-white focus:outline-none"
              />
              <button onClick={() => { setPin(null); setMapOpen(false); }} className="text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Remove pin
              </button>
            </div>
          </div>
        ) : mapOpen ? (
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
            <PinMap apiKey={apiKey} pin={null} onPlace={setPin} />
            <p className="p-2 text-[13px] text-center" style={{ color: 'var(--text-secondary)' }}>Tap the map to drop your pin.</p>
          </div>
        ) : (
          <button
            onClick={() => setMapOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold"
            style={{ color: 'var(--th-primary)', border: '1px solid var(--th-primary)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" /><circle cx="12" cy="9" r="2" fill="currentColor" stroke="none" /></svg>
            Drop a pin on the map
          </button>
        )}
      </div>

      {/* Share to community */}
      <div className="space-y-2 pt-1">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="w-5 h-5 accent-[color:var(--th-primary)]" />
          <span className="text-[16px]" style={{ color: 'var(--text-primary)' }}>Share my response with the community</span>
        </label>
        {needName && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-2.5 rounded-lg text-[17px] font-serif text-text-primary border-2 border-sandstone-light bg-white focus:outline-none animate-fade-in"
          />
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <BackButton />
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-accent-dark text-white disabled:opacity-40"
        >
          {busy ? 'Submitting…' : share ? 'Submit & share' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

/** Small satellite map for placing/showing a single reflection pin. */
function PinMap({ apiKey, pin, onPlace }: { apiKey?: string; pin: Pin | null; onPlace: (p: Pin) => void }) {
  if (!apiKey) {
    return <div className="h-40 flex items-center justify-center text-sm italic" style={{ color: 'var(--text-secondary)' }}>Map unavailable</div>;
  }
  return (
    <div className="h-44">
      <APIProvider apiKey={apiKey}>
        <GoogleMap
          mapId={MAP_ID}
          defaultCenter={pin ?? FALLBACK_LOCATION}
          defaultZoom={18}
          mapTypeId="satellite"
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          style={{ width: '100%', height: '100%' }}
          onClick={(e) => {
            const ll = e.detail.latLng;
            if (ll) onPlace({ ...(pin || {}), lat: ll.lat, lng: ll.lng });
          }}
        >
          {pin && (
            <AdvancedMarker position={{ lat: pin.lat, lng: pin.lng }}>
              <div style={{ transform: 'translateY(50%)' }}>
                <div className="w-7 h-7 rounded-full border-2 border-white" style={{ background: 'var(--th-primary)', boxShadow: '0 2px 6px rgba(0,0,0,0.45)' }} />
              </div>
            </AdvancedMarker>
          )}
        </GoogleMap>
      </APIProvider>
    </div>
  );
}
