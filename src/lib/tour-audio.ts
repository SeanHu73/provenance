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
}

const registrations = new Set<Registration>();

/** Register a clip + its bar. Returns an unregister function for cleanup. */
export function registerTourAudio(audio: HTMLAudioElement, node: HTMLElement): () => void {
  const reg: Registration = { audio, node };
  registrations.add(reg);
  return () => { registrations.delete(reg); };
}

/** Pause any registered clip whose player bar sits inside `section`. */
export function pauseTourAudioWithin(section: Element): void {
  registrations.forEach((reg) => {
    if (section.contains(reg.node) && !reg.audio.paused) {
      try { reg.audio.pause(); } catch { /* ignore */ }
    }
  });
}
