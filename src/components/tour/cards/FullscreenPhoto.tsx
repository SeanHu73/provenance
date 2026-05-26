'use client';

/**
 * Fullscreen photo viewer — mobile-first.
 * Uses a portal-like approach: renders into a brand new fixed div
 * that covers everything. Close via bottom button or swipe down.
 * Pinch-to-zoom via native browser behavior (no JS transforms).
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PhotoOverlay } from '@/lib/types';
import PhotoAnnotations from './PhotoAnnotations';

interface Props {
  url: string;
  caption: string | null;
  onClose: () => void;
  overlays?: PhotoOverlay[];
}

function FullscreenOverlay({ url, caption, onClose, overlays }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 99999,
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Image area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Inline-block wrapper auto-sizes to the rendered image so the
            annotation overlay tracks the image edges exactly, regardless
            of the image's intrinsic aspect ratio. */}
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={caption || ''}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
            draggable={false}
          />
          <PhotoAnnotations overlays={overlays} />
        </div>
      </div>

      {/* Bottom close bar */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0,0,0,0.9)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {caption && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {caption}
            </p>
          )}
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Pinch to zoom</p>
        </div>
        <button
          onClick={onClose}
          style={{
            flexShrink: 0,
            marginLeft: 12,
            padding: '8px 20px',
            borderRadius: 9999,
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function FullscreenPhoto(props: Props) {
  // Portal to document.body so it escapes any parent overflow/transform/z-index
  if (typeof document === 'undefined') return null;
  return createPortal(<FullscreenOverlay {...props} />, document.body);
}
