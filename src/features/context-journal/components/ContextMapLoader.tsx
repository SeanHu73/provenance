'use client';

/**
 * Dynamically imports ContextMap with ssr:false so mapbox-gl only ever loads on
 * the Context Journal route (never in the tour bundle). When the Mapbox token is
 * absent we short-circuit to a placeholder and skip loading mapbox altogether.
 */

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type ContextMapType from './ContextMap';

const hasToken = !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const ContextMapDynamic = dynamic(() => import('./ContextMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-sandstone-light/30 animate-pulse" aria-hidden />,
});

export default function ContextMapLoader(props: ComponentProps<typeof ContextMapType>) {
  if (!hasToken) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-sandstone-light/40 text-center px-6">
        <div className="max-w-xs">
          <p className="font-display text-lg text-text-primary mb-1">Map unavailable</p>
          <p className="text-sm text-text-secondary leading-relaxed">
            Set <code className="px-1 rounded bg-black/5">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable the Context Journal map.
          </p>
        </div>
      </div>
    );
  }
  return <ContextMapDynamic {...props} />;
}
