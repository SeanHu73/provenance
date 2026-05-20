'use client';

/**
 * Journal overlay — a reference panel that hovers over the tour.
 * Three tabs: Stops (with expandable context), Questions, Your Responses.
 */

import { useState } from 'react';
import { Tour, TourSession } from '@/lib/types';
import FormattedText from './cards/FormattedText';
import FullscreenPhoto from './cards/FullscreenPhoto';

type Tab = 'stops' | 'questions' | 'responses';

interface Props {
  tour: Tour;
  session: TourSession;
  onClose: () => void;
}

export default function JournalOverlay({ tour, session, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('stops');
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; caption: string | null } | null>(null);

  const completedIds = new Set(session.completedStops);
  const currentIdx = session.currentStopIndex;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'stops', label: 'Stops' },
    { id: 'questions', label: `Questions${session.bankedQuestions.length > 0 ? ` (${session.bankedQuestions.length})` : ''}` },
    { id: 'responses', label: 'Your Responses' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-[#FFF8EE] rounded-t-2xl shadow-2xl animate-slide-up flex flex-col"
        style={{ height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: '#D4BFA0' }}>
          <h3 className="text-base font-semibold text-[#2C2418]">Journal</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B5D4F] hover:bg-[#D4BFA0]/30 text-lg">&times;</button>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex border-b" style={{ borderColor: '#D4BFA0' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                tab === t.id
                  ? 'text-[#C4923A] border-b-2 border-[#C4923A]'
                  : 'text-[#6B5D4F]/60 hover:text-[#6B5D4F]'
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
              {tour.stops.map((stop, i) => {
                const isCompleted = completedIds.has(stop.id);
                const isCurrent = i === currentIdx;
                const isUpcoming = !isCompleted && !isCurrent;
                const isExpanded = expandedStopId === stop.id;
                const firstPhoto = (stop.seed.photos || [])[0]?.url || stop.seed.photoUrl || null;

                return (
                  <div key={stop.id} className={`rounded-xl border overflow-hidden ${
                    isCurrent ? 'border-[#C4923A]' : isCompleted ? 'border-[#D4BFA0]' : 'border-[#D4BFA0]/40'
                  }`}>
                    {/* Stop header — always visible */}
                    <button
                      onClick={() => !isUpcoming && setExpandedStopId(isExpanded ? null : stop.id)}
                      className="w-full flex items-center gap-3 p-3 text-left"
                      disabled={isUpcoming}
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#D4BFA0]/20 shrink-0">
                        {!isUpcoming && firstPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={firstPhoto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[#D4BFA0]">{i + 1}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isUpcoming ? 'text-[#6B5D4F]/40' : isCurrent ? 'text-[#C4923A]' : 'text-[#2C2418]'}`}>
                          {isUpcoming ? `Stop ${i + 1}` : (stop.title || `Stop ${i + 1}`)}
                        </p>
                        <p className="text-[10px] text-[#6B5D4F]">
                          {isCurrent ? 'In progress' : isCompleted ? 'Completed' : 'Upcoming'}
                        </p>
                      </div>
                      {!isUpcoming && (
                        <span className="text-xs text-[#6B5D4F]/50">{isExpanded ? '▼' : '▶'}</span>
                      )}
                    </button>

                    {/* Expanded context — shows reveal text */}
                    {isExpanded && !isUpcoming && (
                      <div className="px-4 pb-4 space-y-4 border-t border-[#D4BFA0]/30 pt-3 animate-fade-in">
                        {/* Main reveal */}
                        {stop.reveal.text && (
                          <div className="space-y-2">
                            <p className="text-[10px] text-[#C4923A] uppercase tracking-wide font-semibold">Context</p>
                            <div className="border-l-3 border-[#C4923A] pl-3">
                              <p className="text-sm font-serif text-[#2C2418] leading-relaxed">
                                <FormattedText text={stop.reveal.text} />
                              </p>
                            </div>
                            {/* Reveal photos */}
                            {(stop.reveal.photos || []).filter(p => p.url).map((photo, pi) => (
                              <button key={pi} onClick={() => setFullscreenPhoto(photo)} className="w-full rounded-lg overflow-hidden border border-[#D4BFA0] text-left">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo.url} alt={photo.caption || ''} className="w-full max-h-40 object-contain bg-[#F0E0C8]" />
                                {photo.caption && <p className="text-[10px] text-[#6B5D4F] px-2 py-1 italic">{photo.caption}</p>}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Extra round reveals */}
                        {(stop.extraRounds || []).map((round, ri) => (
                          round.reveal && round.reveal.text ? (
                            <div key={ri} className="space-y-2">
                              <p className="text-[10px] text-[#C4923A] uppercase tracking-wide font-semibold">Context (continued)</p>
                              <div className="border-l-3 border-[#C4923A] pl-3">
                                <p className="text-sm font-serif text-[#2C2418] leading-relaxed">
                                  <FormattedText text={round.reveal.text} />
                                </p>
                              </div>
                              {(round.reveal.photos || []).filter(p => p.url).map((photo, pi) => (
                                <button key={pi} onClick={() => setFullscreenPhoto(photo)} className="w-full rounded-lg overflow-hidden border border-[#D4BFA0] text-left">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={photo.url} alt={photo.caption || ''} className="w-full max-h-40 object-contain bg-[#F0E0C8]" />
                                </button>
                              ))}
                            </div>
                          ) : null
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Questions tab ── */}
          {tab === 'questions' && (
            <div className="space-y-3">
              {session.bankedQuestions.length === 0 ? (
                <p className="text-sm text-[#6B5D4F] italic text-center py-8">
                  No questions yet. Questions you ask during the tour will appear here.
                </p>
              ) : (
                session.bankedQuestions.map((q) => (
                  <div key={q.id} className="p-3 rounded-lg bg-white border border-[#D4BFA0]">
                    <p className="text-sm font-serif text-[#2C2418]">&ldquo;{q.questionText}&rdquo;</p>
                    <p className="text-[10px] text-[#6B5D4F] mt-1">
                      {q.aiResponse === 'coming_up' ? 'Coming up on the tour' : q.aiResponse === 'answered_off_path' ? 'Answered' : 'Saved for later'}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Responses tab ── */}
          {tab === 'responses' && (
            <div className="space-y-4">
              {/* Essential question responses */}
              {session.essentialQuestionResponses && tour.essentialQuestion && (
                <div className="p-4 rounded-xl bg-white border border-[#D4BFA0] space-y-3">
                  <p className="text-[10px] text-[#C4923A] uppercase tracking-wide font-semibold">Guiding Question</p>
                  <p className="text-sm font-serif font-semibold text-[#2C2418]">
                    &ldquo;{tour.essentialQuestion.question}&rdquo;
                  </p>
                  {session.essentialQuestionResponses.initialTheory && (
                    <div>
                      <p className="text-[10px] text-[#6B5D4F] uppercase tracking-wide">Your initial theory</p>
                      <p className="text-sm font-serif text-[#2C2418] mt-0.5">
                        {session.essentialQuestionResponses.initialTheory}
                      </p>
                    </div>
                  )}
                  {session.essentialQuestionResponses.initialReasoning && (
                    <div>
                      <p className="text-[10px] text-[#6B5D4F] uppercase tracking-wide">Your reasoning</p>
                      <p className="text-sm font-serif text-[#2C2418] mt-0.5">
                        {session.essentialQuestionResponses.initialReasoning}
                      </p>
                    </div>
                  )}
                  {session.essentialQuestionResponses.finalReflection && (
                    <div>
                      <p className="text-[10px] text-[#6B5D4F] uppercase tracking-wide">Your final reflection</p>
                      <p className="text-sm font-serif text-[#2C2418] mt-0.5">
                        {session.essentialQuestionResponses.finalReflection}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Per-stop reflections */}
              {session.reflections.length > 0 ? (
                session.reflections.map((r, i) => {
                  const stop = tour.stops.find((s) => s.id === r.stopId);
                  return (
                    <div key={i} className="p-3 rounded-lg bg-white border border-[#D4BFA0]">
                      <p className="text-xs font-semibold text-[#2C2418]">{stop?.title || `Stop ${i + 1}`}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-[#D4BFA0] rounded-full">
                          <div className="h-full bg-[#C4923A] rounded-full" style={{ width: `${Math.max(r.sliderValue, 0) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-[#6B5D4F]">
                          {r.sliderValue < 0 ? 'Skipped' : r.sliderValue < 0.3 ? 'Confirmed' : r.sliderValue > 0.7 ? 'Shifted' : 'Somewhat'}
                        </span>
                      </div>
                      {r.followUpResponse && r.followUpResponse !== 'skipped' && (
                        <p className="text-[10px] text-[#6B5D4F] mt-1 italic">{r.followUpResponse}</p>
                      )}
                    </div>
                  );
                })
              ) : (
                !session.essentialQuestionResponses && (
                  <p className="text-sm text-[#6B5D4F] italic text-center py-8">
                    Your responses will appear here as you progress through the tour.
                  </p>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {fullscreenPhoto && (
        <FullscreenPhoto url={fullscreenPhoto.url} caption={fullscreenPhoto.caption} onClose={() => setFullscreenPhoto(null)} />
      )}
    </div>
  );
}
