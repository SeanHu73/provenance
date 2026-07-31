'use client';

/**
 * "Go and look" popup — the optional evidence prompt a designer can attach to a
 * context (`ActContextItem.evidencePrompt`). It appears the moment the learner
 * leaves that context's page, whether they added it to their journal or closed
 * it, so the reading hands straight over to something to find on campus.
 *
 * Deliberately a dead end: one prompt, one way out. Nothing is recorded — it is
 * an invitation to look up from the phone, not another question to answer.
 */

import { motion } from 'framer-motion';
import { LENS_BY_KEY } from '../constants';
import type { PastCategory } from '../types';

interface Props {
  /** The context the prompt belongs to — its title frames what to look for. */
  title: string;
  lens: PastCategory;
  prompt: string;
  onClose: () => void;
}

export default function EvidencePromptOverlay({ title, lens, prompt, onClose }: Props) {
  const colour = LENS_BY_KEY[lens]?.colour ?? 'var(--th-primary)';

  return (
    <motion.div
      className="fixed inset-0 z-[1300] flex items-center justify-center px-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-3xl bg-warm-white shadow-2xl overflow-hidden"
        initial={{ y: 24, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="h-1.5 w-full" style={{ backgroundColor: colour }} />
        <div className="px-6 pt-5 pb-6">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold" style={{ color: colour }}>
            Find the evidence
          </p>
          <p className="mt-1 text-[13px] text-text-muted truncate">{title}</p>
          <p className="mt-4 font-serif text-[19px] leading-relaxed text-text-primary whitespace-pre-line">
            {prompt}
          </p>
          <button
            onClick={onClose}
            className="mt-6 w-full py-3 rounded-xl text-base font-semibold text-warm-white"
            style={{ backgroundColor: colour }}
          >
            Got it
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
