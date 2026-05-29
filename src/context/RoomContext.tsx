'use client';

/**
 * Room state + actions for multi-device group tours.
 *
 * Stores the current room code in sessionStorage (key: provenance-room-code)
 * so a reload re-subscribes automatically. Heartbeats every 30 seconds
 * while the tab is visible; pauses while hidden (Page Visibility API),
 * and resumes when the tab returns — the Firestore onSnapshot listener
 * itself handles reconnection transparently.
 *
 * Also runs a 30-second watchdog: if the room's host has been silent
 * for >5 minutes, any member's instance calls claimHostIfStale which
 * runs an atomic transaction promoting the oldest remaining member.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Room, TourPhase } from '@/lib/types';
import {
  approveStop as approveStopImpl,
  arriveAtBarrier as arriveAtBarrierImpl,
  cancelPendingStop as cancelPendingStopImpl,
  claimHostIfStale,
  createRoom as createRoomImpl,
  fetchRoom,
  heartbeat as heartbeatImpl,
  joinRoom as joinRoomImpl,
  kickMember as kickMemberImpl,
  leaveRoom as leaveRoomImpl,
  markCurrentStopCompleted as markCurrentStopCompletedImpl,
  proposeStop as proposeStopImpl,
  readyAtBarrier as readyAtBarrierImpl,
  recordHostAdvance as recordHostAdvanceImpl,
  revealOpinionDial as revealOpinionDialImpl,
  setGroupPhase as setGroupPhaseImpl,
  setOpinionDialPosition as setOpinionDialPositionImpl,
  startTour as startTourImpl,
  subscribeToRoom,
} from '@/lib/room-store';

const STORAGE_KEY = 'provenance-room-code';
const HEARTBEAT_MS = 30 * 1000;
const HOST_WATCHDOG_MS = 30 * 1000;

export type JoinResult =
  | { ok: true; room: Room }
  | { ok: false; reason: string };

interface RoomContextValue {
  room: Room | null;
  /** sessionId of *this* device, mirrored from TourSession; null before
   *  a TourSession exists. */
  mySessionId: string | null;
  setMySessionId: (id: string | null) => void;
  /** Convenience flags derived from room + mySessionId. */
  isHost: boolean;
  isInRoom: boolean;
  // Lobby actions
  createRoom: (params: { tourId: string; hostName: string; hostSessionId: string }) => Promise<string>;
  joinRoom: (params: { code: string; tourId: string; sessionId: string; name: string }) => Promise<JoinResult>;
  leaveRoom: () => Promise<void>;
  startTour: () => Promise<void>;
  // Membership management
  kickMember: (sessionId: string) => Promise<void>;
  // Stop transitions
  proposeStop: (stopId: string) => Promise<void>;
  approveStop: () => Promise<void>;
  cancelPendingStop: () => Promise<void>;
  markCurrentStopCompleted: () => Promise<void>;
  /** Host-only: publish the result of running advanceToNextStopUnstructured
   *  locally so every member's device aligns to the same outer state. */
  recordHostAdvance: (next: { completedStopIds: string[]; completionOrder: string[]; groupPhase: TourPhase }) => Promise<void>;
  /** Host-only: bump the room's outer phase (used when midway / closing
   *  transitions are driven by the host's local state machine). */
  setGroupPhase: (phase: TourPhase) => Promise<void>;
  // Discussion barriers
  arriveAtBarrier: (key: string) => Promise<void>;
  readyAtBarrier: (key: string) => Promise<void>;
  // Opinion-dial gamification
  setOpinionDialPosition: (key: string, position: number) => Promise<void>;
  revealOpinionDial: (key: string) => Promise<void>;
}

const RoomCtx = createContext<RoomContextValue | null>(null);

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomCtx);
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider');
  return ctx;
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(STORAGE_KEY);
  });

  // Persist roomCode to sessionStorage so a reload re-subscribes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (roomCode) window.sessionStorage.setItem(STORAGE_KEY, roomCode);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  }, [roomCode]);

  // Subscribe to room when roomCode is set.
  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      return;
    }
    const unsub = subscribeToRoom(roomCode, (next) => {
      setRoom(next);
      // The room might have been deleted (last member left) — clear our
      // local code so we don't keep listening to a dead doc.
      if (!next) setRoomCode(null);
    });
    return () => unsub();
  }, [roomCode]);

  // If we have a code but no room data, try a one-off fetch as a
  // belt-and-suspenders against transient subscription delays.
  useEffect(() => {
    if (!roomCode || room) return;
    fetchRoom(roomCode).then((r) => {
      if (r) setRoom(r);
    });
  }, [roomCode, room]);

  // Heartbeat — only while the tab is visible.
  useEffect(() => {
    if (!roomCode || !mySessionId) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      void heartbeatImpl(roomCode, mySessionId);
    };
    const start = () => {
      if (interval) return;
      tick();
      interval = setInterval(tick, HEARTBEAT_MS);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
      }
    };
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      start();
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    return () => {
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [roomCode, mySessionId]);

  // Host-failover watchdog. Each member checks every 30s; if the host
  // has been silent for >5min, calls claimHostIfStale (idempotent +
  // transactional, so two members can't race).
  useEffect(() => {
    if (!roomCode || !room) return;
    const interval = setInterval(() => {
      void claimHostIfStale(roomCode);
    }, HOST_WATCHDOG_MS);
    return () => clearInterval(interval);
  }, [roomCode, room]);

  // ── Actions ──────────────────────────────────────────────────────

  const createRoom = useCallback(
    async (params: { tourId: string; hostName: string; hostSessionId: string }) => {
      const code = await createRoomImpl({
        tourId: params.tourId,
        hostSessionId: params.hostSessionId,
        hostName: params.hostName,
      });
      setRoomCode(code);
      setMySessionId(params.hostSessionId);
      return code;
    },
    [],
  );

  const joinRoom = useCallback(
    async (params: { code: string; tourId: string; sessionId: string; name: string }): Promise<JoinResult> => {
      const result = await joinRoomImpl(params);
      if (result.ok) {
        setRoomCode(params.code.toUpperCase());
        setMySessionId(params.sessionId);
      }
      return result;
    },
    [],
  );

  const leaveRoomFn = useCallback(async () => {
    if (!roomCode || !mySessionId) return;
    await leaveRoomImpl(roomCode, mySessionId);
    setRoomCode(null);
  }, [roomCode, mySessionId]);

  const startTour = useCallback(async () => {
    if (!roomCode) return;
    await startTourImpl(roomCode);
  }, [roomCode]);

  const kickMember = useCallback(
    async (sessionId: string) => {
      if (!roomCode) return;
      await kickMemberImpl(roomCode, sessionId);
    },
    [roomCode],
  );

  const proposeStop = useCallback(
    async (stopId: string) => {
      if (!roomCode || !mySessionId) return;
      await proposeStopImpl(roomCode, stopId, mySessionId);
    },
    [roomCode, mySessionId],
  );

  const approveStop = useCallback(async () => {
    if (!roomCode || !mySessionId) return;
    await approveStopImpl(roomCode, mySessionId);
  }, [roomCode, mySessionId]);

  const cancelPendingStop = useCallback(async () => {
    if (!roomCode || !mySessionId) return;
    await cancelPendingStopImpl(roomCode, mySessionId);
  }, [roomCode, mySessionId]);

  const markCurrentStopCompleted = useCallback(async () => {
    if (!roomCode || !mySessionId) return;
    await markCurrentStopCompletedImpl(roomCode, mySessionId);
  }, [roomCode, mySessionId]);

  const recordHostAdvance = useCallback(
    async (next: { completedStopIds: string[]; completionOrder: string[]; groupPhase: TourPhase }) => {
      if (!roomCode || !mySessionId) return;
      await recordHostAdvanceImpl(roomCode, mySessionId, next);
    },
    [roomCode, mySessionId],
  );

  const setGroupPhase = useCallback(
    async (phase: TourPhase) => {
      if (!roomCode || !mySessionId) return;
      await setGroupPhaseImpl(roomCode, mySessionId, phase);
    },
    [roomCode, mySessionId],
  );

  const arriveAtBarrier = useCallback(
    async (key: string) => {
      if (!roomCode || !mySessionId) return;
      await arriveAtBarrierImpl(roomCode, key, mySessionId);
    },
    [roomCode, mySessionId],
  );

  const readyAtBarrier = useCallback(
    async (key: string) => {
      if (!roomCode || !mySessionId) return;
      await readyAtBarrierImpl(roomCode, key, mySessionId);
    },
    [roomCode, mySessionId],
  );

  const setOpinionDialPosition = useCallback(
    async (key: string, position: number) => {
      if (!roomCode || !mySessionId) return;
      await setOpinionDialPositionImpl(roomCode, key, mySessionId, position);
    },
    [roomCode, mySessionId],
  );

  const revealOpinionDial = useCallback(
    async (key: string) => {
      if (!roomCode || !mySessionId) return;
      await revealOpinionDialImpl(roomCode, key, mySessionId);
    },
    [roomCode, mySessionId],
  );

  const value = useMemo<RoomContextValue>(() => {
    const isHost = !!(room && mySessionId && room.hostSessionId === mySessionId);
    const isInRoom = !!(room && mySessionId && room.members.some((m) => m.sessionId === mySessionId));
    return {
      room,
      mySessionId,
      setMySessionId,
      isHost,
      isInRoom,
      createRoom,
      joinRoom,
      leaveRoom: leaveRoomFn,
      startTour,
      kickMember,
      proposeStop,
      approveStop,
      cancelPendingStop,
      markCurrentStopCompleted,
      recordHostAdvance,
      setGroupPhase,
      arriveAtBarrier,
      readyAtBarrier,
      setOpinionDialPosition,
      revealOpinionDial,
    };
  }, [
    room,
    mySessionId,
    createRoom,
    joinRoom,
    leaveRoomFn,
    startTour,
    kickMember,
    proposeStop,
    approveStop,
    cancelPendingStop,
    markCurrentStopCompleted,
    recordHostAdvance,
    setGroupPhase,
    arriveAtBarrier,
    readyAtBarrier,
    setOpinionDialPosition,
    revealOpinionDial,
  ]);

  return <RoomCtx.Provider value={value}>{children}</RoomCtx.Provider>;
}

/** Status tier for a member, derived from heartbeat staleness. */
export function memberStatus(member: { lastSeenAt: string }): 'online' | 'idle' | 'stale' {
  const ageMs = Date.now() - new Date(member.lastSeenAt).getTime();
  if (ageMs < 60 * 1000) return 'online';
  if (ageMs < 15 * 60 * 1000) return 'idle';
  return 'stale';
}

/** Can this member be kicked? — true if idle for ≥ 2 minutes. */
export function canKick(member: { lastSeenAt: string }): boolean {
  const ageMs = Date.now() - new Date(member.lastSeenAt).getTime();
  return ageMs >= 2 * 60 * 1000;
}
