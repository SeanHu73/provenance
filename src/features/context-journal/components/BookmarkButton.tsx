'use client';

/** A small save/bookmark toggle. Filled when saved. */
export default function BookmarkButton({ saved, onToggle, colour }: {
  saved: boolean; onToggle: () => void; colour: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-pressed={saved}
      aria-label={saved ? 'Remove bookmark' : 'Save context'}
      className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        fill={saved ? colour : 'none'} stroke={saved ? colour : 'currentColor'} className={saved ? '' : 'text-text-secondary'}>
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
    </button>
  );
}
