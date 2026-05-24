'use client';

/**
 * Full-screen closing sequence for unstructured tours.
 * Rendered by HomeInner in document flow (not inside Journal),
 * giving the same "takes over the screen" feel as the midway check-in.
 */

import { useTour } from '@/context/TourContext';
import EqClosingCard from './EqClosingCard';
import EqFinalReflectCard from './EqFinalReflectCard';
import EqQuestionsCard from './EqQuestionsCard';
import GuideOutroCard from './GuideOutroCard';
import EndCard from './EndCard';

export default function UnstructuredClosingView() {
  const {
    tour,
    session,
    completeEqClosing,
    completeEqFinalReflect,
    completeGuideOutro,
  } = useTour();

  if (!tour || !session) return null;
  const phase = session.currentPhase;

  return (
    <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: 'var(--th-surface)' }}>
      <div className="min-h-full rounded-2xl bg-warm-white shadow-lg px-5 py-6">
        {(phase === 'eq_closing_discuss' || phase === 'eq_closing') && tour.essentialQuestion && (
          <EqClosingCard tour={tour} session={session} onComplete={completeEqClosing} />
        )}
        {phase === 'eq_final_reflect' && (
          <EqFinalReflectCard onComplete={completeEqFinalReflect} />
        )}
        {phase === 'eq_questions' && (
          <EqQuestionsCard />
        )}
        {phase === 'guide_outro' && (
          <GuideOutroCard tour={tour} onContinue={completeGuideOutro} />
        )}
        {phase === 'end' && (
          <EndCard />
        )}
      </div>
    </div>
  );
}
