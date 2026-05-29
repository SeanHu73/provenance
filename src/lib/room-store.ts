/**
 * Multi-device room coordination — writes to `memorial-church-rooms`.
 *
 * A Room ties multiple TourSessions to one shared playback so a small
 * group (2–4 people) can walk a tour together. Each device still runs
 * its own TourSession independently; the room only gates two kinds of
 * transitions:
 *
 *   1. Stop transitions — host proposes (writes `pendingStopId`); other
 *      members each add themselves to `pendingApprovals`. When every
 *      member has approved, the room atomically sets `currentStopId`
 *      and clears the pending fields. Every device watches for that
 *      and advances locally.
 *
 *   2. Discussion-question barriers — when a device parks on a
 *      `wonder` / `eq_discuss` / etc. screen it appends its sessionId
 *      to `barriers[key].arrivals`. The screen shows a "Waiting for
 *      …" overlay until every member is present. Then every member
 *      presses Ready, which appends to `readys`. When all members are
 *      ready the device that flips the last entry atomically also
 *      sets `resolvedAt`, and every device advances locally.
 *
 * Members must always wake to advance — there's no "skip offline
 * members" path. Sleeping = group waits. After 2 minutes of inactivity
 * any member can manually `kickMember` to unblock.
 *
 * Host failover: if the host's `lastSeenAt` is older than 5 minutes,
 * any member can call `claimHostIfStale`, which atomically promotes
 * the oldest remaining member if (and only if) the host is still
 * stale at the moment of the transaction.
 *
 * NOTE: Firestore security rules must include:
 *   match /memorial-church-rooms/{doc} { allow read, write: if true; }
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { BarrierState, Room, RoomMember, TourPhase } from './types';

const COLLECTION = 'memorial-church-rooms';

/** Generate a 4-character alphanumeric room code, avoiding lookalikes. */
function generateCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0, 1
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyBarrier(): BarrierState {
  return { arrivals: [], readys: [], resolvedAt: null };
}

// ─── Create / Join / Leave ───────────────────────────────────────

/**
 * Create a new room. Returns the freshly-generated code. Retries up to
 * 8 times on the rare collision; throws on persistent failure.
 */
export async function createRoom(params: {
  tourId: string;
  hostSessionId: string;
  hostName: string;
}): Promise<string> {
  const { tourId, hostSessionId, hostName } = params;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    const ref = doc(db, COLLECTION, code);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;
    const room: Room = {
      code,
      tourId,
      hostSessionId,
      members: [
        {
          sessionId: hostSessionId,
          name: hostName.trim() || 'Host',
          joinedAt: nowIso(),
          lastSeenAt: nowIso(),
        },
      ],
      started: false,
      currentStopId: null,
      completedStopIds: [],
      pendingStopId: null,
      pendingApprovals: [],
      barriers: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await setDoc(ref, room);
    return code;
  }
  throw new Error('Could not generate a unique room code');
}

/**
 * Join an existing room. Validates that the room exists and is for the
 * same tour; rejoining the same sessionId is a no-op (refreshes lastSeenAt).
 */
export async function joinRoom(params: {
  code: string;
  tourId: string;
  sessionId: string;
  name: string;
}): Promise<{ ok: true; room: Room } | { ok: false; reason: string }> {
  const { code, tourId, sessionId, name } = params;
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    const updated = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new Error('not_found');
      }
      const room = snap.data() as Room;
      if (room.tourId !== tourId) {
        throw new Error('different_tour');
      }
      const idx = room.members.findIndex((m) => m.sessionId === sessionId);
      if (idx >= 0) {
        // Rejoining same session — just refresh lastSeenAt.
        const next = [...room.members];
        next[idx] = { ...next[idx], lastSeenAt: nowIso() };
        tx.update(ref, { members: next, updatedAt: nowIso() });
        return { ...room, members: next };
      }
      const newMember: RoomMember = {
        sessionId,
        name: name.trim() || `Explorer ${room.members.length + 1}`,
        joinedAt: nowIso(),
        lastSeenAt: nowIso(),
      };
      const nextMembers = [...room.members, newMember];
      tx.update(ref, { members: nextMembers, updatedAt: nowIso() });
      return { ...room, members: nextMembers };
    });
    return { ok: true, room: updated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'not_found') return { ok: false, reason: 'Room not found.' };
    if (msg === 'different_tour') return { ok: false, reason: 'That room is for a different tour.' };
    console.error('[room-store] joinRoom failed:', err);
    return { ok: false, reason: 'Could not join the room. Try again.' };
  }
}

/** Remove the device from the room. If they were host, promote the
 *  oldest remaining member. If the room becomes empty, delete it. */
export async function leaveRoom(code: string, sessionId: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      const remaining = room.members.filter((m) => m.sessionId !== sessionId);
      if (remaining.length === 0) {
        // Last person out — clean up the doc.
        tx.delete(ref);
        return;
      }
      const newHost =
        room.hostSessionId === sessionId
          ? remaining.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0].sessionId
          : room.hostSessionId;
      // Strip this sessionId from approvals + every barrier's arrivals/readys
      // so a leaver doesn't block the group forever.
      const cleanedBarriers: Record<string, BarrierState> = {};
      for (const [key, state] of Object.entries(room.barriers || {})) {
        cleanedBarriers[key] = {
          arrivals: state.arrivals.filter((s) => s !== sessionId),
          readys: state.readys.filter((s) => s !== sessionId),
          resolvedAt: state.resolvedAt,
        };
      }
      tx.update(ref, {
        members: remaining,
        hostSessionId: newHost,
        pendingApprovals: (room.pendingApprovals || []).filter((s) => s !== sessionId),
        barriers: cleanedBarriers,
        updatedAt: nowIso(),
      });
    });
  } catch (err) {
    console.error('[room-store] leaveRoom failed:', err);
  }
}

/** Manually remove another member (e.g. after 2 minutes of inactivity). */
export async function kickMember(code: string, kickSessionId: string): Promise<void> {
  // leaveRoom does exactly the right cleanup; reuse it.
  await leaveRoom(code, kickSessionId);
}

// ─── Subscription ────────────────────────────────────────────────

export function subscribeToRoom(
  code: string,
  cb: (room: Room | null) => void,
): Unsubscribe {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  return onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? (snap.data() as Room) : null),
    (err) => {
      console.error('[room-store] subscribe failed:', err);
      cb(null);
    },
  );
}

/** One-off read. */
export async function fetchRoom(code: string): Promise<Room | null> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Room) : null;
}

// ─── Heartbeat + host failover ───────────────────────────────────

export async function heartbeat(code: string, sessionId: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      const idx = room.members.findIndex((m) => m.sessionId === sessionId);
      if (idx < 0) return;
      const next = [...room.members];
      next[idx] = { ...next[idx], lastSeenAt: nowIso() };
      tx.update(ref, { members: next });
    });
  } catch (err) {
    // Heartbeats are best-effort; tolerate a transient failure.
    console.warn('[room-store] heartbeat failed:', err);
  }
}

const HOST_STALE_MS = 5 * 60 * 1000;

/**
 * Promote the oldest remaining member to host if the current host has
 * been silent for more than 5 minutes. Atomic so two members can't
 * race-promote each other. No-op if the host is still fresh.
 */
export async function claimHostIfStale(code: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      const host = room.members.find((m) => m.sessionId === room.hostSessionId);
      if (!host) {
        // Host record is gone but the hostSessionId pointer wasn't
        // cleaned up — promote whoever's left and oldest.
        const oldest = [...room.members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
        if (oldest) {
          tx.update(ref, { hostSessionId: oldest.sessionId, updatedAt: nowIso() });
        }
        return;
      }
      const stale = Date.now() - new Date(host.lastSeenAt).getTime() > HOST_STALE_MS;
      if (!stale) return;
      const candidates = room.members.filter((m) => m.sessionId !== host.sessionId);
      if (candidates.length === 0) return;
      const oldest = [...candidates].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
      tx.update(ref, { hostSessionId: oldest.sessionId, updatedAt: nowIso() });
    });
  } catch (err) {
    console.error('[room-store] claimHostIfStale failed:', err);
  }
}

// ─── Lobby ───────────────────────────────────────────────────────

export async function startTour(code: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  await updateDoc(ref, { started: true, updatedAt: nowIso() });
}

// ─── Stop transitions ────────────────────────────────────────────

/** Host proposes a transition to a stop. Requires the caller to be host. */
export async function proposeStop(code: string, stopId: string, hostSessionId: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      if (room.hostSessionId !== hostSessionId) return;
      // Host's approval is implicit (they're the one proposing).
      tx.update(ref, {
        pendingStopId: stopId,
        pendingApprovals: [hostSessionId],
        updatedAt: nowIso(),
      });
    });
  } catch (err) {
    console.error('[room-store] proposeStop failed:', err);
  }
}

/** Member approves the pending stop transition. When everyone has
 *  approved, this same call atomically commits the transition. */
export async function approveStop(code: string, sessionId: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      if (!room.pendingStopId) return;
      const approvals = new Set(room.pendingApprovals || []);
      approvals.add(sessionId);
      if (approvals.size >= room.members.length) {
        // Everyone is in — commit the transition.
        const targetStopId = room.pendingStopId;
        const prev = room.currentStopId;
        const completed = new Set(room.completedStopIds || []);
        if (prev && prev !== targetStopId) completed.add(prev);
        tx.update(ref, {
          currentStopId: targetStopId,
          completedStopIds: Array.from(completed),
          pendingStopId: null,
          pendingApprovals: [],
          // Stop-scoped barriers no longer apply once we move.
          barriers: {},
          updatedAt: nowIso(),
        });
      } else {
        tx.update(ref, {
          pendingApprovals: Array.from(approvals),
          updatedAt: nowIso(),
        });
      }
    });
  } catch (err) {
    console.error('[room-store] approveStop failed:', err);
  }
}

/** Host changes their mind before all approvals are in. */
export async function cancelPendingStop(code: string, hostSessionId: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      if (room.hostSessionId !== hostSessionId) return;
      tx.update(ref, { pendingStopId: null, pendingApprovals: [], updatedAt: nowIso() });
    });
  } catch (err) {
    console.error('[room-store] cancelPendingStop failed:', err);
  }
}

/** Host completed the active stop. Records the result of running the
 *  local advance state machine: which stops are now done, in what
 *  visit order, and what outer phase the group lands on (map, midway,
 *  closing). Members read this to align their local sessions.
 *
 *  currentStopId is always cleared here — when the host wants to enter
 *  the next stop they go through proposeStop / approveStop. */
export async function recordHostAdvance(
  code: string,
  hostSessionId: string,
  next: {
    completedStopIds: string[];
    completionOrder: string[];
    groupPhase: TourPhase;
  },
): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      if (room.hostSessionId !== hostSessionId) return;
      // NOTE: we intentionally do NOT clear `barriers` here. The host's
      // local persist (which fires immediately after this call is
      // queued) re-renders into the new phase and mounts the next
      // barrier card, which fires its own arriveAtBarrier. If we
      // overwrite barriers in this transaction we can wipe the host's
      // arrival before the room knows about it, leaving both devices
      // each reading only their own arrival (the "waiting for X to
      // arrive" stall on midway). Old barriers from previous stops use
      // unique keys and don't interfere.
      tx.update(ref, {
        currentStopId: null,
        completedStopIds: next.completedStopIds,
        completionOrder: next.completionOrder,
        groupPhase: next.groupPhase,
        pendingStopId: null,
        pendingApprovals: [],
        updatedAt: nowIso(),
      });
    });
  } catch (err) {
    console.error('[room-store] recordHostAdvance failed:', err);
  }
}

/** Host moved past the "outer" phase (e.g. completed midway → goes
 *  back to the map). Updates groupPhase only. */
export async function setGroupPhase(code: string, hostSessionId: string, phase: TourPhase): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      if (room.hostSessionId !== hostSessionId) return;
      tx.update(ref, { groupPhase: phase, updatedAt: nowIso() });
    });
  } catch (err) {
    console.error('[room-store] setGroupPhase failed:', err);
  }
}

/** Mark the current stop as completed without proposing a new one
 *  (used when the group finishes the final stop and the closing flow
 *  takes over per-device). */
export async function markCurrentStopCompleted(code: string, hostSessionId: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      if (room.hostSessionId !== hostSessionId) return;
      if (!room.currentStopId) return;
      const completed = new Set(room.completedStopIds || []);
      completed.add(room.currentStopId);
      tx.update(ref, {
        completedStopIds: Array.from(completed),
        currentStopId: null,
        updatedAt: nowIso(),
      });
    });
  } catch (err) {
    console.error('[room-store] markCurrentStopCompleted failed:', err);
  }
}

// ─── Discussion barriers ─────────────────────────────────────────

/** Add the member to a barrier's arrivals list. Idempotent. */
export async function arriveAtBarrier(code: string, key: string, sessionId: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      const state = room.barriers?.[key] || emptyBarrier();
      if (state.arrivals.includes(sessionId)) return;
      const next = {
        ...state,
        arrivals: [...state.arrivals, sessionId],
      };
      tx.update(ref, {
        barriers: { ...(room.barriers || {}), [key]: next },
        updatedAt: nowIso(),
      });
    });
  } catch (err) {
    console.error('[room-store] arriveAtBarrier failed:', err);
  }
}

/** Write this member's opinion-dial position (0..1) for the given
 *  question key. Idempotent — overwrites the previous value if any. */
export async function setOpinionDialPosition(
  code: string,
  key: string,
  sessionId: string,
  position: number,
): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  const clamped = Math.max(0, Math.min(1, position));
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      const state = room.opinionDials?.[key] || { positions: {}, revealedBy: [] };
      // Once a member has revealed they can't move their dot — write
      // is ignored.
      if (state.revealedBy.includes(sessionId)) return;
      const next = {
        ...state,
        positions: { ...state.positions, [sessionId]: clamped },
      };
      tx.update(ref, {
        opinionDials: { ...(room.opinionDials || {}), [key]: next },
        updatedAt: nowIso(),
      });
    });
  } catch (err) {
    console.error('[room-store] setOpinionDialPosition failed:', err);
  }
}

/** Picker locks in the chosen question for a user-choice wonder. First
 *  write wins (idempotent) so two members racing to choose can't
 *  overwrite each other. */
export async function selectUserChoiceQuestion(
  code: string,
  key: string,
  sessionId: string,
  question: string,
  isCustom: boolean,
): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      const existing = room.userChoiceSelections?.[key];
      if (existing) return; // first write wins
      const next = { chosenBy: sessionId, question, isCustom };
      tx.update(ref, {
        userChoiceSelections: { ...(room.userChoiceSelections || {}), [key]: next },
        updatedAt: nowIso(),
      });
    });
  } catch (err) {
    console.error('[room-store] selectUserChoiceQuestion failed:', err);
  }
}

/** Mark this member as having tapped "Find out where your friend is".
 *  Once every member with a position is in revealedBy, the dial flips
 *  to its reveal state and each device renders the others' dots. */
export async function revealOpinionDial(code: string, key: string, sessionId: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      const state = room.opinionDials?.[key] || { positions: {}, revealedBy: [] };
      if (state.revealedBy.includes(sessionId)) return;
      // Only reveal if this member has picked a position.
      if (state.positions[sessionId] === undefined) return;
      const next = {
        ...state,
        revealedBy: [...state.revealedBy, sessionId],
      };
      tx.update(ref, {
        opinionDials: { ...(room.opinionDials || {}), [key]: next },
        updatedAt: nowIso(),
      });
    });
  } catch (err) {
    console.error('[room-store] revealOpinionDial failed:', err);
  }
}

/** Add the member to a barrier's readys list. When everyone is ready,
 *  the resolvedAt timestamp is set atomically. */
export async function readyAtBarrier(code: string, key: string, sessionId: string): Promise<void> {
  const ref = doc(db, COLLECTION, code.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as Room;
      const state = room.barriers?.[key] || emptyBarrier();
      if (state.readys.includes(sessionId)) return;
      const readys = [...state.readys, sessionId];
      // Always include arriver (idempotent).
      const arrivals = state.arrivals.includes(sessionId)
        ? state.arrivals
        : [...state.arrivals, sessionId];
      const everyoneReady = readys.length >= room.members.length;
      const next: BarrierState = {
        arrivals,
        readys,
        resolvedAt: everyoneReady ? nowIso() : null,
      };
      tx.update(ref, {
        barriers: { ...(room.barriers || {}), [key]: next },
        updatedAt: nowIso(),
      });
    });
  } catch (err) {
    console.error('[room-store] readyAtBarrier failed:', err);
  }
}
