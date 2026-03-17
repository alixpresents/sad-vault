"use client";

import { useState, useEffect } from "react";
import { Play, Loader2, RotateCw } from "lucide-react";
import type { Video } from "@/lib/types";

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SharePlayer({
  video,
  token,
  autoLoadFirst = false,
}: {
  video: Video;
  token: string;
  autoLoadFirst?: boolean;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Load thumbnail
  useEffect(() => {
    if (!video.thumbnail_key) return;
    let cancelled = false;

    async function loadThumbnail() {
      try {
        const res = await fetch(
          `/api/share?token=${encodeURIComponent(token)}&key=${encodeURIComponent(video.thumbnail_key!)}`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setThumbnailUrl(data.presignedUrl);
        }
      } catch {
        // Thumbnail is optional, ignore errors
      }
    }

    loadThumbnail();
    return () => { cancelled = true; };
  }, [video.thumbnail_key, token]);

  async function loadVideo() {
    if (videoUrl || loading) return;
    setLoading(true);
    setError(false);

    try {
      const res = await fetch(
        `/api/share?token=${encodeURIComponent(token)}&key=${encodeURIComponent(video.r2_key)}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVideoUrl(data.presignedUrl);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // Auto-load the first video
  useEffect(() => {
    if (autoLoadFirst) {
      loadVideo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* Title bar */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/70">{video.title}</h2>
        {video.duration_seconds && (
          <span className="text-xs tabular-nums text-white/30">
            {formatDuration(video.duration_seconds)}
          </span>
        )}
      </div>

      {/* Player */}
      <div className="relative aspect-video overflow-hidden rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06]">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            autoPlay={autoLoadFirst}
            playsInline
            className="h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={loadVideo}
            disabled={loading}
            className="relative flex h-full w-full items-center justify-center transition-colors hover:bg-white/[0.04]"
          >
            {/* Thumbnail */}
            {thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            <div className="relative z-10">
              {loading ? (
                <Loader2 className="size-8 animate-spin text-white/30" />
              ) : error ? (
                <div className="flex flex-col items-center gap-2">
                  <RotateCw className="size-6 text-white/40" />
                  <p className="text-xs text-white/40">
                    Erreur. Cliquer pour reessayer.
                  </p>
                </div>
              ) : (
                <div className="flex size-14 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-transform hover:scale-105">
                  <Play className="ml-0.5 size-5 text-white" />
                </div>
              )}
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
