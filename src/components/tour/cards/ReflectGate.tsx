'use client';

/**
 * Guards the Reflect screen while a background Context Detective search is still
 * running, so a learner doesn't accidentally leave their question behind. It
 * offers to wait (go back to keep exploring) or to cancel the search and reflect.
 */

import { useResearchJobs, cancelJob, isPending } from '@/features/context-journal/research-store';
import { useTour } from '@/context/TourContext';
import { useDevJumpOn } from '@/lib/dev-jump';

export default function ReflectGate({ tourId, children }: { tourId: string; children: React.ReactNode }) {
  const jobs = useResearchJobs();
  const { goBack, canGoBack } = useTour();
  // Dev Jump walks straight through: an admin jumping to Reflect doesn't care that
  // a search is still running, and the wait screen would just block inspection.
  const devJump = useDevJumpOn();
  const pending = jobs.filter((j) => j.tourId === tourId && isPending(j));
  if (pending.length === 0 || devJump) return <>{children}</>;

  return (
    <div className="animate-fade-in min-h-full flex flex-col justify-center gap-6 px-2 text-center">
      <div>
        <div className="w-10 h-10 mx-auto mb-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--th-primary)', borderTopColor: 'transparent' }} />
        <h3 className="font-display font-bold text-[23px] leading-tight" style={{ color: 'var(--th-primary)' }}>
          {pending.length > 1 ? `${pending.length} questions are still being researched` : 'A question is still being researched'}
        </h3>
        <p className="mt-2 text-[15px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
          We&apos;ll let you know the moment it&apos;s ready. You can keep exploring while you wait, or cancel the search to move on to Reflect.
        </p>
      </div>
      <div className="space-y-2.5">
        {canGoBack && (
          <button onClick={goBack} className="w-full py-3.5 rounded-xl text-base font-semibold text-white" style={{ backgroundColor: 'var(--th-primary)' }}>
            Wait for my answer
          </button>
        )}
        <button
          onClick={() => pending.forEach((j) => cancelJob(j.id))}
          className="w-full py-3 rounded-xl text-[15px] font-semibold border-2"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--th-border)' }}
        >
          Cancel search &amp; reflect
        </button>
      </div>
    </div>
  );
}
