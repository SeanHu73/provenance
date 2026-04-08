"use client";

import { useEffect, useRef, useState } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  const [visible, setVisible] = useState(false);
  const [translate, setTranslate] = useState(100);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, startTranslate: 0, dragging: false });

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTranslate(0));
      });
    } else {
      setTranslate(100);
      const timeout = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  function handleTouchStart(e: React.TouchEvent) {
    dragRef.current = {
      startY: e.touches[0].clientY,
      startTranslate: translate,
      dragging: true,
    };
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragRef.current.dragging) return;
    const delta = e.touches[0].clientY - dragRef.current.startY;
    const pct = Math.max(0, (delta / window.innerHeight) * 100);
    setTranslate(pct);
  }

  function handleTouchEnd() {
    dragRef.current.dragging = false;
    if (translate > 25) {
      onClose();
    } else {
      setTranslate(0);
    }
  }

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity duration-300"
        style={{ opacity: open && translate < 50 ? 1 : 0 }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out"
        style={{
          transform: `translateY(${translate}%)`,
          height: "85%",
          maxHeight: "85vh",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
