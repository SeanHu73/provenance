'use client';

/**
 * Journal overlay — a reference panel that hovers over the tour.
 * Three tabs: Stops (with expandable context + questions), Questions, Your Theory.
 */

import { useState } from 'react';
import { Tour, TourSession } from '@/lib/types';
import { getActiveStops, getGuidedStops, getTourMode } from '@/lib/tours-store';
import PhotoContent from './cards/PhotoContent';
import FullscreenPhoto from './cards/FullscreenPhoto';
import FormattedText from './cards/FormattedText';

type Tab = 'stops' | 'questions' | 'theory';

interface Props {
  tour: Tour;
  session: TourSession;
  onClose: () => void;
  /** When the journal is opened from the closing card to let the
   *  explorer re-read their opening theory, mount on the Your Theory
   *  tab and show a prominent "Return when ready" button at the
   *  bottom. The button is *only* present in this mode — it doesn't
   *  appear on any other journal open. */
  closingPeek?: boolean;
}

type ThumbPhoto = { url: string; thumbnailFocalPoint?: { x: number; y: number } };

function getStopThumbnailPhoto(stop: Tour['stops'][number]): ThumbPhoto | null {
  const np = (stop.notice.photos || []).find(p => p.url);
  if (np) return np;
  if (stop.notice.photoUrl) return { url: stop.notice.photoUrl };
  const sp = (stop.seed.photos || []).find(p => p.url);
  if (sp) return sp;
  if (stop.seed.photoUrl) return { url: stop.seed.photoUrl };
  return null;
}

export default function JournalOverlay({ tour, session, onClose, closingPeek = false }: Props) {
  const [tab, setTab] = useState<Tab>(closingPeek ? 'theory' : 'stops');
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; caption: string | null } | null>(null);

  const completedIds = new Set(session.completedStops);
  const currentIdx = session.currentStopIndex;
  // Match the current stop by id, not array index — the displayed list may drop
  // post-tour "additional" stops, which would shift indices.
  const currentStopId = getActiveStops(tour)[currentIdx]?.id;
  const isContext = getTourMode(tour) === 'context';

  // Context mode renames "Your Theory" → "Your Responses" and drops the
  // Inquiries (Questions) tab.
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'stops', label: 'Stops' },
    ...(isContext ? [] : [{ id: 'questions' as Tab, label: `Questions${session.bankedQuestions.length > 0 ? ` (${session.bankedQuestions.length})` : ''}` }]),
    { id: 'theory', label: isContext ? 'Your Responses' : 'Your Theory' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-warm-white rounded-t-2xl shadow-2xl animate-slide-up flex flex-col"
        style={{ height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
          <h3 className="text-base font-semibold text-text-primary">Journal</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:bg-sandstone-light/30 text-lg">&times;</button>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex border-b" style={{ borderColor: 'var(--th-border)' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                tab === t.id
                  ? 'text-aged-gold border-b-2 border-aged-gold'
                  : 'text-text-secondary/60 hover:text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── Stops tab ── */}
          {tab === 'stops' && (
            <div className="space-y-3">
              {(() => {
                type StopEntry = { stop: Tour['stops'][number]; i: number };
                let stopsToShow: StopEntry[];
                const activeStops = getActiveStops(tour);
                if (tour.unstructuredMode) {
                  const order: string[] = session.completionOrder || [];
                  const nonStopPhases = ['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional',
                    'eq_closing_discuss', 'eq_closing', 'eq_closing_additional', 'eq_final_reflect', 'eq_questions', 'end',
                    'unstructured_map', 'midway_checkin'];
                  const isInStopPhase = !nonStopPhases.includes(session.currentPhase);
                  const usedIndices = new Set<number>();
                  const orderedEntries: StopEntry[] = [];
                  // Completed stops in visit order (completionOrder has logical/leader IDs)
                  for (const logicalId of order) {
                    const leaderIdx = activeStops.findIndex(s => s.id === logicalId);
                    if (leaderIdx < 0) continue;
                    const group = activeStops[leaderIdx].mergeGroup;
                    if (group) {
                      activeStops.forEach((s, j) => {
                        if (s.mergeGroup === group && !usedIndices.has(j)) {
                          orderedEntries.push({ stop: s, i: j });
                          usedIndices.add(j);
                        }
                      });
                    } else if (!usedIndices.has(leaderIdx)) {
                      orderedEntries.push({ stop: activeStops[leaderIdx], i: leaderIdx });
                      usedIndices.add(leaderIdx);
                    }
                  }
                  // Current stop (if visiting) appears right after completed
                  if (isInStopPhase && session.currentStopIndex >= 0 && !usedIndices.has(session.currentStopIndex)) {
                    orderedEntries.push({ stop: activeStops[session.currentStopIndex], i: session.currentStopIndex });
                    usedIndices.add(session.currentStopIndex);
                  }
                  // Remaining in authored order
                  const remainingEntries: StopEntry[] = activeStops
                    .map((s, j) => ({ stop: s, i: j }))
                    .filter(({ i: j }) => !usedIndices.has(j));
                  stopsToShow = [...orderedEntries, ...remainingEntries];
                } else {
                  // Guided stops only — post-tour "additional" stops stay out of
                  // the in-tour Stops list and renumber cleanly.
                  stopsToShow = getGuidedStops(tour).map((stop, i) => ({ stop, i }));
                }
                return stopsToShow.map(({ stop, i }) => {
                const isCompleted = completedIds.has(stop.id);
                const isInStop = !['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional',
                  'eq_closing_discuss', 'eq_closing', 'eq_closing_additional', 'eq_final_reflect', 'eq_questions', 'end',
                  'unstructured_map', 'midway_checkin'].includes(session.currentPhase);
                const isCurrent = stop.id === currentStopId && isInStop;
                const isUpcoming = !isCompleted && !isCurrent;
                const isExpanded = expandedStopId === stop.id;
                const thumbPhoto = getStopThumbnailPhoto(stop);

                // Visit-order number for unstructured mode
                let visitNum: number | null = null;
                if (tour.unstructuredMode) {
                  const order = session.completionOrder || [];
                  const logicalId = stop.mergeGroup
                    ? (activeStops.find(s => s.mergeGroup === stop.mergeGroup)?.id ?? stop.id)
                    : stop.id;
                  const posInOrder = order.indexOf(logicalId);
                  if (posInOrder >= 0) visitNum = posInOrder + 1;
                  else if (isCurrent) visitNum = order.length + 1;
                }
                const stopLabel = (tour.unstructuredMode && visitNum) ? `Stop ${visitNum}` : `Stop ${i + 1}`;

                // Questions asked at this stop
                const stopQuestions = session.bankedQuestions.filter((q) => q.askedAfterStopId === stop.id);

                return (
                  <div key={stop.id} className={`rounded-xl border overflow-hidden ${
                    isCurrent ? 'border-aged-gold' : isCompleted ? 'border-sandstone-light' : 'border-sandstone-light/40'
                  }`}>
                    {/* Stop header */}
                    <button
                      onClick={() => !isUpcoming && setExpandedStopId(isExpanded ? null : stop.id)}
                      className="w-full flex items-center gap-3 p-3 text-left"
                      disabled={isUpcoming}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-sandstone-light/20 shrink-0">
                        {!isUpcoming && thumbPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbPhoto.url}
                            alt=""
                            className="w-full h-full object-cover"
                            style={thumbPhoto.thumbnailFocalPoint
                              ? { objectPosition: `${thumbPhoto.thumbnailFocalPoint.x}% ${thumbPhoto.thumbnailFocalPoint.y}%` }
                              : undefined}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sandstone-light">
                            {!tour.unstructuredMode && <span className="text-sm font-bold">{i + 1}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isUpcoming ? 'text-text-secondary/40' : isCurrent ? 'text-aged-gold' : 'text-text-primary'}`}>
                          {isUpcoming
                            ? (tour.unstructuredMode ? 'Upcoming' : stopLabel)
                            : (stop.title || stopLabel)}
                        </p>
                        <p className="text-[10px] text-text-secondary">
                          {isCurrent ? 'In progress' : isCompleted ? 'Completed' : 'Upcoming'}
                        </p>
                      </div>
                      {!isUpcoming && (
                        <span className="text-xs text-text-secondary/50">{isExpanded ? '▼' : '▶'}</span>
                      )}
                    </button>

                    {/* Expanded content */}
                    {isExpanded && !isUpcoming && (
                      <div className="px-4 pb-4 space-y-4 border-t border-sandstone-light/30 pt-3 animate-fade-in">
                        {/* Questions at this stop */}
                        {stopQuestions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] text-question-red uppercase tracking-wide font-semibold">Your questions at this stop</p>
                            {stopQuestions.map((q) => (
                              <div key={q.id} className="p-2 rounded-lg bg-question-red/5 border border-question-red/10">
                                <p className="text-xs font-serif text-text-primary">&ldquo;{q.questionText}&rdquo;</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Main reveal — using PhotoContent for proper [photo:N] rendering */}
                        {stop.reveal.text && (
                          <div className="space-y-2">
                            <p className="text-[10px] text-aged-gold uppercase tracking-wide font-semibold">Context</p>
                            <PhotoContent
                              text={stop.reveal.text}
                              photos={stop.reveal.photos || []}
                              legacyPhotoUrl={stop.reveal.photoUrl}
                              legacyPhotoCaption={stop.reveal.photoCaption}
                              textClass="text-sm font-serif text-text-primary leading-relaxed"
                              borderColor="var(--th-primary)"
                            />
                          </div>
                        )}

                        {/* Extra round reveals */}
                        {(stop.extraRounds || []).map((round, ri) => (
                          round.reveal && round.reveal.text ? (
                            <div key={ri} className="space-y-2">
                              <p className="text-[10px] text-aged-gold uppercase tracking-wide font-semibold">Context (continued)</p>
                              <PhotoContent
                                text={round.reveal.text}
                                photos={round.reveal.photos || []}
                                textClass="text-sm font-serif text-text-primary leading-relaxed"
                                borderColor="var(--th-primary)"
                              />
                            </div>
                          ) : null
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
              })()}
            </div>
          )}

          {/* ── Questions tab ── */}
          {tab === 'questions' && (
            <div className="space-y-3">
              {session.bankedQuestions.length === 0 ? (
                <p className="text-sm text-text-secondary italic text-center py-8">
                  No questions yet. Tap the ? button to ask one.
                </p>
              ) : (
                session.bankedQuestions.map((q) => {
                  const stop = getActiveStops(tour).find((s) => s.id === q.askedAfterStopId);
                  return (
                    <div key={q.id} className="p-3 rounded-lg bg-white border border-sandstone-light">
                      <p className="text-sm font-serif text-text-primary">&ldquo;{q.questionText}&rdquo;</p>
                      <p className="text-[10px] text-text-secondary mt-1">
                        {stop ? `At: ${stop.title || 'Stop'}` : ''} &middot; {q.aiResponse === 'coming_up' ? 'Coming up' : q.aiResponse === 'answered_off_path' ? 'Answered' : 'Saved'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Your Responses tab (context mode) ── */}
          {tab === 'theory' && isContext && (
            <div className="space-y-4">
              {(() => {
                const actBlocks = (tour.acts || []).map((act, i) => {
                  const resp = session.actResponses?.[act.id];
                  const opening = act.openingQuestion?.prompt;
                  const closing = act.closingQuestion?.prompt;
                  if (!opening && !closing) return null;
                  return (
                    <div key={act.id} className="p-4 rounded-xl bg-white border border-sandstone-light space-y-3">
                      <p className="text-[10px] text-aged-gold uppercase tracking-wide font-semibold">{act.title || `Act ${i + 1}`}</p>
                      {opening && (
                        <div>
                          <p className="text-sm font-serif font-semibold text-text-primary">&ldquo;<FormattedText text={opening} />&rdquo;</p>
                          <p className="text-[10px] text-text-secondary uppercase tracking-wide mt-1">Your response</p>
                          <p className="text-sm font-serif text-text-primary mt-0.5">
                            {resp?.opening?.trim() || <span className="italic text-text-secondary/60">No response recorded</span>}
                          </p>
                        </div>
                      )}
                      {closing && (
                        <div>
                          <p className="text-sm font-serif font-semibold text-text-primary">&ldquo;<FormattedText text={closing} />&rdquo;</p>
                          <p className="text-[10px] text-text-secondary uppercase tracking-wide mt-1">Your response</p>
                          <p className="text-sm font-serif text-text-primary mt-0.5">
                            {resp?.closing?.trim() || <span className="italic text-text-secondary/60">No response recorded</span>}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                }).filter(Boolean);

                if (actBlocks.length === 0 && session.reflections.length === 0) {
                  return (
                    <p className="text-sm text-text-secondary italic text-center py-8">
                      Your responses will appear here as you progress through the tour.
                    </p>
                  );
                }
                return actBlocks;
              })()}

              {/* Per-stop reflections */}
              {session.reflections.map((r, i) => {
                const stop = getActiveStops(tour).find((s) => s.id === r.stopId);
                return (
                  <div key={i} className="p-3 rounded-lg bg-white border border-sandstone-light">
                    <p className="text-xs font-semibold text-text-primary">{stop?.title || `Stop ${i + 1}`}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-sandstone-light rounded-full">
                        <div className="h-full bg-aged-gold rounded-full" style={{ width: `${Math.max(r.sliderValue, 0) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-text-secondary">
                        {r.sliderValue < 0 ? 'Skipped' : r.sliderValue < 0.3 ? 'Confirmed' : r.sliderValue > 0.7 ? 'Shifted' : 'Somewhat'}
                      </span>
                    </div>
                    {r.followUpResponse && r.followUpResponse !== 'skipped' && (
                      <p className="text-[10px] text-text-secondary mt-1 italic">{r.followUpResponse}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Your Theory tab (linear / unstructured) ── */}
          {tab === 'theory' && !isContext && (
            <div className="space-y-4">
              {/* Essential question responses */}
              {session.essentialQuestionResponses && tour.essentialQuestion && (
                <div className="p-4 rounded-xl bg-white border border-sandstone-light space-y-3">
                  <p className="text-[10px] text-aged-gold uppercase tracking-wide font-semibold">Discussion Question</p>
                  <p className="text-sm font-serif font-semibold text-text-primary">
                    &ldquo;<FormattedText text={tour.essentialQuestion.question} />&rdquo;
                  </p>
                  {session.essentialQuestionResponses.initialTheory && (
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase tracking-wide">Your initial theory</p>
                      <p className="text-sm font-serif text-text-primary mt-0.5">
                        {session.essentialQuestionResponses.initialTheory}
                      </p>
                    </div>
                  )}
                  {session.essentialQuestionResponses.initialReasoning && (
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase tracking-wide">Your reasoning</p>
                      <p className="text-sm font-serif text-text-primary mt-0.5">
                        {session.essentialQuestionResponses.initialReasoning}
                      </p>
                    </div>
                  )}
                  {session.essentialQuestionResponses.finalReflection && (
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase tracking-wide">Your final reflection</p>
                      <p className="text-sm font-serif text-text-primary mt-0.5">
                        {session.essentialQuestionResponses.finalReflection}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Per-stop reflections */}
              {session.reflections.length > 0 ? (
                session.reflections.map((r, i) => {
                  const stop = getActiveStops(tour).find((s) => s.id === r.stopId);
                  return (
                    <div key={i} className="p-3 rounded-lg bg-white border border-sandstone-light">
                      <p className="text-xs font-semibold text-text-primary">{stop?.title || `Stop ${i + 1}`}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-sandstone-light rounded-full">
                          <div className="h-full bg-aged-gold rounded-full" style={{ width: `${Math.max(r.sliderValue, 0) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-text-secondary">
                          {r.sliderValue < 0 ? 'Skipped' : r.sliderValue < 0.3 ? 'Confirmed' : r.sliderValue > 0.7 ? 'Shifted' : 'Somewhat'}
                        </span>
                      </div>
                      {r.followUpResponse && r.followUpResponse !== 'skipped' && (
                        <p className="text-[10px] text-text-secondary mt-1 italic">{r.followUpResponse}</p>
                      )}
                    </div>
                  );
                })
              ) : (
                !session.essentialQuestionResponses && (
                  <p className="text-sm text-text-secondary italic text-center py-8">
                    Your responses will appear here as you progress through the tour.
                  </p>
                )
              )}
            </div>
          )}
        </div>

        {/* "Return when ready" — only present when the journal was
            opened from the closing card to let the explorer re-read
            their opening theory. Not shown on any other open. */}
        {closingPeek && (
          <div className="shrink-0 px-5 py-3 border-t" style={{ borderColor: 'var(--th-border)' }}>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-lg text-base font-semibold text-warm-white"
              style={{ backgroundColor: 'var(--th-primary)' }}
            >
              Return when ready
            </button>
          </div>
        )}
      </div>

      {fullscreenPhoto && (
        <FullscreenPhoto url={fullscreenPhoto.url} caption={fullscreenPhoto.caption} onClose={() => setFullscreenPhoto(null)} />
      )}
    </div>
  );
}
