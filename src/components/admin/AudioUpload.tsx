'use client';

/**
 * Audio upload field for the admin tour editor.
 * Shows URL input + upload button + title field + preview player.
 */

interface Props {
  audioUrl: string | null;
  audioTitle?: string | null;
  onChange: (url: string | null) => void;
  onTitleChange?: (title: string | null) => void;
  uploadPath: string;
  onUploadFile: (file: File, path: string) => Promise<string>;
  /** When provided alongside onAutoplayDisabledChange, renders a "Don't
   *  autoplay on this screen" checkbox so the admin can opt this audio
   *  out of the user-facing autoplay preference (e.g. screens where
   *  explorers should read first before audio joins in). */
  autoplayDisabled?: boolean;
  onAutoplayDisabledChange?: (v: boolean) => void;
  /** When provided, renders a "This audio is the voiceover" checkbox. When
   *  ticked, the screen uses this audio as its narration and skips the auto
   *  text-to-speech fallback. Left unticked, the auto TTS narration still runs
   *  (this clip is treated as extra, non-narration audio). */
  isVoiceover?: boolean;
  onIsVoiceoverChange?: (v: boolean) => void;
}

export default function AudioUpload({ audioUrl, audioTitle, onChange, onTitleChange, uploadPath, onUploadFile, autoplayDisabled, onAutoplayDisabledChange, isVoiceover, onIsVoiceoverChange }: Props) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-stone-500">Audio narration (optional)</span>
      <div className="flex gap-2 items-center">
        <input
          value={audioUrl || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
          placeholder="Audio URL or upload..."
        />
        <label className="px-2 py-1 rounded bg-stone-200 text-stone-700 text-xs cursor-pointer hover:bg-stone-300 shrink-0">
          Upload
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const url = await onUploadFile(file, `${uploadPath}_${file.name}`);
              onChange(url);
            }}
          />
        </label>
        {audioUrl && (
          <button
            type="button"
            // Clear the URL only, in a single parent update. Calling
            // onTitleChange(null) here too would batch a second state update
            // that re-reads the same stale parent snapshot and clobbers this
            // one — restoring the old URL (the "Remove does nothing" bug).
            // With no URL the title input is hidden, so the stale title is inert.
            onClick={() => onChange(null)}
            className="text-xs text-red-600 hover:underline shrink-0"
          >
            Remove
          </button>
        )}
      </div>
      {audioUrl && onTitleChange && (
        <input
          value={audioTitle || ''}
          onChange={(e) => onTitleChange(e.target.value || null)}
          className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
          placeholder="Audio title (shown to explorers)"
        />
      )}
      {audioUrl && (
        <audio controls src={audioUrl} className="w-full h-8 mt-1" style={{ maxHeight: 32 }} />
      )}
      {audioUrl && onIsVoiceoverChange && (
        <label className="flex items-center gap-2 mt-1 text-[11px] text-stone-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!isVoiceover}
            onChange={(e) => onIsVoiceoverChange(e.target.checked)}
            className="w-3.5 h-3.5 accent-emerald-600"
          />
          This audio is the voiceover (skip auto text-to-speech for this screen)
        </label>
      )}
      {audioUrl && onAutoplayDisabledChange && (
        <label className="flex items-center gap-2 mt-1 text-[11px] text-stone-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!autoplayDisabled}
            onChange={(e) => onAutoplayDisabledChange(e.target.checked)}
            className="w-3.5 h-3.5 accent-amber-500"
          />
          Don&apos;t autoplay on this screen (read first, audio fits in after)
        </label>
      )}
    </div>
  );
}
