"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";

export function VideoPreviewModal({
  r2Key,
  onClose,
}: {
  r2Key: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/video?key=${encodeURIComponent(r2Key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.presignedUrl) setUrl(d.presignedUrl); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [r2Key]);

  const onKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );
  useEffect(() => {
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full p-2 text-white/50 transition-colors hover:text-white"
      >
        <X className="size-5" />
      </button>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="w-full max-w-[720px] px-4" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="flex aspect-video items-center justify-center">
            <Loader2 className="size-6 animate-spin text-white/30" />
          </div>
        ) : url ? (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="w-full rounded-lg"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center">
            <p className="text-sm text-white/40">Impossible de charger la video</p>
          </div>
        )}
      </div>
    </div>
  );
}
