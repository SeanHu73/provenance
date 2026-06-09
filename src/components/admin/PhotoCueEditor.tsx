'use client';

/**
 * Reusable admin editor for audio-synced photo highlight cues. Drop it under
 * any AudioUpload that has an accompanying photo list. Each cue is a
 * timestamp (seconds into the audio) + the photo that should glow from then
 * until the next cue. Renders nothing if there are no photos to cue.
 */

import { PhotoCue, StopPhoto } from '@/lib/types';

interface Props {
  cues?: PhotoCue[];
  photos: StopPhoto[];
  onChange: (cues: PhotoCue[]) => void;
  /** "Keep the last photo highlighted after the audio ends" toggle. */
  holdLast?: boolean;
  onHoldLastChange?: (v: boolean) => void;
}

export default function PhotoCueEditor({ cues, photos, onChange, holdLast = false, onHoldLastChange }: Props) {
  if (photos.length === 0) return null;
  const list = cues || [];

  const update = (i: number, patch: Partial<PhotoCue>) => {
    const next = [...list];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  return (
    <div className="border-t border-stone-200 pt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-600 font-medium">Photo highlights during audio</span>
        <button
          onClick={() => onChange([...list, { time: 0, photoIndex: 0 }])}
          className="text-[10px] text-blue-700 hover:underline"
        >+ Add cue</button>
      </div>
      <p className="text-[10px] text-stone-400">At each timestamp (seconds into the audio) the chosen photo gently glows until the next cue.</p>
      {list.length === 0 ? (
        <p className="text-[10px] text-stone-400 italic">No cues yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((cue, ci) => (
            <li key={ci} className="flex items-center gap-2">
              <span className="text-[10px] text-stone-500">at</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={cue.time}
                onChange={(e) => update(ci, { time: Math.max(0, Number(e.target.value) || 0) })}
                className="w-16 px-2 py-1 border border-stone-300 rounded text-xs"
              />
              <span className="text-[10px] text-stone-500">sec &rarr;</span>
              <select
                value={cue.photoIndex}
                onChange={(e) => update(ci, { photoIndex: Number(e.target.value) })}
                className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
              >
                {photos.map((p, pi) => (
                  <option key={pi} value={pi}>Photo {pi + 1}{p.caption ? ` — ${p.caption.slice(0, 24)}` : ''}</option>
                ))}
              </select>
              <button
                onClick={() => onChange(list.filter((_, j) => j !== ci))}
                className="text-[10px] text-red-600 hover:underline"
              >Remove</button>
            </li>
          ))}
        </ul>
      )}
      {list.length > 0 && onHoldLastChange && (
        <label className="flex items-center gap-2 text-[11px] text-stone-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={holdLast}
            onChange={(e) => onHoldLastChange(e.target.checked)}
            className="w-3.5 h-3.5 accent-amber-500"
          />
          Keep the last photo highlighted after the audio ends
        </label>
      )}
    </div>
  );
}
