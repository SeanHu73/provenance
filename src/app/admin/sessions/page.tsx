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
import { Tour, Act, ContextEntrySnapshot, DetectiveCorrection, KnowledgeEntry } from '@/lib/types';
import type { PastCategory } from '@/features/context-journal/types';
import { LENS_BY_KEY, formatYear } from '@/features/context-journal/constants';
import { getAllTourSessions, setSessionStarred, StoredTourSession } from '@/lib/tour-sessions-store';
import { getTours } from '@/lib/tours-store';
import { getAllCorrections, saveCorrection } from '@/lib/detective-corrections-store';
import { fetchEmbedding, saveKnowledgeEntry, newKnowledgeId, knowledgeEmbedText, knowledgeEmbedHash } from '@/lib/knowledge-store';

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

    // Every Detective answer the explorer got from asking their own question.
    for (const e of s.detectiveAnswers || []) {
      rows.push([...base, 'Context question (Detective answer)', lensLabel(e.lens), e.question || e.title, e.longExplanation || '']);
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

    if (s.onboardingHistoryResponse) {
      rows.push([...base, 'Onboarding', '', 'What do you think history is?', s.onboardingHistoryResponse]);
    }

    if (s.themeQuestionResponse) {
      rows.push([...base, 'Theme question', '', tour?.openingFrame?.themeQuestion || '', s.themeQuestionResponse]);
    }
  }
  return rows;
}

const HEADER: Row = ['Session', 'Tour', 'Started', 'Completed', 'Type', 'Where', 'Question', 'Response'];

function toCsv(rows: Row[]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  return [HEADER, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

/** Every Detective answer (and any reviewed built context) joined with the admin's
 *  verdict / note / edit — the raw material for improving the Detective's skills &
 *  exemplars. Exported as JSON so it can be handed back for review. */
function buildDetectiveReviews(
  sessions: StoredTourSession[],
  toursById: Record<string, Tour>,
  corrections: Record<string, DetectiveCorrection>,
) {
  const out: Record<string, unknown>[] = [];
  for (const s of sessions) {
    const tourTitle = toursById[s.tourId]?.title || s.tourId;
    const rowFor = (e: ContextEntrySnapshot, kind: string) => {
      const c = corrections[e.id];
      return {
        sessionId: s.id,
        tourId: s.tourId,
        tourTitle,
        kind,
        lens: e.lens,
        question: e.question || e.title || '',
        aiAnswer: e.longExplanation || '',
        learnerPrediction: e.learnerPrediction || undefined,
        sources: (e.sourceLinks || []).map((l) => l.url).filter(Boolean),
        review: c
          ? {
              verdict: c.verdict,
              note: c.note,
              editedTitle: c.edited?.title,
              editedAnswer: c.edited?.longExplanation,
              promotedToKnowledgeBase: !!c.promotedEntryId,
            }
          : undefined,
      };
    };
    for (const e of s.detectiveAnswers || []) out.push(rowFor(e, 'detective-answer'));
    // Built/self contexts that were reviewed but aren't in detectiveAnswers.
    const answerIds = new Set((s.detectiveAnswers || []).map((e) => e.id));
    for (const e of s.contextEntries || []) {
      if (corrections[e.id] && !answerIds.has(e.id)) out.push(rowFor(e, 'built-context'));
    }
  }
  return out;
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

function ContextEntriesBlock({ entries, sessionId, tourId, corrections, onSaved, heading = 'Context Journal — what they built' }: {
  entries: ContextEntrySnapshot[];
  sessionId: string;
  tourId: string;
  corrections: Record<string, DetectiveCorrection>;
  onSaved: () => void;
  heading?: string;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{heading} ({entries.length})</p>
      {entries.map((e) => (
        <ContextEntryRow key={e.id} e={e} sessionId={sessionId} tourId={tourId} correction={corrections[e.id]} onSaved={onSaved} />
      ))}
    </div>
  );
}

const VERDICTS: { key: NonNullable<DetectiveCorrection['verdict']>; label: string; cls: string; hex: string }[] = [
  { key: 'approved', label: 'Approved', cls: 'bg-emerald-600', hex: '#059669' },
  { key: 'needs_work', label: 'Needs work', cls: 'bg-amber-600', hex: '#d97706' },
  { key: 'rejected', label: 'Rejected', cls: 'bg-red-600', hex: '#dc2626' },
];

// What kind of lesson this is. The Skill Maintainer routes on it: content →
// retrieved by question similarity; voice → a Narrative Voice skill diff, because a
// voice lesson applies to every question, not just similar ones. See DetectiveCorrection.
const KINDS: { key: NonNullable<DetectiveCorrection['kind']>; label: string; cls: string }[] = [
  { key: 'voice', label: 'Voice', cls: 'bg-violet-600' },
  { key: 'content', label: 'Content', cls: 'bg-sky-700' },
  { key: 'both', label: 'Both', cls: 'bg-stone-600' },
];

function ContextEntryRow({ e, sessionId, tourId, correction, onSaved }: {
  e: ContextEntrySnapshot;
  sessionId: string;
  tourId: string;
  correction?: DetectiveCorrection;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(correction?.note ?? '');
  const [verdict, setVerdict] = useState<DetectiveCorrection['verdict']>(correction?.verdict);
  const [kind, setKind] = useState<DetectiveCorrection['kind']>(correction?.kind);
  const cur = correction?.edited ?? { title: e.title, shortSummary: e.shortSummary ?? '', longExplanation: e.longExplanation ?? '' };
  const [eTitle, setETitle] = useState(cur.title);
  const [eSummary, setESummary] = useState(cur.shortSummary);
  const [eLong, setELong] = useState(cur.longExplanation);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const setup = describeSetup(e);

  // Clear the transient "Saved ✓" so it doesn't sit there implying the *next*
  // edit is saved too. Failures stay up until the next attempt.
  useEffect(() => {
    if (!status || /fail/i.test(status)) return;
    const t = window.setTimeout(() => setStatus(''), 2200);
    return () => window.clearTimeout(t);
  }, [status]);

  // Persist the current review state. `original` is captured the first time an
  // edit is made and never overwritten, so the AI can see what changed.
  const persist = async (over: Partial<DetectiveCorrection> = {}) => {
    setBusy(true);
    const willEdit = over.edited !== undefined ? over.edited : correction?.edited;
    const next: DetectiveCorrection = {
      id: e.id, sessionId, tourId,
      verdict, kind, note: note.trim() || undefined,
      original: correction?.original ?? { title: e.title, shortSummary: e.shortSummary ?? '', longExplanation: e.longExplanation ?? '' },
      edited: willEdit,
      promotedEntryId: correction?.promotedEntryId,
      ...over,
      updatedAt: new Date().toISOString(),
    };
    // Say so on success, not just on failure. Silence on a write is unreadable:
    // it looks identical to a no-op, so you can't tell a saved note from a lost
    // one and end up re-clicking or re-typing it.
    try { await saveCorrection(next); onSaved(); setStatus('Saved ✓'); }
    catch (err) { console.error(err); setStatus('Save failed — not saved'); }
    setBusy(false);
  };

  const saveEdit = async () => {
    await persist({ edited: { title: eTitle.trim(), shortSummary: eSummary.trim(), longExplanation: eLong.trim() } });
    setEditing(false);
    setStatus('Saved edit');
  };

  // Promote the (corrected, else original) answer into the verified knowledge base.
  const promote = async () => {
    setBusy(true);
    setStatus('Embedding…');
    const src = correction?.edited ?? { title: e.title, shortSummary: e.shortSummary ?? '', longExplanation: e.longExplanation ?? '' };
    try {
      const base: KnowledgeEntry = {
        id: correction?.promotedEntryId || newKnowledgeId(),
        title: src.title, shortSummary: src.shortSummary, longExplanation: src.longExplanation,
        sourceLinks: e.sourceLinks ?? [], lens: e.lens as KnowledgeEntry['lens'],
        status: 'verified', createdAt: '', updatedAt: '',
      };
      const { embedding, model } = await fetchEmbedding(knowledgeEmbedText(base));
      base.embedding = embedding; base.embeddingModel = model; base.embeddingHash = knowledgeEmbedHash(base);
      await saveKnowledgeEntry(tourId, base);
      await persist({ promotedEntryId: base.id, verdict: verdict ?? 'approved' });
      setStatus('Promoted to knowledge base ✓');
    } catch (err) {
      console.error('[sessions] promote failed:', err);
      setStatus('Promote failed — check OPENAI_API_KEY');
    }
    setBusy(false);
  };

  const shownTitle = correction?.edited?.title || e.title;
  const shownLong = correction?.edited?.longExplanation || e.longExplanation;

  return (
    <div className="rounded border border-stone-200 p-2.5 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <Tag color={LENS_BY_KEY[e.lens as PastCategory]?.colour}>{lensLabel(e.lens)}</Tag>
        {e.origin && <Tag>{e.origin === 'self' ? 'their own' : e.origin}</Tag>}
        {correction?.verdict && (() => { const v = VERDICTS.find((x) => x.key === correction.verdict); return v ? <Tag color={v.hex}>{v.label}</Tag> : null; })()}
        {correction?.kind && <Tag>{KINDS.find((k) => k.key === correction.kind)?.label.toLowerCase()}</Tag>}
        {correction?.edited && <Tag>edited</Tag>}
        {correction?.promotedEntryId && <Tag>in base</Tag>}
        <span className="text-sm font-semibold text-stone-800">{shownTitle}</span>
      </div>
      {e.originalQuestion && (
        <p className="text-[11px] text-amber-700">First asked: &ldquo;{e.originalQuestion}&rdquo; <span className="text-stone-400">→ reframed to:</span></p>
      )}
      {e.question && <p className="text-xs text-stone-600 italic">“{e.question}”</p>}
      {e.shortSummary && <p className="text-xs text-stone-700">{correction?.edited?.shortSummary || e.shortSummary}</p>}
      {shownLong && (
        <div>
          <button onClick={() => setOpen((v) => !v)} className="text-[11px] font-semibold text-blue-700 hover:underline">
            {open ? 'Hide full context ▲' : 'Show full context ▼'}
          </button>
          {open && <p className="mt-1 text-xs text-stone-700 whitespace-pre-line leading-relaxed border-l-2 border-stone-200 pl-2">{shownLong}</p>}
        </div>
      )}
      {e.learnerPrediction && (
        <p className="text-[11px] text-stone-600"><span className="font-semibold text-stone-500">Their prediction:</span> {e.learnerPrediction}</p>
      )}
      {setup && <p className="text-[11px] text-stone-500 font-mono">{setup}</p>}

      {/* Review / correct */}
      <div className="pt-1">
        {!reviewing ? (
          <button onClick={() => setReviewing(true)} className="text-[11px] font-semibold text-stone-600 hover:underline">
            {correction ? 'Review ▸ (edit / verdict / promote)' : 'Correct this answer ▸'}
          </button>
        ) : (
          <div className="mt-1 rounded bg-stone-50 border border-stone-200 p-2.5 space-y-2">
            {/* verdict */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {VERDICTS.map((v) => (
                <button key={v.key} onClick={() => { setVerdict(v.key); void persist({ verdict: v.key }); }}
                  className={`px-2 py-0.5 rounded text-[11px] text-white ${v.cls} ${verdict === v.key ? '' : 'opacity-40'}`}>{v.label}</button>
              ))}
              <button onClick={() => setReviewing(false)} className="ml-auto text-[11px] text-stone-500 hover:underline">Close</button>
            </div>
            {/* kind — routes the lesson: voice becomes a skill diff, content a retrieved example */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-stone-500 font-semibold">Lesson about:</span>
              {KINDS.map((k) => (
                <button key={k.key} onClick={() => { setKind(k.key); void persist({ kind: k.key }); }}
                  className={`px-2 py-0.5 rounded text-[11px] text-white ${k.cls} ${kind === k.key ? '' : 'opacity-40'}`}>{k.label}</button>
              ))}
            </div>
            {/* note */}
            <div className="flex gap-2 items-start">
              <textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={2}
                placeholder="The rule, not the change — the edit already shows what changed. e.g. “Don't open by restating the question; start with the fact.”"
                className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs bg-white" />
              <div className="shrink-0 flex flex-col items-end gap-1">
                <button onClick={() => void persist()} disabled={busy} className="px-2 py-1 rounded bg-blue-700 text-white text-[11px] disabled:opacity-40">
                  {busy ? 'Saving…' : 'Save note'}
                </button>
                {/* The status lived only next to Promote, at the bottom of the box —
                    too far from this button to read as its result. */}
                {status && (
                  <span className={`text-[11px] ${/fail/i.test(status) ? 'text-red-700 font-semibold' : 'text-emerald-700'}`}>{status}</span>
                )}
              </div>
            </div>
            {/* edit answer */}
            {!editing ? (
              <button onClick={() => setEditing(true)} className="text-[11px] font-semibold text-blue-700 hover:underline">Edit the answer text ▸</button>
            ) : (
              <div className="space-y-1.5">
                <input value={eTitle} onChange={(ev) => setETitle(ev.target.value)} placeholder="Title" className="w-full px-2 py-1 border border-stone-300 rounded text-xs bg-white" />
                <textarea value={eSummary} onChange={(ev) => setESummary(ev.target.value)} rows={2} placeholder="Short summary" className="w-full px-2 py-1 border border-stone-300 rounded text-xs bg-white" />
                <textarea value={eLong} onChange={(ev) => setELong(ev.target.value)} rows={5} placeholder="Full context" className="w-full px-2 py-1 border border-stone-300 rounded text-xs bg-white" />
                <p className="text-[10px] text-stone-400">The original answer is kept on record; your edit is stored alongside it so the change is legible.</p>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={busy} className="px-2 py-1 rounded bg-blue-700 text-white text-[11px] disabled:opacity-40">Save edit</button>
                  <button onClick={() => setEditing(false)} className="text-[11px] text-stone-500 hover:underline">Cancel</button>
                </div>
              </div>
            )}
            {/* promote */}
            <div className="flex items-center gap-2 pt-0.5">
              <button onClick={promote} disabled={busy} className="px-2 py-1 rounded bg-emerald-700 text-white text-[11px] hover:bg-emerald-800 disabled:opacity-40">
                {correction?.promotedEntryId ? 'Update in knowledge base' : 'Promote to knowledge base'}
              </button>
              {status && <span className="text-[11px] text-stone-600">{status}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──

export default function SessionsAdminPage() {
  const [sessions, setSessions] = useState<StoredTourSession[]>([]);
  const [toursById, setToursById] = useState<Record<string, Tour>>({});
  const [corrections, setCorrections] = useState<Record<string, DetectiveCorrection>>({});
  const [loading, setLoading] = useState(true);
  const [starredOnly, setStarredOnly] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [ss, ts, cx] = await Promise.all([getAllTourSessions(), getTours(), getAllCorrections()]);
    const map: Record<string, Tour> = {};
    ts.forEach((t) => { map[t.id] = t; });
    setSessions(ss);
    setToursById(map);
    setCorrections(cx);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const refreshCorrections = useCallback(async () => { setCorrections(await getAllCorrections()); }, []);

  // Optimistically flip the star in local state so the UI updates instantly;
  // the Firestore write happens in the background.
  const toggleStar = useCallback((id: string, starred: boolean) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, starred } : s)));
    void setSessionStarred(id, starred).catch(() => {
      // Revert on failure.
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, starred: !starred } : s)));
    });
  }, []);

  const starredCount = sessions.filter((s) => s.starred).length;
  const visibleSessions = starredOnly ? sessions.filter((s) => s.starred) : sessions;
  // CSV export follows the current filter, so "starred only" exports just those.
  const rows = buildRows(visibleSessions, toursById);

  const download = (data: string, filename: string, mime: string) => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => download(toCsv(rows), 'provenance-sessions.csv', 'text/csv;charset=utf-8');

  const reviews = buildDetectiveReviews(sessions, toursById, corrections);
  const exportReviews = () =>
    download(JSON.stringify(reviews, null, 2), 'provenance-detective-reviews.json', 'application/json');

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 border-b border-stone-300 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sessions</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Everything explorers recorded ({sessions.length} sessions, {starredCount} starred). Saved continuously and kept indefinitely — nothing is auto-deleted. Star the real explorer runs to keep them apart from your own test opens.
            </p>
          </div>
          <div className="flex gap-3 text-sm items-center">
            <button
              onClick={() => setStarredOnly((v) => !v)}
              className={`px-3 py-1.5 rounded border ${starredOnly ? 'bg-amber-400 border-amber-500 text-stone-900' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'}`}
              title="Show only sessions you've starred"
            >
              {starredOnly ? '★ Starred only' : '☆ Starred only'}
            </button>
            <button onClick={exportCsv} disabled={rows.length === 0} className="px-3 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40">Export CSV</button>
            <button
              onClick={exportReviews}
              disabled={reviews.length === 0}
              title="Download every Detective answer with your verdict / note / edit, as JSON — for reviewing or improving the Detective."
              className="px-3 py-1.5 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              Export Detective reviews ({reviews.length})
            </button>
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
        ) : starredOnly && visibleSessions.length === 0 ? (
          <p className="text-sm text-stone-600 italic">No starred sessions yet. Star a session with the ☆ button to keep it here.</p>
        ) : (
          <div className="space-y-3">
            {visibleSessions.map((s) => (
              <SessionCard key={s.id} s={s} toursById={toursById} corrections={corrections} onSaved={refreshCorrections} onToggleStar={toggleStar} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** One session, collapsed by default (the list gets long). The header stays
 *  visible; the body — acts, contexts + their review controls, extras — expands. */
function SessionCard({ s, toursById, corrections, onSaved, onToggleStar }: {
  s: StoredTourSession;
  toursById: Record<string, Tour>;
  corrections: Record<string, DetectiveCorrection>;
  onSaved: () => void;
  onToggleStar: (id: string, starred: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const tour = toursById[s.tourId];
  const acts = actsOf(tour);
  const reached = actsReached(s, tour);
  const entries = s.contextEntries || [];
  const hasAnything = buildRows([s], toursById).length > 0;
  const reviewed = entries.filter((e) => corrections[e.id]).length;

  return (
    <div className={`border rounded bg-white ${s.starred ? 'border-amber-400 ring-1 ring-amber-300' : 'border-stone-300'}`}>
      <div className="flex items-stretch">
        <button
          onClick={() => onToggleStar(s.id, !s.starred)}
          className="shrink-0 pl-3 pr-1 flex items-center text-lg leading-none hover:scale-110 transition-transform"
          title={s.starred ? 'Unstar this session' : 'Star this session (mark it as a real explorer run)'}
          aria-pressed={!!s.starred}
        >
          <span className={s.starred ? 'text-amber-500' : 'text-stone-300'}>{s.starred ? '★' : '☆'}</span>
        </button>
        <button onClick={() => setOpen((o) => !o)} className="flex-1 flex items-baseline justify-between gap-3 p-4 text-left hover:bg-stone-50">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              <span className="text-stone-400 mr-1">{open ? '▾' : '▸'}</span>
              {tour?.title || s.tourId}
            </p>
            <p className="text-[10px] text-stone-400 font-mono">
              {s.id} · started {s.startedAt ? new Date(s.startedAt).toLocaleString() : '—'}
              {s.completedAt ? ` · completed ${new Date(s.completedAt).toLocaleString()}` : ' · in progress'}
            </p>
          </div>
          <span className="text-[10px] text-stone-400 shrink-0 text-right">
            {s.completedStops?.length ?? 0} stops · {entries.length} context{entries.length === 1 ? '' : 's'}
            {reviewed > 0 && <span className="ml-1 text-emerald-600">· {reviewed} reviewed</span>}
          </span>
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-stone-100 pt-3">
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
              {acts.map((act, i) => <ActBlock key={act.id} s={s} act={act} index={i} />)}
              <ContextEntriesBlock
                entries={s.detectiveAnswers || []}
                heading="Questions they asked — Detective answers to review / promote"
                sessionId={s.id} tourId={s.tourId} corrections={corrections} onSaved={onSaved}
              />
              <ContextEntriesBlock entries={entries} sessionId={s.id} tourId={s.tourId} corrections={corrections} onSaved={onSaved} />
              <FlatExtras s={s} tour={tour} />
            </div>
          )}
        </div>
      )}
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
  if (s.onboardingHistoryResponse) {
    items.push({ type: 'Onboarding', where: '', question: 'What do you think history is?', response: s.onboardingHistoryResponse });
  }
  if (s.themeQuestionResponse) {
    items.push({ type: 'Theme question', where: '', question: tour?.openingFrame?.themeQuestion || '', response: s.themeQuestionResponse });
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
