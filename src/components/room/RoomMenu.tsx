'use client';

/**
 * Bottom-sheet menu opened by tapping the ROOM pill in the footer.
 * Shows the member list with online/idle status, lets any member
 * "Remove" another after 2 minutes of inactivity, copy the code,
 * or leave the room.
 *
 * Per the design discussion: kick should not be constantly present —
 * it lives in this menu, not on the always-visible footer.
 */

import { useState } from 'react';
import { canKick, memberStatus, useRoom } from '@/context/RoomContext';

interface Props {
  onDismiss: () => void;
}

export default function RoomMenu({ onDismiss }: Props) {
  const { room, mySessionId, kickMember, leaveRoom } = useRoom();
  const [copied, setCopied] = useState(false);

  if (!room || !mySessionId) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />

      <div
        className="relative animate-slide-up rounded-t-2xl px-6 pt-5 pb-6 space-y-4"
        style={{ backgroundColor: 'var(--th-surface)' }}
      >
        <div className="flex justify-center">
          <span className="block w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--th-border)' }} />
        </div>

        <div className="flex items-baseline justify-between">
          <p className="text-[22px] font-display font-bold text-accent-dark">Group</p>
          <button
            onClick={() => void handleCopy()}
            className="text-xs px-3 py-1 rounded-full"
            style={{
              backgroundColor: 'var(--th-bg)',
              color: 'var(--th-primary)',
              border: '1px solid var(--th-border)',
            }}
          >
            {copied ? 'Copied!' : `Copy code · ${room.code}`}
          </button>
        </div>

        <ul className="space-y-2">
          {room.members.map((m) => {
            const isMe = m.sessionId === mySessionId;
            const isMemberHost = m.sessionId === room.hostSessionId;
            const status = memberStatus(m);
            const kickable = !isMe && canKick(m);
            return (
              <li
                key={m.sessionId}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
                style={{ backgroundColor: 'var(--th-bg)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        status === 'online'
                          ? 'var(--th-olive)'
                          : status === 'idle'
                            ? 'var(--th-secondary)'
                            : 'var(--th-text-faint)',
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-serif text-text-primary truncate">
                      {m.name}
                      {isMe && <span className="text-xs text-text-secondary"> (you)</span>}
                    </p>
                    <p className="text-[11px] text-text-secondary capitalize">
                      {status}
                      {isMemberHost && ' · host'}
                    </p>
                  </div>
                </div>
                {kickable && (
                  <button
                    onClick={() => void kickMember(m.sessionId)}
                    className="text-xs px-2.5 py-1 rounded"
                    style={{
                      color: 'var(--th-primary)',
                      border: '1px solid var(--th-primary)',
                    }}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] text-text-secondary leading-relaxed">
          You can remove a member after they&apos;ve been idle for 2 minutes.
          The room continues whether or not your phone screen is on.
        </p>

        <button
          onClick={async () => {
            await leaveRoom();
            onDismiss();
          }}
          className="w-full py-3 rounded-lg text-sm font-semibold"
          style={{ color: 'var(--th-primary)', border: '1px solid var(--th-primary)' }}
        >
          Leave room
        </button>
        <button
          onClick={onDismiss}
          className="w-full py-2 text-sm text-text-secondary"
        >
          Close
        </button>
      </div>
    </div>
  );
}
