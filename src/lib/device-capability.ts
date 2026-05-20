/**
 * Detect device capability for GPU-intensive effects.
 * Run once on app init. Low-end devices get a simpler overlay
 * instead of backdrop-filter: blur.
 */

export function canUseBlur(): boolean {
  if (typeof window === 'undefined') return true;

  // Check CSS support
  if (!CSS.supports('backdrop-filter', 'blur(12px)') &&
      !CSS.supports('-webkit-backdrop-filter', 'blur(12px)')) {
    return false;
  }

  // Check hardware
  const cores = (navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? 8;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;

  if (cores <= 4 || memory <= 2) return false;

  return true;
}
