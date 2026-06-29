'use client';

import dynamic from 'next/dynamic';

// Mapbox is client-only and route-scoped (never in the app/tour bundle).
const MapPreview = dynamic(() => import('@/components/admin/MapPreview'), {
  ssr: false,
  loading: () => <div className="w-full h-screen flex items-center justify-center text-stone-500">Loading 3D preview…</div>,
});

export default function MapPreviewPage() {
  return <MapPreview />;
}
