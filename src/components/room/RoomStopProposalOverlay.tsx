'use client';

/**
 * Floating overlay shown whenever the host has proposed a new stop
 * transition and the group hasn't fully approved yet. Non-host members
 * see "I'm in" → approveStop; the host sees who they're waiting on +
 * a Cancel option.
 *
 * Resolves automatically when every member's approval is in (the room
 * sets currentStopId and clears pendingStopId; this component unmounts
 * because the gate `room.pendingStopId` goes back to null).
 */

import { useEffect, useMemo, useState } from 'react';
import { Tour } from '@/lib/types';
import { getTour, getActiveStops } from '@/lib/tours-store';
import { useRoom } from '@/context/RoomContext';

export default function RoomStopProposalOverlay() {
  const { room, mySessionId, isHost, approveStop, cancelPendingStop } = useRoom();
  const [tour, setTour] = useState<Tour | null>(null);

  // Fetch the tour to resolve the pending stop's display name. Skipped
  // when no pending proposal is active.
  useEffect(() => {
    if (!room?.pendingStopId) return;
    let cancelled = false;
    getTour(room.tourId).then((t) => { if (!cancelled) setTour(t); });
    return () => { cancelled = true; };
  }, [room?.pendingStopId, room?.tourId]);

  const pending = room?.pendingStopId ?? null;
  const targetStop = useMemo(() => {
    if (!tour || !pending) return null;
    return getActiveStops(tour).find((s) => s.id === pending) ?? null;
  }, [tour, pending]);

  if (!room || !mySessionId || !pending) return null;

  const approvals = new Set(room.pendingApprovals || []);
  const myApproved = approvals.has(mySessionId);
  const waitingFor = room.members.filter((m) => !approvals.has(m.sessionId));

  const targetTitle =
    targetStop?.mergeGroup || targetStop?.title || 'the next stop';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[55] flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-md mx-3 mb-3 rounded-2xl px-5 py-4 space-y-3 shadow-xl"
        style={{
          backgroundColor: 'var(--th-surface)',
          border: '1px solid var(--th-border)',
        }}
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-text-secondary">
            {isHost ? 'You suggested' : 'Host suggested'}
          </p>
          <p className="text-[20px] font-display font-bold leading-tight text-accent-dark">
            {targetTitle}
          </p>
        </div>

        {isHost ? (
          <>
            {waitingFor.length > 0 ? (
              <p className="text-sm text-text-secondary">
                Waiting on {joinNames(waitingFor.map((m) => m.name))} to confirm…
              </p>
            ) : (
              <p className="text-sm text-text-secondary italic">Everyone&apos;s in — moving the group now.</p>
            )}
            <button
              onClick={() => void cancelPendingStop()}
              className="w-full py-2.5 rounded-lg text-sm font-semibold"
              style={{ color: 'var(--th-primary)', border: '1px solid var(--th-primary)' }}
            >
              Cancel suggestion
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-text-primary">
              {myApproved
                ? `Waiting on ${joinNames(waitingFor.map((m) => m.name))} to confirm.`
                : 'Tap when your group is ready to walk over together.'}
            </p>
            <button
              onClick={() => void approveStop()}
              disabled={myApproved}
              className="w-full py-3 rounded-lg text-base font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--th-primary)' }}
            >
              {myApproved ? "You're ready" : "I'm in — let's go"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function joinNames(names: string[]): string {
  if (names.length === 0) return 'no one';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}
