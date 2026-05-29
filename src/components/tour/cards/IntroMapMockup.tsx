'use client';

/**
 * Stylized map-mockup card used inside the onboarding flow. Renders a
 * soft tan background with sketchy curved paths and a single tour pin
 * positioned roughly in the centre. The pin glyph mirrors the real
 * tour-entry marker (white speech-bubble "P" on a primary-coloured
 * disc) so the explorer recognises the icon when they reach the real
 * map.
 *
 * The pin button carries `data-onboard-map-pin` so SpotlightOverlay
 * can highlight it from the parent.
 */

interface Props {
  /** Click handler for the tappable pin. */
  onPinTap: () => void;
  /** When true, the "Tap to start" label fades up. */
  pinLabel?: boolean;
}

export default function IntroMapMockup({ onPinTap, pinLabel = false }: Props) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-md border-2 border-aged-gold/30" style={{ aspectRatio: '4 / 3', backgroundColor: '#E8D8C0' }}>
      {/* Sketchy stylized "map" — abstract paths so the mockup reads as
          a map without needing a real photo. Uses theme tokens so it
          themes with Red / Teal. */}
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
        {/* Subtle parcel blocks */}
        <g opacity="0.35" fill="color-mix(in srgb, var(--th-accent-dark) 22%, transparent)">
          <rect x="20" y="30" width="80" height="55" rx="6" />
          <rect x="120" y="20" width="100" height="60" rx="6" />
          <rect x="240" y="40" width="90" height="50" rx="6" />
          <rect x="30" y="120" width="110" height="60" rx="6" />
          <rect x="160" y="115" width="100" height="65" rx="6" />
          <rect x="280" y="125" width="85" height="55" rx="6" />
          <rect x="20" y="210" width="120" height="60" rx="6" />
          <rect x="160" y="220" width="90" height="55" rx="6" />
          <rect x="270" y="215" width="110" height="60" rx="6" />
        </g>

        {/* Roads / paths */}
        <g stroke="var(--th-surface)" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.85">
          <path d="M 0 100 L 400 100" />
          <path d="M 0 200 L 400 200" />
          <path d="M 110 0 L 110 300" />
          <path d="M 270 0 L 270 300" />
        </g>
        <g stroke="var(--th-accent-dark)" strokeWidth="2" fill="none" strokeDasharray="6 8" opacity="0.55">
          <path d="M 0 100 L 400 100" />
          <path d="M 0 200 L 400 200" />
          <path d="M 110 0 L 110 300" />
          <path d="M 270 0 L 270 300" />
        </g>

        {/* Tree dots */}
        <g fill="color-mix(in srgb, var(--th-accent-dark) 60%, transparent)">
          <circle cx="60" cy="55" r="6" />
          <circle cx="75" cy="65" r="4" />
          <circle cx="345" cy="65" r="6" />
          <circle cx="60" cy="245" r="6" />
          <circle cx="340" cy="245" r="6" />
        </g>
      </svg>

      {/* Pin button — anchored roughly centre. Wrapped span for the
          translate-positioning + animate-ping ring (Build_State §7
          rule: positioning transform on outer, keyframe transform on
          inner so they don't collide). */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="relative block">
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: 'var(--th-primary)', opacity: 0.35 }}
          />
          <button
            type="button"
            data-onboard-map-pin
            onClick={onPinTap}
            className="relative block w-[60px] h-[60px] rounded-full shadow-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--th-primary)', border: '3px solid var(--th-surface)' }}
            aria-label="Tap this pin"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--th-surface)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.5 8.5 0 0 1-15.4 4.9L3 21l4.6-2.6A8.5 8.5 0 1 1 21 11.5z" />
              <text x="12" y="14" textAnchor="middle" fontSize="9" fontFamily="serif" fontWeight="700" fill="var(--th-surface)" stroke="none">P</text>
            </svg>
          </button>
        </span>
      </span>

      {pinLabel && (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '12%' }}>
          <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider shadow" style={{ backgroundColor: 'var(--th-surface)', color: 'var(--th-primary)' }}>
            Tap to start
          </span>
        </div>
      )}
    </div>
  );
}
