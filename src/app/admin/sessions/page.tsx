'use client';

/**
 * /admin/sessions — the single place to review what explorers recorded, now that
 * the Google Sheets pipeline is retired. Reads the durable Firestore session
 * backup (`memorial-church-tour-sessions`), which is written on every meaningful
 * change during a tour — so even someone who closes the app early is captured.
 *
 * Each session is shown organized per Act: which acts they reached, the context
 * questions they asked themselves, their reflection responses (the prompt they
 * picked or their own), which authored contexts they opened, and the contexts
 * they built in their Context Journal (with how they set up the map + timeline).
 * A flat CSV export mirrors the same data.
 *
 * NOTE: needs the Firestore rule
 *   match /memorial-church-tour-sessions/{doc} { allow read, write: if true; }
 * or the collection stays empty.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Tour, Act, ContextEntrySnapshot } from '@/lib/types';
import type { PastCategory } from '@/features/context-journal/types';
import { LENS_BY_KEY, formatYear } from '@/features/context-journal/constants';
import { getAllTourSessions, StoredTourSession } from '@/lib/tour-sessions-store';
import { getTours } from '@/lib/tours-store';

type Row = string[];

function actsOf(tour: Tour | undefined): Act[] {
  return tour?.acts ?? [];
}

function actTitleOf(act: Act | undefined, fallback: string): string {
  return act?.title?.trim() || act?.guidingQuestion?.trim() || fallback;
}

function stopTitle(tour: Tour | undefined, stopId: string): string {
  if (!tour) return stopId;
  const all = [...(tour.contextStops || []), ...(tour.unstructuredStops || []), ...(tour.stops || [])];
  return all.find((s) => s.id === stopId)?.title || stopId;
}

/** Which acts the explorer reached — has a response for the act, opened one of
 *  its contexts, or completed one of its stops. (Acts aren't optional yet; this
 *  is ready for when choosing acts becomes a real decision.) */
function actsReached(s: StoredTourSession, tour: Tour | undefined): Set<string> {
  const reached = new Set<string>();
  for (const act of actsOf(tour)) {
    const hasResp = !!s.actResponses?.[act.id];
    const viewed = (s.viewedContexts ?? []).some((v) => v.actId === act.id);
    const stopDone = (s.completedStops ?? []).some((id) => act.stopIds.includes(id));
    if (hasResp || viewed || stopDone) reached.add(act.id);
  }
  return reached;
}

function lensLabel(lens: string): string {
  return LENS_BY_KEY[lens as PastCategory]?.label ?? lens;
}

/** One-line description of how the explorer set up the map + timeline for a
 *  context they built. */
function describeSetup(e: ContextEntrySnapshot): string {
  const parts: string[] = [];
  if (e.timeRange) parts.push(`timeline ${formatYear(e.timeRange.start)}–${formatYear(e.timeRange.end)}`);
  if (e.geometryType) parts.push(`map: ${e.geometryType === 'Point' ? 'a pin' : 'an area'}`);
  if (e.camera) parts.push(`view ${e.camera.center[1].toFixed(4)}, ${e.camera.center[0].toFixed(4)} · z${e.camera.zoom.toFixed(1)}`);
  if (e.mapType && e.mapType !== 'default') parts.push(e.mapType);
  if (e.mediaCount) parts.push(`${e.mediaCount} media`);
  return parts.join(' · ');
}

/** Flatten every session into one row per datum for CSV / a flat fallback. */
function buildRows(sessions: StoredTourSession[], toursById: Record<string, Tour>): Row[] {
  const rows: Row[] = [];
  for (const s of sessions) {
    const tour = toursById[s.tourId];
    const tourTitle = tour?.title || s.tourId;
    const base = [s.id, tourTitle, s.startedAt || '', s.completedAt || ''];

    // Acts reached.
    const reached = actsReached(s, tour);
    if (reached.size) {
      const labels = actsOf(tour).map((a, i) => (reached.has(a.id) ? actTitleOf(a, `Act ${i + 1}`) : null)).filter(Boolean) as string[];
      rows.push([...base, 'Acts reached', '', '', labels.join('; ')]);
    }

    const ar = s.actResponses || {};
    for (const [actId, resp] of Object.entries(ar)) {
      const act = actsOf(tour).find((a) => a.id === actId);
      const actTitle = actTitleOf(act, actId);
      if (resp?.opening) rows.push([...base, 'Act opening', actTitle, act?.openingQuestion?.prompt || '', resp.opening]);
      if (resp?.closing) rows.push([...base, 'Act closing', actTitle, act?.closingQuestion?.prompt || '', resp.closing]);
      // Context questions the explorer asked themselves.
      for (const cq of resp?.contextQuestions || []) {
        rows.push([...base, 'Context question (asked)', actTitle, cq.question, cq.answer || `(${cq.status})`]);
      }
      // "Share Your Thoughts" reflection — the prompt they picked (or their own),
      // their response, tagged contexts, photos, pin, and shared/unshared.
      const refl = resp?.reflection;
      if (refl) {
        const prompt = (refl.promptText || act?.reflectionQuestion?.prompt || act?.closingQuestion?.prompt || '')
          + (refl.isCustom ? ' (their own prompt)' : '');
        const extras: string[] = [];
        if (refl.taggedContexts && refl.taggedContexts.length) {
          extras.push(`contexts: ${refl.taggedContexts.map((c) => c.title || c.id).join(', ')}`);
        }
        if (refl.photos && refl.photos.length) extras.push(`${refl.photos.length} photo(s)`);
        if (refl.pin) extras.push(`pin: ${refl.pin.title || 'spot'}${refl.pin.note ? ` — ${refl.pin.note}` : ''}`);
        extras.push(refl.sharedToCommunity ? 'shared' : 'unshared');
        const response = refl.text + (extras.length ? `  [${extras.join('; ')}]` : '');
        rows.push([...base, 'Act reflection', actTitle, prompt, response]);
      }
    }

    // Authored contexts the explorer opened.
    for (const v of s.viewedContexts || []) {
      const act = actsOf(tour).find((a) => a.id === v.actId);
      rows.push([...base, 'Context viewed', actTitleOf(act, v.actId || ''), `${lensLabel(v.lens)} · ${v.title}`, v.question || '']);
    }

    // Contexts the explorer built in their Context Journal (map + timeline).
    for (const e of s.contextEntries || []) {
      const kind = e.origin === 'self' ? 'Context created (own)' : 'Context added/edited';
      rows.push([...base, kind, lensLabel(e.lens), e.title, [e.shortSummary, describeSetup(e)].filter(Boolean).join('  ·  ')]);
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

// ── Small presentational atoms ──

function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide"
      style={{ backgroundColor: color ? `${color}22` : '#e7e5e4', color: color || '#57534e' }}>
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wide text-stone-400">{label}</span>
      <p className="text-sm text-stone-900 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

// ── Per-act block ──

function ActBlock({ s, act, index }: { s: StoredTourSession; act: Act; index: number }) {
  const resp = s.actResponses?.[act.id];
  const viewed = (s.viewedContexts || []).filter((v) => v.actId === act.id);
  const refl = resp?.reflection;
  const askedQs = resp?.contextQuestions || [];

  const hasAny = !!resp || viewed.length > 0;
  if (!hasAny) return null;

  const reflPrompt = refl
    ? (refl.promptText || act.reflectionQuestion?.prompt || act.closingQuestion?.prompt || '') + (refl.isCustom ? '  (their own prompt)' : '')
    : '';

  return (
    <div className="border-l-2 border-stone-200 pl-3 space-y-3">
      <p className="text-sm font-semibold text-stone-800">{actTitleOf(act, `Act ${index + 1}`)}</p>

      {refl && (
        <div className="space-y-1.5 bg-stone-50 rounded p-2.5">
          <div className="flex items-center gap-2">
            <Tag>Reflection</Tag>
            <Tag color={refl.sharedToCommunity ? '#15803d' : '#a16207'}>{refl.sharedToCommunity ? 'shared' : 'unshared'}</Tag>
            {refl.isCustom && <Tag>their own prompt</Tag>}
          </div>
          <Field label="Prompt they picked" value={reflPrompt} />
          <Field label="Response" value={refl.text} />
          {refl.taggedContexts && refl.taggedContexts.length > 0 && (
            <Field label="Contexts they tagged" value={refl.taggedContexts.map((c) => c.title || c.id).join(', ')} />
          )}
          {(refl.photos?.length || refl.pin) && (
            <p className="text-[11px] text-stone-500">
              {refl.photos?.length ? `${refl.photos.length} photo(s)` : ''}
              {refl.pin ? `${refl.photos?.length ? ' · ' : ''}📍 ${refl.pin.title || 'their spot'}${refl.pin.note ? ` — ${refl.pin.note}` : ''}` : ''}
            </p>
          )}
        </div>
      )}

      {resp?.opening && <Field label="Act opening" value={resp.opening} />}
      {resp?.closing && <Field label="Act closing" value={resp.closing} />}

      {askedQs.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-stone-400">Questions they asked themselves</span>
          {askedQs.map((q, i) => (
            <div key={i} className="text-sm">
              <p className="text-stone-900">“{q.question}”</p>
              <p className="text-xs text-stone-500 italic">{q.answer || `(${q.status})`}</p>
            </div>
          ))}
        </div>
      )}

      {viewed.length > 0 && (
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase tracking-wide text-stone-400">Contexts they opened</span>
          {viewed.map((v, i) => (
            <p key={i} className="text-xs text-stone-700">
              <span style={{ color: LENS_BY_KEY[v.lens as PastCategory]?.colour }}>{lensLabel(v.lens)}</span> · {v.title}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Contexts the explorer built (map + timeline) ──

function ContextEntriesBlock({ entries }: { entries: ContextEntrySnapshot[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Context Journal — what they built ({entries.length})</p>
      {entries.map((e) => {
        const setup = describeSetup(e);
        return (
          <div key={e.id} className="rounded border border-stone-200 p-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <Tag color={LENS_BY_KEY[e.lens as PastCategory]?.colour}>{lensLabel(e.lens)}</Tag>
              {e.origin && <Tag>{e.origin === 'self' ? 'their own' : e.origin}</Tag>}
              <span className="text-sm font-semibold text-stone-800">{e.title}</span>
            </div>
            {e.question && <p className="text-xs text-stone-600 italic">“{e.question}”</p>}
            {e.shortSummary && <p className="text-xs text-stone-700">{e.shortSummary}</p>}
            {setup && <p className="text-[11px] text-stone-500 font-mono">{setup}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──

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
            <p className="text-xs text-stone-500 mt-0.5">
              Everything explorers recorded ({sessions.length} sessions, {rows.length} data points). Saved continuously, so early-leavers are captured. Google Sheets is retired.
            </p>
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
              const acts = actsOf(tour);
              const reached = actsReached(s, tour);
              const entries = s.contextEntries || [];
              const hasAnything = buildRows([s], toursById).length > 0;

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

                  {/* Acts reached */}
                  {acts.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wide text-stone-400 mr-1">Acts reached {reached.size}/{acts.length}:</span>
                      {acts.map((a, i) => (
                        <span key={a.id}
                          className={`px-1.5 py-0.5 rounded text-[11px] ${reached.has(a.id) ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-400 line-through'}`}>
                          {actTitleOf(a, `Act ${i + 1}`)}
                        </span>
                      ))}
                    </div>
                  )}

                  {!hasAnything ? (
                    <p className="text-xs text-stone-400 italic">No recorded answers in this session.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Per-act */}
                      {acts.map((act, i) => <ActBlock key={act.id} s={s} act={act} index={i} />)}

                      {/* Contexts they built */}
                      <ContextEntriesBlock entries={entries} />

                      {/* EQ / banked / midway / per-stop reflections — flat fallback rows */}
                      <FlatExtras s={s} tour={tour} />
                    </div>
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

/** The remaining datum types (EQ, banked questions, midway, per-stop reflections)
 *  rendered as simple rows — they aren't act-scoped. */
function FlatExtras({ s, tour }: { s: StoredTourSession; tour: Tour | undefined }) {
  const items: { type: string; where: string; question: string; response: string }[] = [];

  for (const r of s.reflections || []) {
    items.push({ type: 'Reflection', where: stopTitle(tour, r.stopId), question: `slider=${r.sliderValue}`, response: r.followUpResponse || '' });
  }
  const eq = s.essentialQuestionResponses;
  if (eq) {
    const q = tour?.essentialQuestion?.question || '';
    if (eq.initialTheory) items.push({ type: 'EQ initial theory', where: '', question: q, response: eq.initialTheory });
    if (eq.initialReasoning) items.push({ type: 'EQ initial reasoning', where: '', question: '', response: eq.initialReasoning });
    if (eq.finalReflection) items.push({ type: 'EQ final reflection', where: '', question: q, response: eq.finalReflection });
    if (eq.finalReasoning) items.push({ type: 'EQ final reasoning', where: '', question: '', response: eq.finalReasoning });
  }
  for (const q of s.bankedQuestions || []) {
    items.push({ type: 'Banked question', where: stopTitle(tour, q.askedAfterStopId), question: '', response: q.questionText });
  }
  if (s.midwayResponseText) {
    items.push({ type: 'Midway', where: '', question: tour?.midwayQuestion || '', response: s.midwayResponseText });
  }

  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="text-xs border-l-2 border-stone-200 pl-3">
          <span className="text-stone-500 font-mono uppercase text-[10px]">{it.type}{it.where ? ` · ${it.where}` : ''}</span>
          {it.question && <p className="text-stone-500 italic mt-0.5">{it.question}</p>}
          <p className="text-stone-900 mt-0.5">{it.response}</p>
        </li>
      ))}
    </ul>
  );
}
