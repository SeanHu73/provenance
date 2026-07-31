'use client';

/**
 * Which way the phone is pointing, in degrees clockwise from true north.
 *
 * A dot on a map says where you are; it does not say which way to turn, and
 * "which way do I turn" is the actual question someone standing on a path with a
 * phone is asking. So the dot gets a cone.
 *
 * Three complications, all of them real on the devices this runs on:
 *
 * **iOS asks permission, and only from a gesture.** Safari gates the sensor
 * behind `requestPermission()`, which throws unless it is called during a user
 * interaction. There is no way to poll for it, so `requestHeading()` is exported
 * separately and wired to a button the learner already presses.
 *
 * **The two events disagree.** Safari gives `webkitCompassHeading`, already
 * measured clockwise from north. Everyone else gives `alpha` from
 * `deviceorientationabsolute`, measured *anticlockwise*. Reading one as the other
 * points the cone at its own mirror image.
 *
 * **Rotating the phone rotates the reading.** The sensor is fixed to the device,
 * not the screen, so a landscape phone reports a heading 90° off what the map is
 * showing until the screen angle is subtracted back out.
 */

import { useEffect, useState } from 'react';

type OrientationEventish = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

/** Ask iOS for the sensor. Must be called from inside a user gesture; a no-op
 *  everywhere else, where the events simply fire. Resolves true if readings can
 *  be expected. */
export async function requestHeading(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const anyDOE = window.DeviceOrientationEvent as unknown as
    { requestPermission?: () => Promise<'granted' | 'denied'> } | undefined;
  if (!anyDOE) return false;
  if (typeof anyDOE.requestPermission !== 'function') return true;
  try {
    return (await anyDOE.requestPermission()) === 'granted';
  } catch {
    // Called outside a gesture, or refused. Either way there is no heading, and
    // the map is still perfectly usable without one.
    return false;
  }
}

function screenAngle(): number {
  if (typeof window === 'undefined') return 0;
  const o = window.screen?.orientation;
  return typeof o?.angle === 'number' ? o.angle : 0;
}

/**
 * Degrees clockwise from north, or null when the device cannot say.
 *
 * Smoothed, because a raw magnetometer jitters by several degrees at rest and a
 * cone that twitches reads as broken. Circular interpolation, so the short way
 * round 360°/0° is taken and the cone does not spin the long way when the
 * learner turns north.
 */
export function useDeviceHeading(): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) return;
    let raf = 0;
    let latest: number | null = null;
    let shown: number | null = null;

    const onOrient = (e: Event) => {
      const ev = e as OrientationEventish;
      let deg: number | null = null;
      if (typeof ev.webkitCompassHeading === 'number' && !Number.isNaN(ev.webkitCompassHeading)) {
        // Safari: already clockwise from north.
        deg = ev.webkitCompassHeading;
      } else if (ev.absolute && typeof ev.alpha === 'number' && !Number.isNaN(ev.alpha)) {
        // Everyone else: alpha runs anticlockwise, so it has to be flipped.
        deg = 360 - ev.alpha;
      }
      if (deg === null) return;
      latest = (deg + screenAngle() + 360) % 360;
    };

    const tick = () => {
      if (latest !== null) {
        if (shown === null) {
          shown = latest;
        } else {
          // Shortest angular path, so 359° → 1° moves two degrees, not 358.
          let delta = ((latest - shown + 540) % 360) - 180;
          delta *= 0.18;
          shown = (shown + delta + 360) % 360;
        }
        setHeading(shown);
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('deviceorientationabsolute', onOrient, true);
    window.addEventListener('deviceorientation', onOrient, true);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrient, true);
      window.removeEventListener('deviceorientation', onOrient, true);
      cancelAnimationFrame(raf);
    };
  }, []);

  return heading;
}
