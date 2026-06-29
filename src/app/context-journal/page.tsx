import type { Metadata } from 'next';
import ContextJournal from '@/features/context-journal/ContextJournal';

export const metadata: Metadata = {
  title: 'Context Journal · Provenance',
};

/**
 * The Context Journal route. The module is self-contained; Mapbox GL is loaded
 * client-only (ssr:false) from inside the module, so it only ships on this route
 * and never enters the tour bundle. `?tour=<id>` scopes it to a tour.
 */
export default async function ContextJournalPage({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  const sp = await searchParams;
  return <ContextJournal tourId={typeof sp.tour === 'string' ? sp.tour : undefined} />;
}
