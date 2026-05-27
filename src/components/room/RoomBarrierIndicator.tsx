'use client';

/**
 * "Waiting for K to arrive…" / "Waiting for K to be ready" overlay
 * shown on discussion-question cards while the group is barriered.
 *
 * Drives both visual feedback and the action UI:
 *   - While not everyone has arrived → small status pill above continue
 *   - Once everyone has arrived → continue button shows "Ready to
 *     continue"; pressing it calls onReady. Waits for the rest of the
 *     group to also press ready; the surrounding card's onContinue is
 *     called externally when room.barriers[key].resolvedAt fires.
 *
 * The hook useRoomBarrier owns the room-side wiring. This component
 * is just the visible status surface.
 */

import { Room } from '@/lib/types';

interface Props {
  room: Room;
  barrierKey: string;
  mySessionId: string;
}

export default function RoomBarrierIndicator({ room, barrierKey, mySessionId }: Props) {
  const state = room.barriers?.[barrierKey] || { arrivals: [], readys: [], resolvedAt: null };
  const totalMembers = room.members.length;
  const arrivedSet = new Set(state.arrivals);
  const readySet = new Set(state.readys);

  const allArrived = totalMembers > 0 && arrivedSet.size >= totalMembers;
  const myReady = readySet.has(mySessionId);

  // Names of members we're waiting on.
  const waitingFor = (() => {
    const targetSet = !allArrived ? arrivedSet : readySet;
    return room.members
      .filter((m) => !targetSet.has(m.sessionId))
      .map((m) => m.name);
  })();

  if (state.resolvedAt) return null;
  if (totalMembers <= 1) return null;

  let message: string;
  if (!allArrived) {
    message = waitingFor.length
      ? `Waiting for ${joinNames(waitingFor)} to arrive…`
      : 'Everyone is here.';
  } else if (myReady) {
    message = waitingFor.length
      ? `Waiting for ${joinNames(waitingFor)} to be ready…`
      : 'Ready when everyone is.';
  } else {
    message = 'Everyone is here. Press "Ready to continue" when you\'re done discussing.';
  }

  return (
    <div
      className="px-4 py-2.5 rounded-lg text-sm text-text-primary"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--th-primary) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--th-primary) 25%, transparent)',
      }}
    >
      {message}
    </div>
  );
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}
