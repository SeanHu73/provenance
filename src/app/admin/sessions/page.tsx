'use client';

/**
 * /admin/sessions — viewer + CSV export for the session backup
 * (`memorial-church-tour-sessions`). Each backed-up session carries the full
 * collected content (Act responses, reflections, EQ answers, banked
 * questions), independent of the Google Sheet, so data isn't lost if a logging
 * beacon never made it out (e.g. a phone turned off at the end of a tour).
 *
 * NOTE: needs the Firestore rule
 *   match /memorial-church-tour-sessions/{doc} { allow read, write: if true; }
 * or the collection stays empty.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Tour } from '@/lib/types';
import { getAllTourSessions, StoredTourSession } from '@/lib/tour-sessions-store';
import { getTours } from '@/lib/tours-store';

type Row = string[];

function stopTitle(tour: Tour | undefined, stopId: string): string {
  if (!tour) return stopId;
  const all = [...(tour.contextStops || []), ...(tour.unstructuredStops || []), ...(tour.stops || [])];
  return all.find((s) => s.id === stopId)?.title || stopId;
}

/** Flatten every session into one row per answer for CSV / display. */
function buildRows(sessions: StoredTourSession[], toursById: Record<string, Tour>): Row[] {
  const rows: Row[] = [];
  for (const s of sessions) {
    const tour = toursById[s.tourId];
    const tourTitle = tour?.title || s.tourId;
    const base = [s.id, tourTitle, s.startedAt || '', s.completedAt || ''];

    const ar = s.actResponses || {};
    for (const [actId, resp] of Object.entries(ar)) {
      const act = tour?.acts?.find((a) => a.id === actId);
      const actTitle = act?.title || actId;
      if (resp?.opening) rows.push([...base, 'Act opening', actTitle, act?.openingQuestion?.prompt || '', resp.opening]);
      if (resp?.closing) rows.push([...base, 'Act closing', actTitle, act?.closingQuestion?.prompt || '', resp.closing]);
      // Context questions the explorer asked.
      for (const cq of resp?.contextQuestions || []) {
        rows.push([...base, 'Context question', actTitle, cq.question, cq.answer || `(${cq.status})`]);
      }
      // "Share What You Think" reflection (text + photo/pin/share markers).
      const refl = resp?.reflection;
      if (refl) {
        const prompt = act?.reflectionQuestion?.prompt ?? act?.closingQuestion?.prompt ?? '';
        const extras: string[] = [];
        if (refl.photos && refl.photos.length) extras.push(`${refl.photos.length} photo(s)`);
        if (refl.pin) extras.push(`pin: ${refl.pin.title || 'spot'}${refl.pin.note ? ` — ${refl.pin.note}` : ''}`);
        if (refl.sharedToCommunity) extras.push('shared');
        const response = refl.text + (extras.length ? `  [${extras.join('; ')}]` : '');
        rows.push([...base, 'Act reflection', actTitle, prompt, response]);
      }
    }

    for (const r of s.reflections || []) {
      rows.push([...base, 'Reflection', stopTitle(tour, r.stopId), `slider=${r.sliderValue}`, r.followUpResponse || '']);
    }

    const eq = s.essentialQuestionResponses;
    if (eq) {
      const q = tour?.essentialQuestion?.question || '';
      if (eq.initialTheory) rows.push([...base, 'EQ initial theory', '', q, eq.initialTheory]);
      if (eq.initialReasoning) rows.push([...base, 'EQ initial reasoning', '', '', eq.initialReasoning]);
      if (eq.finalReflection) rows.push([...base, 'EQ final reflection', '', q, eq.finalReflection]);
      if (eq.finalReasoning) rows.push([...base, 'EQ final reasoning', '', '', eq.finalReasoning]);
    }

    for (const q of s.bankedQuestions || []) {
      rows.push([...base, 'Banked question', stopTitle(tour, q.askedAfterStopId), '', q.questionText]);
    }

    if (s.midwayResponseText) {
      rows.push([...base, 'Midway', '', tour?.midwayQuestion || '', s.midwayResponseText]);
    }
  }
  return rows;
}

const HEADER: Row = ['Session', 'Tour', 'Started', 'Completed', 'Type', 'Where', 'Question', 'Response'];

function toCsv(rows: Row[]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  return [HEADER, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

export default function SessionsAdminPage() {
  const [sessions, setSessions] = useState<StoredTourSession[]>([]);
  const [toursById, setToursById] = useState<Record<string, Tour>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [ss, ts] = await Promise.all([getAllTourSessions(), getTours()]);
    const map: Record<string, Tour> = {};
    ts.forEach((t) => { map[t.id] = t; });
    setSessions(ss);
    setToursById(map);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const rows = buildRows(sessions, toursById);

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `provenance-sessions.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 border-b border-stone-300 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sessions</h1>
            <p className="text-xs text-stone-500 mt-0.5">Backed-up explorer responses ({sessions.length} sessions, {rows.length} answers).</p>
          </div>
          <div className="flex gap-3 text-sm items-center">
            <button onClick={exportCsv} disabled={rows.length === 0} className="px-3 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40">Export CSV</button>
            <button onClick={reload} className="text-blue-700 hover:underline">Refresh</button>
            <Link href="/admin" className="text-blue-700 hover:underline">← Admin</Link>
          </div>
        </header>

        {loading ? (
          <p className="text-stone-600 text-sm">Loading…</p>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-stone-600 space-y-2">
            <p className="italic">No sessions found.</p>
            <p className="text-xs text-stone-500">If you expected data here, the Firestore rule may be missing — add <code className="bg-stone-200 px-1 rounded">match /memorial-church-tour-sessions/&#123;doc&#125; &#123; allow read, write: if true; &#125;</code> in the console. (It only protects sessions recorded after it&apos;s added.)</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((s) => {
              const tour = toursById[s.tourId];
              const sessionRows = buildRows([s], toursById);
              return (
                <div key={s.id} className="border border-stone-300 rounded bg-white p-4 space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{tour?.title || s.tourId}</p>
                      <p className="text-[10px] text-stone-400 font-mono">
                        {s.id} · started {s.startedAt ? new Date(s.startedAt).toLocaleString() : '—'}
                        {s.completedAt ? ` · completed ${new Date(s.completedAt).toLocaleString()}` : ' · in progress'}
                      </p>
                    </div>
                    <span className="text-[10px] text-stone-400 shrink-0">{s.completedStops?.length ?? 0} stops</span>
                  </div>

                  {sessionRows.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">No recorded answers in this session.</p>
                  ) : (
                    <ul className="space-y-2">
                      {sessionRows.map((r, i) => (
                        <li key={i} className="text-xs border-l-2 border-stone-200 pl-3">
                          <span className="text-stone-500 font-mono uppercase text-[10px]">{r[4]}{r[5] ? ` · ${r[5]}` : ''}</span>
                          {r[6] && <p className="text-stone-500 italic mt-0.5">{r[6]}</p>}
                          <p className="text-stone-900 mt-0.5">{r[7]}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
