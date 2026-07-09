'use client';

/**
 * Tiny registry linking each playing tour clip (a `new Audio()` object, which
 * lives outside the DOM) to its on-screen player bar. Lets a scroll container
 * pause the audio that belongs to a section the reader has scrolled away from —
 * e.g. the merged FIND/DISCOVER screen stopping FIND's audio when DISCOVER
 * snaps into view, and vice-versa.
 */

interface Registration {
  audio: HTMLAudioElement;
  /** The player bar in the DOM — used to tell which section the audio is in. */
  node: HTMLElement;
  /** Paused *because* its section scrolled out of view while it was playing —
   *  so it should resume (from where it left off) when the section returns. A
   *  clip the reader paused by hand stays paused. */
  autoPaused: boolean;
}

const registrations = new Set<Registration>();

/** Register a clip + its bar. Returns an unregister function for cleanup. */
export function registerTourAudio(audio: HTMLAudioElement, node: HTMLElement): () => void {
  const reg: Registration = { audio, node, autoPaused: false };
  registrations.add(reg);
  return () => { registrations.delete(reg); };
}

/** Pause any playing clip whose player bar sits inside `section`, remembering
 *  it so it can resume when the reader scrolls back. */
export function pauseTourAudioWithin(section: Element): void {
  registrations.forEach((reg) => {
    if (section.contains(reg.node) && !reg.audio.paused) {
      try { reg.audio.pause(); reg.autoPaused = true; } catch { /* ignore */ }
    }
  });
}

/** Resume (from where it left off) any clip inside `section` that we auto-paused
 *  on the way out. Clips paused by hand, or never started, are left alone. */
export function resumeTourAudioWithin(section: Element): void {
  registrations.forEach((reg) => {
    if (section.contains(reg.node) && reg.autoPaused) {
      reg.autoPaused = false;
      reg.audio.play().catch(() => { /* browser may block; leave paused */ });
    }
  });
}
