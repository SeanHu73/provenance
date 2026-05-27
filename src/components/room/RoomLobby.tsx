'use client';

/**
 * Full-screen lobby shown while in a room that hasn't started the tour
 * yet. Lists every member; host taps "Begin tour" to start the tour
 * for everyone simultaneously.
 */

import { useEffect, useState } from 'react';
import { Tour } from '@/lib/types';
import { getTour } from '@/lib/tours-store';
import { memberStatus, useRoom } from '@/context/RoomContext';

export default function RoomLobby() {
  const { room, isHost, mySessionId, startTour, leaveRoom } = useRoom();
  const [tour, setTour] = useState<Tour | null>(null);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    getTour(room.tourId).then((t) => {
      if (!cancelled) setTour(t);
    });
    return () => { cancelled = true; };
  }, [room?.tourId]);

  if (!room || !mySessionId) return null;

  const memberCount = room.members.length;

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: 'var(--th-bg)' }}>
      {/* Title bar matching Journal's */}
      <div className="shrink-0 px-4 py-2 text-center" style={{ backgroundColor: 'var(--th-primary)' }}>
        <p className="text-lg font-display font-bold text-warm-white">{tour?.title ?? 'Group tour'}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-[14px] uppercase tracking-[0.18em] text-text-secondary font-semibold">
            Group code
          </p>
          <p
            className="text-[56px] font-display font-bold leading-none tracking-[0.06em]"
            style={{ color: 'var(--th-primary)' }}
          >
            {room.code}
          </p>
          <p className="text-sm text-text-secondary">
            Share this with the people you want to walk this tour with.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-[12px] uppercase tracking-[0.16em] text-text-secondary font-semibold">
            {memberCount} member{memberCount !== 1 ? 's' : ''} in the room
          </p>
          <ul className="space-y-2">
            {room.members.map((m) => {
              const isMe = m.sessionId === mySessionId;
              const isMemberHost = m.sessionId === room.hostSessionId;
              const status = memberStatus(m);
              return (
                <li
                  key={m.sessionId}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg"
                  style={{
                    backgroundColor: 'var(--th-surface)',
                    border: '1px solid var(--th-border)',
                  }}
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
                    <p className="text-base font-serif text-text-primary truncate">
                      {m.name}
                      {isMe && <span className="text-xs text-text-secondary"> (you)</span>}
                    </p>
                  </div>
                  {isMemberHost && (
                    <span
                      className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
                    >
                      Host
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {!isHost && (
          <p className="text-sm text-text-secondary italic text-center">
            Waiting for the host to begin…
          </p>
        )}
      </div>

      <div className="shrink-0 px-6 py-4 space-y-2 border-t" style={{ borderColor: 'var(--th-border)' }}>
        {isHost && (
          <button
            onClick={() => void startTour()}
            className="w-full py-3 rounded-lg text-base font-semibold text-warm-white"
            style={{ backgroundColor: 'var(--th-primary)' }}
          >
            Begin tour for everyone
          </button>
        )}
        <button
          onClick={() => void leaveRoom()}
          className="w-full py-2 text-sm text-text-secondary"
        >
          Leave room
        </button>
      </div>
    </div>
  );
}
