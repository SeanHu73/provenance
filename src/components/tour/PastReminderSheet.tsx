'use client';

/**
 * "Remind me of the P.A.S.T." — the four lenses, on demand.
 *
 * Deliberately *not* a jump back to the Context step that teaches them. Wanting
 * to check what the S stands for is not the same as wanting to redo a stage of
 * the tour, and sending someone backwards through the flow to answer a small
 * question loses their place. This pulls the same panel up over whatever they
 * were doing and puts them back when they close it.
 *
 * Reuses PastFramework (the exact panel from the teaching step) rather than a
 * second copy of the lenses, so the two can never drift apart — but starts it
 * revealed, since the tap-to-unveil is a first-meeting device.
 *
 * Sits at z-[1290], just under PastLensCard's 1300, so tapping a magnifier still
 * opens the example questions on top of this sheet.
 */

import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import PastFramework from '@/components/onboarding/PastFramework';
import { CloseIcon } from '@/components/icons';

export default function PastReminderSheet({ onClose }: { onClose: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[1290] flex flex-col"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label="The P.A.S.T. lenses"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        className="relative mt-auto w-full max-w-lg mx-auto rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--th-bg)', maxHeight: '92vh' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
          <div className="flex-1 min-w-0">
            <p className="font-display leading-tight" style={{ fontSize: 22, color: 'var(--th-primary)' }}>
              The P.A.S.T.
            </p>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              The four lenses for recreating a context.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <PastFramework startRevealed />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
