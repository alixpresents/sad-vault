"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Loader2,
  RotateCw,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import type { Video } from "@/lib/types";

type ViewMode = "carousel" | "list";

// Shared helpers

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function useThumbnailUrl(thumbnailKey: string | null, token: string) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnailKey) return;
    let cancelled = false;

    fetch(
      `/api/share?token=${encodeURIComponent(token)}&key=${encodeURIComponent(thumbnailKey)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !cancelled) setUrl(data.presignedUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [thumbnailKey, token]);

  return url;
}

function useVideoUrl(token: string) {
  const [state, setState] = useState<{
    url: string | null;
    loading: boolean;
    error: boolean;
  }>({ url: null, loading: false, error: false });

  const load = useCallback(
    async (r2Key: string) => {
      setState({ url: null, loading: true, error: false });
      try {
        const res = await fetch(
          `/api/share?token=${encodeURIComponent(token)}&key=${encodeURIComponent(r2Key)}`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setState({ url: data.presignedUrl, loading: false, error: false });
      } catch {
        setState({ url: null, loading: false, error: true });
      }
    },
    [token]
  );

  const reset = useCallback(() => {
    setState({ url: null, loading: false, error: false });
  }, []);

  return { ...state, load, reset };
}

// ─── Main component ──────────────────────────────────────────────

export function ShareView({
  videos,
  token,
  title,
  talentName,
  allowDownload,
}: {
  videos: Video[];
  token: string;
  title: string | null;
  talentName: string | null;
  allowDownload: boolean;
}) {
  const [mode, setMode] = useState<ViewMode>("carousel");

  if (videos.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-sm text-white/40">Aucune video disponible.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-4 py-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-start justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
              Sad Pictures
            </p>
            {(title || talentName) && (
              <h1 className="mt-2 truncate text-lg font-semibold tracking-tight sm:text-xl">
                {title ?? talentName}
              </h1>
            )}
            {title && talentName && (
              <p className="mt-0.5 text-sm text-white/40">{talentName}</p>
            )}
          </div>

          {/* View mode toggle */}
          <div className="ml-4 flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.06] p-1">
            <button
              type="button"
              onClick={() => setMode("carousel")}
              className={`rounded-md p-1.5 transition-colors ${
                mode === "carousel"
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
              title="Carrousel"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMode("list")}
              className={`rounded-md p-1.5 transition-colors ${
                mode === "list"
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
              title="Liste"
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        {mode === "carousel" ? (
          <CarouselView
            videos={videos}
            token={token}
            talentName={talentName}
            allowDownload={allowDownload}
          />
        ) : (
          <ListView videos={videos} token={token} allowDownload={allowDownload} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-4 py-5 text-center sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/20">
          Sad Pictures / RZRE
        </p>
      </footer>
    </div>
  );
}

// ─── Carousel mode ───────────────────────────────────────────────

function DownloadButton({ url, title }: { url: string; title: string }) {
  return (
    <a
      href={url}
      download={title}
      className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white/90"
    >
      <Download className="size-3.5" />
      Telecharger
    </a>
  );
}

function CarouselView({
  videos,
  token,
  talentName,
  allowDownload,
}: {
  videos: Video[];
  token: string;
  talentName: string | null;
  allowDownload: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const video = useVideoUrl(token);
  const activeVideo = videos[activeIndex];

  // Load the first video on mount
  useEffect(() => {
    video.load(videos[0].r2_key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectVideo(index: number) {
    if (index === activeIndex) return;
    setActiveIndex(index);
    video.reset();
    video.load(videos[index].r2_key);
  }

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 200;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  // Scroll active thumbnail into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const thumb = el.children[activeIndex] as HTMLElement | undefined;
    if (thumb) {
      thumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div className="space-y-6">
      {/* Thumbnail strip */}
      <div className="relative">
        {/* Left arrow */}
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute -left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/70 p-1 text-white/60 backdrop-blur-sm transition-colors hover:text-white sm:flex"
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Thumbnails */}
        <div
          ref={scrollRef}
          className="scrollbar-hide flex gap-2 overflow-x-auto px-1 py-1 sm:gap-3"
        >
          {videos.map((v, i) => (
            <ThumbnailChip
              key={v.id}
              video={v}
              token={token}
              isActive={i === activeIndex}
              onClick={() => selectVideo(i)}
            />
          ))}
        </div>

        {/* Right arrow */}
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/70 p-1 text-white/60 backdrop-blur-sm transition-colors hover:text-white sm:flex"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Main player */}
      <div className="relative aspect-video overflow-hidden rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06]">
        {video.url ? (
          <video
            key={video.url}
            src={video.url}
            controls
            autoPlay
            playsInline
            {...(!allowDownload && { controlsList: "nodownload", disableRemotePlayback: true })}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {video.loading ? (
              <Loader2 className="size-8 animate-spin text-white/30" />
            ) : video.error ? (
              <button
                type="button"
                onClick={() => video.load(activeVideo.r2_key)}
                className="flex flex-col items-center gap-2"
              >
                <RotateCw className="size-6 text-white/40" />
                <p className="text-xs text-white/40">
                  Erreur. Cliquer pour reessayer.
                </p>
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Video info */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-white/80">
              {activeVideo.title}
            </h2>
            {activeVideo.duration_seconds && (
              <span className="text-xs tabular-nums text-white/30">
                {formatDuration(activeVideo.duration_seconds)}
              </span>
            )}
          </div>
          {talentName && (
            <p className="mt-0.5 text-xs text-white/30">{talentName}</p>
          )}
        </div>
        {allowDownload && video.url && (
          <DownloadButton url={video.url} title={activeVideo.title} />
        )}
      </div>
    </div>
  );
}

// ─── Thumbnail chip ──────────────────────────────────────────────

function ThumbnailChip({
  video,
  token,
  isActive,
  onClick,
}: {
  video: Video;
  token: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const thumbnailUrl = useThumbnailUrl(video.thumbnail_key, token);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/thumb flex shrink-0 flex-col items-center gap-1.5 transition-opacity ${
        isActive ? "opacity-100" : "opacity-40 hover:opacity-70"
      }`}
    >
      <div
        className={`relative h-[90px] w-[160px] overflow-hidden rounded-md bg-white/[0.06] ring-1 transition-all ${
          isActive
            ? "ring-white ring-offset-1 ring-offset-black"
            : "ring-transparent"
        }`}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="size-4 text-white/30" />
          </div>
        )}
        {video.duration_seconds && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] tabular-nums text-white/80">
            {formatDuration(video.duration_seconds)}
          </span>
        )}
      </div>
      <span className="max-w-[160px] truncate text-[11px] text-white/50">
        {video.title}
      </span>
    </button>
  );
}

// ─── List mode ───────────────────────────────────────────────────

function ListView({
  videos,
  token,
  allowDownload,
}: {
  videos: Video[];
  token: string;
  allowDownload: boolean;
}) {
  return (
    <div className="space-y-10">
      {videos.map((video) => (
        <ListItem key={video.id} video={video} token={token} allowDownload={allowDownload} />
      ))}
    </div>
  );
}

function ListItem({ video, token, allowDownload }: { video: Video; token: string; allowDownload: boolean }) {
  const thumbnailUrl = useThumbnailUrl(video.thumbnail_key, token);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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

  return (
    <div>
      {/* Title */}
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
            autoPlay
            playsInline
            {...(!allowDownload && { controlsList: "nodownload", disableRemotePlayback: true })}
            className="h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={loadVideo}
            disabled={loading}
            className="relative flex h-full w-full items-center justify-center transition-colors hover:bg-white/[0.04]"
          >
            {/* Thumbnail poster */}
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

      {/* Download button */}
      {allowDownload && videoUrl && (
        <div className="mt-2 flex justify-end">
          <DownloadButton url={videoUrl} title={video.title} />
        </div>
      )}
    </div>
  );
}
