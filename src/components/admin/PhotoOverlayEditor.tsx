'use client';

/**
 * Modal editor for adding visual overlays (text labels, outlined circles
 * and rectangles, with colour) on top of a photo. Used from
 * PhotoListEditor to annotate any StopPhoto.
 *
 * Coordinates and sizes are stored as percent of the photo so they
 * scale at runtime regardless of how the photo is displayed.
 */

import { useEffect, useRef, useState } from 'react';
import type { PhotoOverlay } from '@/lib/types';

interface Props {
  photoUrl: string;
  initial: PhotoOverlay[] | undefined;
  onSave: (overlays: PhotoOverlay[]) => void;
  onCancel: () => void;
}

const PRESET_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#A855F7', '#FFFFFF', '#111827'];

function newId() {
  return `ov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

type Tool = 'select' | 'text' | 'circle' | 'rect';

type DragMode =
  | { mode: 'move'; id: string; startX: number; startY: number; origX: number; origY: number }
  | { mode: 'resize'; id: string; startX: number; startY: number; origW: number; origH: number; origX: number; origY: number; corner: 'nw' | 'ne' | 'sw' | 'se' }
  | null;

export default function PhotoOverlayEditor({ photoUrl, initial, onSave, onCancel }: Props) {
  const [overlays, setOverlays] = useState<PhotoOverlay[]>(initial ?? []);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragMode>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  const update = (id: string, patch: Partial<PhotoOverlay>) => {
    setOverlays((cur) =>
      cur.map((o) => (o.id === id ? ({ ...o, ...patch } as PhotoOverlay) : o)),
    );
  };

  const remove = (id: string) => {
    setOverlays((cur) => cur.filter((o) => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const placeOverlayAt = (xPct: number, yPct: number) => {
    if (tool === 'text') {
      const id = newId();
      const next: PhotoOverlay = { id, kind: 'text', x: xPct, y: yPct, text: 'Label', color, fontSize: 18 };
      setOverlays((cur) => [...cur, next]);
      setSelectedId(id);
    } else if (tool === 'circle' || tool === 'rect') {
      const id = newId();
      const w = 18;
      const h = 18;
      const next: PhotoOverlay = {
        id,
        kind: tool,
        x: Math.max(0, Math.min(100 - w, xPct - w / 2)),
        y: Math.max(0, Math.min(100 - h, yPct - h / 2)),
        w,
        h,
        color,
      };
      setOverlays((cur) => [...cur, next]);
      setSelectedId(id);
    }
    setTool('select');
  };

  const stageCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = stageRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool === 'select') return;
    const pt = stageCoords(e.clientX, e.clientY);
    if (!pt) return;
    placeOverlayAt(pt.x, pt.y);
  };

  const handleOverlayPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (tool !== 'select') return;
    setSelectedId(id);
    const o = overlays.find((x) => x.id === id);
    if (!o) return;
    const pt = stageCoords(e.clientX, e.clientY);
    if (!pt) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      mode: 'move',
      id,
      startX: pt.x,
      startY: pt.y,
      origX: o.x,
      origY: o.y,
    });
  };

  const handleResizePointerDown = (e: React.PointerEvent, id: string, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation();
    const o = overlays.find((x) => x.id === id);
    if (!o || o.kind === 'text') return;
    const pt = stageCoords(e.clientX, e.clientY);
    if (!pt) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      mode: 'resize',
      id,
      startX: pt.x,
      startY: pt.y,
      origW: o.w,
      origH: o.h,
      origX: o.x,
      origY: o.y,
      corner,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const pt = stageCoords(e.clientX, e.clientY);
    if (!pt) return;
    const dx = pt.x - drag.startX;
    const dy = pt.y - drag.startY;

    if (drag.mode === 'move') {
      const target = overlays.find((o) => o.id === drag.id);
      if (!target) return;
      // For shapes (top-left coord), clamp so the shape stays in-bounds.
      if (target.kind === 'text') {
        const nx = Math.max(0, Math.min(100, drag.origX + dx));
        const ny = Math.max(0, Math.min(100, drag.origY + dy));
        update(drag.id, { x: nx, y: ny });
      } else {
        const nx = Math.max(0, Math.min(100 - target.w, drag.origX + dx));
        const ny = Math.max(0, Math.min(100 - target.h, drag.origY + dy));
        update(drag.id, { x: nx, y: ny });
      }
    } else if (drag.mode === 'resize') {
      let nx = drag.origX;
      let ny = drag.origY;
      let nw = drag.origW;
      let nh = drag.origH;
      if (drag.corner === 'se') {
        nw = Math.max(2, drag.origW + dx);
        nh = Math.max(2, drag.origH + dy);
      } else if (drag.corner === 'sw') {
        nw = Math.max(2, drag.origW - dx);
        nh = Math.max(2, drag.origH + dy);
        nx = drag.origX + (drag.origW - nw);
      } else if (drag.corner === 'ne') {
        nw = Math.max(2, drag.origW + dx);
        nh = Math.max(2, drag.origH - dy);
        ny = drag.origY + (drag.origH - nh);
      } else if (drag.corner === 'nw') {
        nw = Math.max(2, drag.origW - dx);
        nh = Math.max(2, drag.origH - dy);
        nx = drag.origX + (drag.origW - nw);
        ny = drag.origY + (drag.origH - nh);
      }
      // Clamp inside the stage
      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      if (nx + nw > 100) nw = 100 - nx;
      if (ny + nh > 100) nh = 100 - ny;
      update(drag.id, { x: nx, y: ny, w: nw, h: nh });
    }
  };

  const handlePointerUp = () => setDrag(null);

  // Keyboard delete for selected overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        remove(selectedId);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-5xl bg-stone-50 rounded-lg shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Header / Toolbar */}
        <div className="shrink-0 border-b border-stone-200 px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-stone-700 mr-2">Annotate photo</p>

          <div className="flex gap-1.5">
            {(['select', 'text', 'circle', 'rect'] as const).map((t) => {
              const isActive = tool === t;
              const label = t === 'select' ? 'Select' : t === 'text' ? 'Text' : t === 'circle' ? 'Circle' : 'Rectangle';
              return (
                <button
                  key={t}
                  onClick={() => setTool(t)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-stone-500">Colour:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  if (selected) update(selected.id, { color: c });
                }}
                className={`w-5 h-5 rounded-full border-2 ${color === c ? 'border-stone-900' : 'border-white'} shadow`}
                style={{ backgroundColor: c }}
                aria-label={`Use colour ${c}`}
              />
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-stone-200 text-stone-700 hover:bg-stone-300"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(overlays)}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Done
            </button>
          </div>
        </div>

        {/* Body — photo stage + side panel */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Stage */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-stone-100 overflow-auto">
            <div
              ref={stageRef}
              className="relative inline-block select-none"
              style={{ cursor: tool === 'select' ? 'default' : 'crosshair', maxWidth: '100%' }}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt=""
                className="block max-w-full"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
                draggable={false}
              />

              {/* Overlays */}
              {overlays.map((o) => {
                const isSel = o.id === selectedId;
                if (o.kind === 'text') {
                  return (
                    <span
                      key={o.id}
                      onPointerDown={(e) => handleOverlayPointerDown(e, o.id)}
                      style={{
                        position: 'absolute',
                        left: `${o.x}%`,
                        top: `${o.y}%`,
                        transform: 'translate(-50%, -50%)',
                        color: o.color,
                        fontSize: o.fontSize ?? 18,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.45)',
                        whiteSpace: 'pre',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        cursor: 'move',
                        outline: isSel ? '2px dashed #2563EB' : 'none',
                        outlineOffset: 4,
                        touchAction: 'none',
                      }}
                    >
                      {o.text}
                    </span>
                  );
                }
                const isCircle = o.kind === 'circle';
                return (
                  <div
                    key={o.id}
                    onPointerDown={(e) => handleOverlayPointerDown(e, o.id)}
                    style={{
                      position: 'absolute',
                      left: `${o.x}%`,
                      top: `${o.y}%`,
                      width: `${o.w}%`,
                      height: `${o.h}%`,
                      border: `3px solid ${o.color}`,
                      borderRadius: isCircle ? '50%' : 4,
                      boxShadow: isSel
                        ? '0 0 0 2px #2563EB, 0 0 0 4px rgba(37,99,235,0.25)'
                        : '0 0 0 1px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.25)',
                      cursor: 'move',
                      touchAction: 'none',
                    }}
                  >
                    {isSel && (['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                      <span
                        key={corner}
                        onPointerDown={(e) => handleResizePointerDown(e, o.id, corner)}
                        style={{
                          position: 'absolute',
                          width: 12,
                          height: 12,
                          background: '#fff',
                          border: '2px solid #2563EB',
                          borderRadius: 2,
                          cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                          touchAction: 'none',
                          [corner.includes('n') ? 'top' : 'bottom']: -7,
                          [corner.includes('w') ? 'left' : 'right']: -7,
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side panel — selection details + list */}
          <div className="md:w-72 shrink-0 border-l border-stone-200 bg-white overflow-y-auto p-3 space-y-3">
            {selected ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  {selected.kind === 'text' ? 'Text label' : selected.kind === 'circle' ? 'Circle' : 'Rectangle'}
                </p>
                {selected.kind === 'text' && (
                  <>
                    <label className="block">
                      <span className="text-[10px] text-stone-500">Label text</span>
                      <input
                        value={selected.text}
                        onChange={(e) => update(selected.id, { text: e.target.value })}
                        className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-stone-500">Font size (px on photo width 1000)</span>
                      <input
                        type="number"
                        min={8}
                        max={120}
                        value={selected.fontSize ?? 18}
                        onChange={(e) => update(selected.id, { fontSize: parseInt(e.target.value, 10) || 18 })}
                        className="mt-1 w-24 px-2 py-1 border border-stone-300 rounded text-sm"
                      />
                    </label>
                  </>
                )}
                {(selected.kind === 'circle' || selected.kind === 'rect') && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <PctField label="X" value={selected.x} onChange={(v) => update(selected.id, { x: v })} />
                    <PctField label="Y" value={selected.y} onChange={(v) => update(selected.id, { y: v })} />
                    <PctField label="W" value={selected.w} onChange={(v) => update(selected.id, { w: v })} />
                    <PctField label="H" value={selected.h} onChange={(v) => update(selected.id, { h: v })} />
                  </div>
                )}
                <button
                  onClick={() => remove(selected.id)}
                  className="w-full px-3 py-1.5 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200"
                >
                  Delete this annotation
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-stone-500 space-y-2">
                <p className="font-semibold text-stone-700">How to use</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Pick a tool (Text, Circle, Rectangle).</li>
                  <li>Click on the photo to place it.</li>
                  <li>Click Select, then drag to move or use corner handles to resize.</li>
                  <li>Pick a colour at the top — applies to the selected overlay.</li>
                  <li>Press Delete or use the button to remove.</li>
                </ol>
              </div>
            )}

            <div className="border-t border-stone-200 pt-2">
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1">
                All overlays ({overlays.length})
              </p>
              {overlays.length === 0 ? (
                <p className="text-[11px] text-stone-400 italic">None yet.</p>
              ) : (
                <ul className="space-y-1">
                  {overlays.map((o) => (
                    <li
                      key={o.id}
                      onClick={() => setSelectedId(o.id)}
                      className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
                        selectedId === o.id ? 'bg-blue-50 text-blue-800' : 'hover:bg-stone-100'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-white shadow" style={{ backgroundColor: o.color }} />
                      <span className="flex-1 truncate">
                        {o.kind === 'text' ? `“${o.text}”` : o.kind === 'circle' ? 'Circle' : 'Rectangle'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(o.id); }}
                        className="text-stone-400 hover:text-red-600"
                        aria-label="Delete"
                      >&times;</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PctField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] text-stone-500">{label} (%)</span>
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={Math.round(value)}
        onChange={(e) => onChange(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
        className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
      />
    </label>
  );
}
