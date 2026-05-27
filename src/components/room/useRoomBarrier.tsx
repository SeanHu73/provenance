'use client';

/**
 * Hook that turns a discussion-question card's continue button into a
 * room-coordinated barrier when the device is in a room.
 *
 * Usage in a card:
 *
 *   const barrier = useRoomBarrier(`${stopId}:wonder:${round}`, onContinue);
 *   // ...
 *   {barrier.indicator}
 *   <button onClick={barrier.onPress} disabled={barrier.disabled}>
 *     {barrier.label ?? "We've talked — show us"}
 *   </button>
 *
 * Behaviour:
 *   - On mount, arrives at the barrier (idempotent in Firestore).
 *   - Tracks arrivals + readys from room snapshots.
 *   - First press: marks self ready. Subsequent presses do nothing.
 *   - When room sets resolvedAt, calls onResolve once (the card then
 *     advances its local TourSession state).
 *
 * If the device is *not* in a room (`bypassed: true`), the hook is a
 * thin pass-through — `onPress` calls `onResolve` immediately, exactly
 * matching the existing single-player behaviour.
 */

import { useEffect, useRef } from 'react';
import type React from 'react';
import RoomBarrierIndicator from './RoomBarrierIndicator';
import { useRoom } from '@/context/RoomContext';

export interface RoomBarrierResult {
  /** True if no room is active — caller should behave exactly as
   *  before. The other fields are still safe to use but trivial. */
  bypassed: boolean;
  /** Has every member's device parked on this barrier? */
  allArrived: boolean;
  /** Has *this* device pressed Ready already? */
  myReady: boolean;
  /** True once everyone is ready and the barrier has resolved (we'll
   *  also have called `onResolve` exactly once). */
  resolved: boolean;
  /** What text the continue button should show. null = use the card's
   *  default label. */
  label: string | null;
  /** Should the continue button be disabled right now? */
  disabled: boolean;
  /** Hook the card's existing continue button to this. */
  onPress: () => void;
  /** Status pill JSX to render above the continue button. */
  indicator: React.ReactNode;
}

export function useRoomBarrier(barrierKey: string, onResolve: () => void): RoomBarrierResult {
  const { room, mySessionId, arriveAtBarrier, readyAtBarrier } = useRoom();
  const onResolveRef = useRef(onResolve);
  useEffect(() => {
    onResolveRef.current = onResolve;
  }, [onResolve]);

  const inRoom = !!(room && mySessionId && room.members.some((m) => m.sessionId === mySessionId));
  const bypassed = !inRoom;

  // Arrive on mount.
  useEffect(() => {
    if (!inRoom) return;
    void arriveAtBarrier(barrierKey);
  }, [inRoom, barrierKey, arriveAtBarrier]);

  // Fire onResolve exactly once when the barrier resolves.
  const firedRef = useRef(false);
  const resolvedAt = inRoom ? room?.barriers?.[barrierKey]?.resolvedAt ?? null : null;
  useEffect(() => {
    if (!resolvedAt) {
      firedRef.current = false;
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    onResolveRef.current();
  }, [resolvedAt]);

  if (bypassed || !room || !mySessionId) {
    return {
      bypassed: true,
      allArrived: true,
      myReady: false,
      resolved: false,
      label: null,
      disabled: false,
      onPress: () => onResolveRef.current(),
      indicator: null,
    };
  }

  const totalMembers = room.members.length;
  const state = room.barriers?.[barrierKey];
  const arrived = new Set(state?.arrivals || []);
  const readys = new Set(state?.readys || []);
  const allArrived = totalMembers > 0 && arrived.size >= totalMembers;
  const myReady = readys.has(mySessionId);
  const resolved = !!state?.resolvedAt;

  const label = resolved
    ? null
    : !allArrived
      ? 'Waiting for the group…'
      : myReady
        ? 'Waiting for others…'
        : 'Ready to continue';

  const disabled = !resolved && (!allArrived || myReady);

  const onPress = () => {
    if (resolved) {
      onResolveRef.current();
      return;
    }
    if (!allArrived || myReady) return;
    void readyAtBarrier(barrierKey);
  };

  const indicator = (
    <RoomBarrierIndicator room={room} barrierKey={barrierKey} mySessionId={mySessionId} />
  );

  return { bypassed: false, allArrived, myReady, resolved, label, disabled, onPress, indicator };
}
