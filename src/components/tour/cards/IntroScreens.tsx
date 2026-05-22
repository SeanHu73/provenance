'use client';

/**
 * Tour introduction screens — a sequence of cards that orient the
 * group before the tour begins. Explains what they'll be doing,
 * how the phone is shared, and what to expect.
 */

import { useState, useEffect } from 'react';
import { Tour } from '@/lib/types';

interface Props {
  tour: Tour;
  onComplete: () => void;
  /** Called with `true` while the screen that cues the footer ? button is shown. */
  onPointAtQuestion?: (show: boolean) => void;
}

const TITLES = ['Welcome', 'How it works', 'Your thinking matters', 'Set Up', 'One last thing'];
const TOTAL = TITLES.length;

const bodyClass = 'text-[21px] leading-relaxed font-serif text-text-primary animate-fade-in';

export default function IntroScreens({ onComplete, onPointAtQuestion }: Props) {
  const [current, setCurrent] = useState(0);
  const [phoneSetup, setPhoneSetup] = useState<'me' | 'everyone' | null>(null);
  const isLast = current === TOTAL - 1;
  // The "Set Up" screen (index 3) needs a phone choice before advancing.
  const canAdvance = current !== 3 || phoneSetup !== null;

  // Cue the footer ? button while the "Your thinking matters" screen (index 2) shows.
  useEffect(() => {
    onPointAtQuestion?.(current === 2);
    return () => onPointAtQuestion?.(false);
  }, [current, onPointAtQuestion]);

  return (
    <div className="animate-fade-in flex flex-col justify-center min-h-full space-y-8 text-center">
      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {TITLES.map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-colors"
            style={{ backgroundColor: i <= current ? 'var(--th-primary)' : 'var(--th-border)' }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4 px-2" key={current}>
        <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold animate-fade-in">
          {TITLES[current]}
        </p>

        {current === 0 && (
          <p className={bodyClass}>
            Learn to see the world like a historian! History is like detective work.
            What you notice and what you ask will shape how you reconstruct the past.
          </p>
        )}

        {current === 1 && (
          <p className={bodyClass}>
            You&apos;ll explore stops on the map. At each one, you&apos;ll be asked to
            find something and examine what you see. You&apos;ll get background that
            helps you think deeper and sometimes a question to discuss together!
          </p>
        )}

        {current === 2 && (
          <>
            <p className={bodyClass}>
              Conversations are critical. We are reconstructing history together.
              Share what you think out loud, build on each other&apos;s ideas, disagree!
            </p>
            <p className={bodyClass}>
              If something makes you curious tap the ? button to ask a question.
              Your questions get saved for you to revisit and they&apos;ll help
              future explorers too!
            </p>
          </>
        )}

        {current === 3 && (
          <>
            <p className={bodyClass}>
              For best experience, we suggest everyone use their own devices.
            </p>
            <p className="text-[20px] font-semibold text-text-primary">
              Who has a phone?
            </p>
            <div className="flex gap-3 justify-center">
              {(['me', 'everyone'] as const).map((opt) => {
                const selected = phoneSetup === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setPhoneSetup(opt)}
                    className="px-5 py-2.5 rounded-lg text-base font-semibold border-2 transition-colors"
                    style={
                      selected
                        ? { background: 'var(--th-primary)', color: 'var(--th-surface)', borderColor: 'var(--th-primary)' }
                        : { background: 'transparent', color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }
                    }
                  >
                    {opt === 'me' ? 'Only Me' : 'Everyone'}
                  </button>
                );
              })}
            </div>
            {phoneSetup === 'me' && (
              <p className="text-[18px] leading-relaxed font-serif text-text-secondary animate-fade-in">
                When you see information and questions, read them aloud to each
                other &mdash; or play the audio. Be respectful when you&apos;re indoors!
              </p>
            )}
            {phoneSetup === 'everyone' && (
              <p className="text-[18px] leading-relaxed font-serif text-text-secondary animate-fade-in">
                We suggest everyone use earphones, especially indoors. You can also
                read the information to each other.
              </p>
            )}
          </>
        )}

        {current === 4 && (
          <>
            <p className="text-[23px] font-semibold text-text-primary animate-fade-in">
              Don&apos;t forget to look up!
            </p>
            <p className={bodyClass}>
              This phone is just a guide to help you see more and think together.
              The real experience is the place you&apos;re standing in.
            </p>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="space-y-3">
        <button
          onClick={isLast ? onComplete : () => setCurrent(current + 1)}
          disabled={!canAdvance}
          className="w-full py-3 rounded-lg text-base font-semibold bg-aged-gold text-white transition-opacity disabled:opacity-40"
        >
          {isLast ? 'Begin' : 'Next'}
        </button>
        {!isLast && (
          <button
            onClick={onComplete}
            className="text-xs text-text-secondary/50 hover:text-text-secondary transition-colors"
          >
            Skip introduction
          </button>
        )}
      </div>
    </div>
  );
}
