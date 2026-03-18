"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";

type VideoPreviewModalProps = {
  r2Key: string;
  title: string;
  onClose: () => void;
};

export function VideoPreviewModal({ r2Key, title, onClose }: VideoPreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/video?key=${encodeURIComponent(r2Key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.presignedUrl) setUrl(d.presignedUrl); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [r2Key]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl px-4">
        <button
          onClick={onClose}
          className="absolute -top-10 right-4 rounded-full p-1.5 text-white/60 transition-colors hover:text-white"
        >
          <X className="size-5" />
        </button>
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-white/30" />
            </div>
          ) : url ? (
            <video
              src={url}
              controls
              autoPlay
              playsInline
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-white/40">Impossible de charger la video</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-sm text-white/60">{title}</p>
      </div>
    </div>
  );
}
