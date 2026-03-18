"use client";

import { useState, useEffect, useRef } from "react";

type FilmstripProps = {
  /** Per-video arrays of resolved presigned URLs */
  videoFrames: string[][];
};

export function Filmstrip({ videoFrames }: FilmstripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [slotCount, setSlotCount] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const slotW = w < 640 ? 37 : 49;
      setSlotCount(Math.min(20, Math.max(1, Math.floor(w / slotW))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Filter out videos with no resolved URLs
  const groups = videoFrames.filter((g) => g.length > 0);
  if (groups.length === 0) return <div ref={containerRef} />;

  const total = slotCount || 10;

  // Interleave: round-robin across videos, cycling each video's frames
  // Result: v0-f0, v1-f0, v2-f0, v0-f1, v1-f1, v2-f1, ...
  const slots: string[] = [];
  const cursors = groups.map(() => 0);

  for (let i = 0; i < total; i++) {
    const groupIdx = i % groups.length;
    const group = groups[groupIdx];
    const frameIdx = cursors[groupIdx] % group.length;
    slots.push(group[frameIdx]);
    cursors[groupIdx]++;
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none overflow-hidden select-none"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${slots.length}, 1fr)`,
          gap: 1,
          filter: "blur(1px) saturate(0.8) opacity(0.4)",
        }}
      >
        {slots.map((url, i) => (
          <div
            key={i}
            className="overflow-hidden"
            style={{ aspectRatio: "16/9" }}
          >
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover animate-in fade-in duration-500"
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
