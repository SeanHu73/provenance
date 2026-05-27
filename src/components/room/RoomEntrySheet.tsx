'use client';

/**
 * Bottom sheet for "Host a group" / "Join a group" — collects the user's
 * name (and a room code if joining), then creates or joins.
 *
 * Mounted from the JournalPeek; once the room is established the
 * RoomLobby takes over (top-level overlay).
 */

import { useState } from 'react';
import { Tour, TourSession } from '@/lib/types';
import { useRoom } from '@/context/RoomContext';

interface Props {
  tour: Tour;
  /** A freshly created TourSession id is used as this device's room
   *  identity. RoomEntrySheet does not call startTour — RoomProvider
   *  + TourContext wire the session id once the room is in place. */
  newSessionId: string;
  mode: 'host' | 'join';
  /** If the user already started a TourSession before joining (rare),
   *  we use its id rather than the fresh one to avoid orphaning state. */
  existingSession?: TourSession | null;
  onDismiss: () => void;
}

export default function RoomEntrySheet({ tour, newSessionId, mode, onDismiss }: Props) {
  const { createRoom, joinRoom } = useRoom();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isHostMode = mode === 'host';
  const canSubmit = name.trim().length > 0 && (isHostMode || code.trim().length === 4);

  const handleSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isHostMode) {
        await createRoom({ tourId: tour.id, hostName: name.trim(), hostSessionId: newSessionId });
        // RoomLobby will mount automatically (room state goes non-null
        // and started === false).
        onDismiss();
      } else {
        const result = await joinRoom({
          code: code.trim().toUpperCase(),
          tourId: tour.id,
          sessionId: newSessionId,
          name: name.trim(),
        });
        if (!result.ok) {
          setError(result.reason);
        } else {
          onDismiss();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />

      <div
        className="relative animate-slide-up rounded-t-2xl px-6 pt-5 pb-6 space-y-4"
        style={{ backgroundColor: 'var(--th-surface)' }}
      >
        <div className="flex justify-center">
          <span className="block w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--th-border)' }} />
        </div>

        <p className="text-[22px] font-display font-bold text-accent-dark">
          {isHostMode ? 'Host a group' : 'Join a group'}
        </p>
        <p className="text-sm text-text-secondary leading-relaxed">
          {isHostMode
            ? 'Start a room and share the 4-letter code with up to three friends. Everyone walks the tour together.'
            : 'Enter the 4-letter code your group is using. You\'ll join their tour and walk it together.'}
        </p>

        {!isHostMode && (
          <label className="block space-y-1.5">
            <span className="text-xs text-text-secondary font-semibold uppercase tracking-wide">Room code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
              placeholder="e.g. 7K42"
              maxLength={4}
              className="w-full px-4 py-3 rounded-lg text-[28px] font-display font-bold tracking-[0.2em] text-center"
              style={{
                backgroundColor: 'var(--th-bg)',
                color: 'var(--th-primary)',
                border: '1px solid var(--th-border)',
              }}
              autoCapitalize="characters"
              autoCorrect="off"
            />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs text-text-secondary font-semibold uppercase tracking-wide">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call you?"
            maxLength={24}
            className="w-full px-4 py-3 rounded-lg text-base font-serif text-text-primary"
            style={{
              backgroundColor: 'var(--th-bg)',
              border: '1px solid var(--th-border)',
            }}
          />
        </label>

        {error && (
          <p className="text-sm" style={{ color: 'var(--th-primary)' }}>{error}</p>
        )}

        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || busy}
          className="w-full py-3 rounded-lg text-base font-semibold text-warm-white disabled:opacity-40"
          style={{ backgroundColor: 'var(--th-primary)' }}
        >
          {busy
            ? (isHostMode ? 'Creating room…' : 'Joining…')
            : (isHostMode ? 'Create room' : 'Join room')}
        </button>
        <button
          onClick={onDismiss}
          className="w-full py-2 text-sm text-text-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
