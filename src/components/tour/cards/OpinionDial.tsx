'use client';

/**
 * Semicircular opinion dial for group ("room") tours.
 *
 * Three states tracked via the room doc under `opinionDials[key]`:
 *   1. PICKING — drag a handle along a 180° arc between two admin-
 *      authored spectrum labels. "Find out where your friend is" is
 *      disabled until a position is set.
 *   2. WAITING — this member has tapped reveal but other members
 *      haven't yet. Their own dot is visible; others are hidden.
 *   3. REVEALED — every member with a position has revealed. Each
 *      other member's dot is drawn in a contrasting colour, plus a
 *      "Quite similar!" / "Wow, quite different. Why's that?" message
 *      based on average distance from the user's dot. A Continue
 *      button appears alongside the parent-supplied back button.
 *
 * The component is purely presentational — it writes through
 * RoomContext.setOpinionDialPosition / revealOpinionDial.
 */

import { useMemo, useRef, useState } from 'react';
import { useRoom } from '@/context/RoomContext';
import BackButton from './BackButton';

interface Props {
  /** Stable key matching room barriers: `${stopId|'eq'}:${phase}:${round}`. */
  questionKey: string;
  leftLabel: string;
  rightLabel: string;
  /** Fired when this member taps Continue after the reveal phase. */
  onContinue: () => void;
  /** Continue-button label override (defaults to "Continue"). */
  continueLabel?: string;
}

const SIMILAR_THRESHOLD = 0.25;

export default function OpinionDial({
  questionKey,
  leftLabel,
  rightLabel,
  onContinue,
  continueLabel = 'Continue',
}: Props) {
  const { room, mySessionId, setOpinionDialPosition, revealOpinionDial } = useRoom();
  const state = room?.opinionDials?.[questionKey];

  // Local drag draft — committed to firestore on pointerup so we don't
  // hammer the doc.
  const [drag, setDrag] = useState<number | null>(null);
  const myStored = mySessionId ? state?.positions?.[mySessionId] ?? null : null;
  const myPosition = drag ?? myStored;
  const hasPicked = myPosition !== null;
  const hasRevealed = !!(mySessionId && state?.revealedBy?.includes(mySessionId));

  const allRevealed = useMemo(() => {
    if (!room) return false;
    const ids = room.members.map((m) => m.sessionId);
    const positions = state?.positions || {};
    const revealedBy = state?.revealedBy || [];
    if (ids.length < 2) return false;
    return ids.every((id) => positions[id] !== undefined && revealedBy.includes(id));
  }, [room, state]);

  const otherDots = useMemo(() => {
    if (!allRevealed || !state || !room) return [];
    return room.members
      .filter((m) => m.sessionId !== mySessionId)
      .map((m) => state.positions?.[m.sessionId])
      .filter((p): p is number => typeof p === 'number');
  }, [allRevealed, state, room, mySessionId]);

  // Distance-based message
  const message = useMemo(() => {
    if (!allRevealed || myPosition === null || otherDots.length === 0) return null;
    const avg = otherDots.reduce((s, p) => s + Math.abs(p - myPosition), 0) / otherDots.length;
    return avg < SIMILAR_THRESHOLD ? 'Quite similar!' : "Wow, quite different. Why's that?";
  }, [allRevealed, myPosition, otherDots]);

  return (
    <div className="space-y-3">
      <p className="text-[16px] italic leading-relaxed text-text-secondary">
        Between these two options, where would you land on a sliding scale?
      </p>

      <DialSurface
        leftLabel={leftLabel}
        rightLabel={rightLabel}
        myPosition={myPosition}
        otherDots={otherDots}
        interactive={!hasRevealed}
        onDrag={(t) => setDrag(t)}
        onCommit={(t) => {
          setDrag(null);
          void setOpinionDialPosition(questionKey, t);
        }}
      />

      {!hasRevealed && (
        <div className="flex gap-2">
          <BackButton />
          <button
            onClick={() => void revealOpinionDial(questionKey)}
            disabled={!hasPicked}
            className="flex-1 py-3 rounded-lg text-base font-semibold text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--th-primary)' }}
          >
            Find out where your friend is
          </button>
        </div>
      )}

      {hasRevealed && !allRevealed && (
        <p className="text-center text-sm text-text-secondary py-2">
          Waiting for the group to reveal…
        </p>
      )}

      {allRevealed && (
        <>
          {message && (
            <p
              className="text-center text-[22px] font-display font-semibold leading-snug px-3"
              style={{ color: 'var(--th-accent-dark)' }}
            >
              {message}
            </p>
          )}
          <div className="flex gap-2">
            <BackButton />
            <button
              onClick={onContinue}
              className="flex-1 py-3 rounded-lg text-base font-semibold text-white"
              style={{ backgroundColor: 'var(--th-primary)' }}
            >
              {continueLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Dial drawing + drag ─────────────────────────────────────── */

interface DialSurfaceProps {
  leftLabel: string;
  rightLabel: string;
  myPosition: number | null;
  otherDots: number[];
  interactive: boolean;
  onDrag: (t: number) => void;
  onCommit: (t: number) => void;
}

const ARC_RADIUS = 130;
const ARC_PAD = 24;
const SVG_WIDTH = ARC_RADIUS * 2 + ARC_PAD * 2;
const SVG_HEIGHT = ARC_RADIUS + ARC_PAD * 2;
const CENTER_X = SVG_WIDTH / 2;
const CENTER_Y = ARC_RADIUS + ARC_PAD;

function tToPoint(t: number) {
  // t = 0 → left end (theta = π), t = 1 → right end (theta = 0).
  const theta = Math.PI * (1 - t);
  return {
    x: CENTER_X + ARC_RADIUS * Math.cos(theta),
    y: CENTER_Y - ARC_RADIUS * Math.sin(theta),
  };
}

function DialSurface({
  leftLabel,
  rightLabel,
  myPosition,
  otherDots,
  interactive,
  onDrag,
  onCommit,
}: DialSurfaceProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);

  const handlePointerEvent = (clientX: number, clientY: number, commit: boolean) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xRatio = SVG_WIDTH / rect.width;
    const yRatio = SVG_HEIGHT / rect.height;
    const svgX = (clientX - rect.left) * xRatio;
    const svgY = (clientY - rect.top) * yRatio;
    const dx = svgX - CENTER_X;
    const dy = CENTER_Y - svgY;
    let theta = Math.atan2(dy, dx);
    theta = Math.max(0, Math.min(Math.PI, theta));
    const t = 1 - theta / Math.PI;
    const clamped = Math.max(0, Math.min(1, t));
    if (commit) onCommit(clamped);
    else onDrag(clamped);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    e.preventDefault();
    draggingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    handlePointerEvent(e.clientX, e.clientY, false);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive || !draggingRef.current) return;
    handlePointerEvent(e.clientX, e.clientY, false);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!interactive || !draggingRef.current) return;
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    handlePointerEvent(e.clientX, e.clientY, true);
  };

  const leftEnd = tToPoint(0);
  const rightEnd = tToPoint(1);
  const arcPath = `M ${leftEnd.x} ${leftEnd.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${rightEnd.x} ${rightEnd.y}`;
  const myPoint = myPosition !== null ? tToPoint(myPosition) : null;

  return (
    <div className="select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-auto touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <path
          d={arcPath}
          fill="none"
          stroke="var(--th-border)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <circle cx={leftEnd.x} cy={leftEnd.y} r={6} fill="var(--th-text-secondary)" />
        <circle cx={rightEnd.x} cy={rightEnd.y} r={6} fill="var(--th-text-secondary)" />

        {otherDots.map((t, i) => {
          const p = tToPoint(t);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={14} fill="var(--th-secondary)" opacity={0.9} />
              <circle cx={p.x} cy={p.y} r={5} fill="#fff" />
            </g>
          );
        })}

        {myPoint && (
          <g>
            <circle cx={myPoint.x} cy={myPoint.y} r={20} fill="var(--th-primary)" />
            <circle cx={myPoint.x} cy={myPoint.y} r={7} fill="#fff" />
          </g>
        )}
      </svg>
      <div className="flex justify-between mt-1 text-[13px] font-semibold text-text-primary">
        <span className="max-w-[45%] text-left leading-tight">{leftLabel}</span>
        <span className="max-w-[45%] text-right leading-tight">{rightLabel}</span>
      </div>
    </div>
  );
}

