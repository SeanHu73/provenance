/**
 * Adapters between the tour's authored contexts (`ActContextItem`, the read-only
 * questions a tour offers) and the Context Journal's `ContextEntry` display shape.
 *
 * This is purely in-memory for rendering — nothing is written to Firestore. The
 * authored item stays the source of truth in the tour; a learner only ever
 * persists their *own* copy when they tap "Add" (carrying `sourceId` back here).
 */

import type { ActContextItem } from '@/lib/types';
import type { ContextEntry, PastCategory } from './types';

/** Adapt a designer-authored ActContextItem into a read-only "question" entry. */
export function authoredToEntry(item: ActContextItem, placeId: string): ContextEntry {
  return {
    id: item.id,
    title: item.title,
    question: item.question ?? '',
    shortSummary: item.shortSummary,
    longExplanation: item.longExplanation,
    pastCategory: item.pastCategory as PastCategory,
    timeRange: item.timeRange,
    geometry: item.geometry,
    camera: item.camera,
    mapType: item.mapType,
    includePlaceTime: item.includePlaceTime,
    unlockAfterContextId: item.unlockAfterContextId,
    evidencePrompt: item.evidencePrompt,
    voiceoverUrl: item.voiceoverUrl,
    voiceoverTitle: item.voiceoverTitle,
    ttsAudioUrl: item.ttsAudioUrl,
    ttsAudioHash: item.ttsAudioHash,
    media: item.media, // ContextMediaItem and ContextMedia share a shape
    thumbnailMediaId: item.thumbnailMediaId,
    sources: item.sources, // ContextSourceItem and ContextSource share a shape
    origin: 'authored',
    placeId,
    createdAt: null,
    updatedAt: null,
  };
}
