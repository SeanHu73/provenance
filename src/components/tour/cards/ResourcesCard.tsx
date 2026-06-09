'use client';

/**
 * Context-Prototype — Suggested Resources, shown at the very end of the tour
 * (before the end card). Lists approved resources (curated + community) with
 * photos and hyperlinked links, and lets explorers submit their own
 * (photos / links included) for moderation.
 */

import { useEffect, useState } from 'react';
import { useTour } from '@/context/TourContext';
import { ForumResource, ResourceLink } from '@/lib/types';
import { getApprovedResources, submitUserResource, uploadCommunityPhoto, getForumIdentity } from '@/lib/community-store';

interface Props {
  onComplete: () => void;
}

export default function ResourcesCard({ onComplete }: Props) {
  const { tour, session } = useTour();
  const [resources, setResources] = useState<ForumResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!tour) return;
    getApprovedResources(tour.id).then((rs) => { setResources(rs); setLoading(false); });
  }, [tour]);

  return (
    <div className="animate-fade-in min-h-full py-2 space-y-6">
      <div>
        <p className="uppercase tracking-[0.12em] font-display font-semibold leading-tight" style={{ fontSize: 30, color: 'var(--th-primary)' }}>
          Suggested Resources
        </p>
        <p className="mt-1 text-text-secondary" style={{ fontSize: 'clamp(16px, 4.5vw, 19px)' }}>
          Keep exploring — and share anything you&apos;d recommend.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-7 h-7 border-2 border-aged-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : resources.length === 0 ? (
        <p className="text-sm text-text-secondary italic">No resources yet — be the first to suggest one below.</p>
      ) : (
        <div className="space-y-4">
          {resources.map((r) => (
            <ResourceView key={r.id} resource={r} />
          ))}
        </div>
      )}

      {/* Submit your own */}
      <div className="rounded-xl bg-sandstone/40 border border-sandstone-light p-4">
        {adding ? (
          <ResourceComposer
            onSubmit={async (input) => {
              if (!tour || !session) return;
              await submitUserResource({
                tourId: tour.id,
                ...input,
                sessionId: session.id,
                name: getForumIdentity()?.name,
              });
            }}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full py-3 rounded-lg text-base font-semibold text-white bg-aged-gold hover:bg-aged-gold-light transition-colors"
          >
            + Submit Resources
          </button>
        )}
      </div>

      <button onClick={onComplete} className="w-full py-3 rounded-lg text-base font-semibold bg-olive text-white">
        Finish
      </button>
    </div>
  );
}

function ResourceView({ resource }: { resource: ForumResource }) {
  return (
    <div className="rounded-xl bg-white border border-sandstone-light p-4 space-y-2">
      <p className="font-display font-bold text-text-primary" style={{ fontSize: 'clamp(19px, 4.5vw, 24px)' }}>{resource.title}</p>
      {resource.description && (
        <p className="text-[16px] font-serif text-text-primary leading-relaxed">{resource.description}</p>
      )}
      {resource.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {resource.photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="w-full h-28 object-cover rounded-lg border border-sandstone-light" />
          ))}
        </div>
      )}
      {resource.links.length > 0 && (
        <div className="space-y-1">
          {resource.links.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="block text-[16px] font-semibold text-aged-gold underline break-words">
              {l.label || l.url}
            </a>
          ))}
        </div>
      )}
      {resource.source === 'user' && resource.name && (
        <p className="text-[11px] text-text-secondary">— {resource.name}</p>
      )}
    </div>
  );
}

function ResourceComposer({
  onSubmit,
}: {
  onSubmit: (input: { title: string; description: string; photos: string[]; links: ResourceLink[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [links, setLinks] = useState<ResourceLink[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const addLink = () => setLinks((ls) => [...ls, { label: '', url: '' }]);
  const updateLink = (i: number, patch: Partial<ResourceLink>) => setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLink = (i: number) => setLinks((ls) => ls.filter((_, j) => j !== i));

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCommunityPhoto(file);
      setPhotos((p) => [...p, url]);
    } catch { /* ignore */ }
    setUploading(false);
  };

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      photos,
      links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    });
    setBusy(false);
    setDone(true);
  };

  if (done) return <p className="text-sm text-olive font-semibold">&#10003; Submitted for review. Thanks!</p>;

  return (
    <div className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Resource title"
        className="w-full px-4 py-2.5 rounded-lg text-[18px] font-serif text-text-primary placeholder:text-text-secondary/40 border-2 border-sandstone-light bg-white focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Why is it worth a look? (optional)"
        rows={2}
        className="w-full px-4 py-2.5 rounded-lg text-[17px] font-serif text-text-primary placeholder:text-text-secondary/40 border-2 border-sandstone-light bg-white focus:outline-none"
      />

      {/* Photos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-20 object-cover rounded-lg border border-sandstone-light" />
              <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs">×</button>
            </div>
          ))}
        </div>
      )}
      <label className="inline-block px-3 py-2 rounded-lg bg-sandstone-light text-journal text-sm font-semibold cursor-pointer hover:bg-sandstone-light/70">
        {uploading ? 'Uploading…' : '+ Add photo'}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
      </label>

      {/* Links */}
      {links.map((l, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input value={l.label} onChange={(e) => updateLink(i, { label: e.target.value })} placeholder="Label" className="w-1/3 px-3 py-2 rounded-lg text-sm border-2 border-sandstone-light bg-white focus:outline-none" />
          <input value={l.url} onChange={(e) => updateLink(i, { url: e.target.value })} placeholder="https://…" className="flex-1 px-3 py-2 rounded-lg text-sm border-2 border-sandstone-light bg-white focus:outline-none" />
          <button onClick={() => removeLink(i)} className="text-red-600 text-lg px-1">×</button>
        </div>
      ))}
      <button onClick={addLink} className="text-sm font-semibold text-aged-gold">+ Add link</button>

      <button
        onClick={submit}
        disabled={!title.trim() || busy}
        className="w-full py-3 rounded-lg text-base font-semibold bg-aged-gold text-white disabled:opacity-40"
      >
        Submit resource
      </button>
    </div>
  );
}
