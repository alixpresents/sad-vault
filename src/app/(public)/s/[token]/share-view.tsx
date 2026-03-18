"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  createContext,
  useContext,
} from "react";
import Image from "next/image";
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
import { useViewTracking } from "@/lib/use-view-tracking";
import { Filmstrip } from "./filmstrip";

type ViewMode = "carousel" | "list";

// ─── Shared URL cache ────────────────────────────────────────────
// Persists across mode switches so thumbnails/video URLs aren't re-fetched.

const urlCache = new Map<string, string>();

const TokenContext = createContext<string>("");

function useToken() {
  return useContext(TokenContext);
}

async function fetchShareUrl(token: string, r2Key: string): Promise<string | null> {
  const cacheKey = `${token}:${r2Key}`;
  const cached = urlCache.get(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `/api/share?token=${encodeURIComponent(token)}&key=${encodeURIComponent(r2Key)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    urlCache.set(cacheKey, data.presignedUrl);
    return data.presignedUrl;
  } catch {
    return null;
  }
}

// ─── Hooks ───────────────────────────────────────────────────────

function useThumbnailUrl(thumbnailKey: string | null) {
  const token = useToken();
  const [url, setUrl] = useState<string | null>(
    thumbnailKey ? urlCache.get(`${token}:${thumbnailKey}`) ?? null : null
  );

  useEffect(() => {
    if (!thumbnailKey) return;
    const cached = urlCache.get(`${token}:${thumbnailKey}`);
    if (cached) {
      setUrl(cached);
      return;
    }

    let cancelled = false;
    fetchShareUrl(token, thumbnailKey).then((u) => {
      if (u && !cancelled) setUrl(u);
    });
    return () => { cancelled = true; };
  }, [thumbnailKey, token]);

  return url;
}

function useVideoLoader() {
  const token = useToken();
  const [state, setState] = useState<{
    url: string | null;
    loading: boolean;
    error: boolean;
  }>({ url: null, loading: false, error: false });

  const load = useCallback(
    async (r2Key: string) => {
      const cached = urlCache.get(`${token}:${r2Key}`);
      if (cached) {
        setState({ url: cached, loading: false, error: false });
        return;
      }
      setState({ url: null, loading: true, error: false });
      const url = await fetchShareUrl(token, r2Key);
      if (url) {
        setState({ url, loading: false, error: false });
      } else {
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

function useInView(rootMargin = "200px") {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Main component ──────────────────────────────────────────────

// ─── Tracking context ────────────────────────────────────────────

const TrackingContext = createContext<ReturnType<typeof useViewTracking> | null>(null);

function useTracking() {
  return useContext(TrackingContext);
}

export function ShareView({
  videos,
  token,
  shareLinkId,
  title,
  talentName,
  allowDownload,
}: {
  videos: Video[];
  token: string;
  shareLinkId: string;
  title: string | null;
  talentName: string | null;
  allowDownload: boolean;
}) {
  const [mode, setMode] = useState<ViewMode>("carousel");
  const [sessionId] = useState(() => crypto.randomUUID());
  const tracking = useViewTracking({ shareLinkId, sessionId });

  // Collect filmstrip R2 keys per video, preserving grouping
  const perVideoKeys: string[][] = [];
  const allKeys: string[] = [];
  for (const v of videos) {
    const keys = (v.filmstrip_keys && v.filmstrip_keys.length > 0)
      ? v.filmstrip_keys
      : v.thumbnail_key ? [v.thumbnail_key] : [];
    perVideoKeys.push(keys);
    allKeys.push(...keys);
  }
  const allResolvedUrls = useAllUrls(token, allKeys);

  // Rebuild per-video resolved URL groups from the flat resolved array
  const perVideoUrls: string[][] = [];
  let offset = 0;
  for (const keys of perVideoKeys) {
    const group: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const url = allResolvedUrls[offset + i];
      if (url) group.push(url);
    }
    perVideoUrls.push(group);
    offset += keys.length;
  }

  if (videos.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-sm text-white/40">Aucune video disponible.</p>
      </div>
    );
  }

  return (
    <TokenContext value={token}>
      <TrackingContext value={tracking}>
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <header className="border-b border-white/[0.06] px-4 py-5 sm:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Image
                src="/logo-top-sadp2.png"
                alt="Sad Pictures"
                width={56}
                height={56}
                className="h-14 w-auto shrink-0"
                priority
              />
              <div className="min-w-0">
                {(title || talentName) && (
                  <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                    {title ?? talentName}
                  </h1>
                )}
                {title && talentName && (
                  <p className="mt-0.5 text-sm text-white/40">{talentName}</p>
                )}
              </div>
            </div>

            {/* View mode toggle */}
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.06] p-1">
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

          {/* Filmstrip */}
          {allKeys.length > 0 && (
            <div className="mx-auto mt-4 max-w-5xl">
              <Filmstrip videoFrames={perVideoUrls} />
            </div>
          )}
        </header>

        {/* Content */}
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
          {mode === "carousel" ? (
            <CarouselView
              videos={videos}
              talentName={talentName}
              allowDownload={allowDownload}
            />
          ) : (
            <ListView videos={videos} allowDownload={allowDownload} />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.06] px-4 py-5 text-center sm:px-8">
          <Image
            src="/logo-sad-pictures.png"
            alt="Sad Pictures"
            width={120}
            height={24}
            className="mx-auto h-8 w-auto"
          />
        </footer>
      </div>
      </TrackingContext>
    </TokenContext>
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

/** Video element with tracking wired up */
function CarouselVideoPlayer({ url, videoId, allowDownload }: { url: string; videoId: string; allowDownload: boolean }) {
  const tracking = useTracking();
  return (
    <video
      key={url}
      src={url}
      controls
      autoPlay
      playsInline
      preload="metadata"
      {...(!allowDownload && { controlsList: "nodownload", disableRemotePlayback: true })}
      className="h-full w-full"
      onPlay={() => tracking?.onPlay(videoId)}
      onPause={() => tracking?.onPause(videoId)}
      onEnded={() => tracking?.onEnded(videoId)}
    />
  );
}

/** Pre-fetch all thumbnail URLs for filmstrip (token passed directly, not from context) */
function useAllUrls(token: string, keys: (string | null)[]) {
  const [urls, setUrls] = useState<(string | null)[]>(() => keys.map(() => null));

  // Stable dep key so the effect doesn't re-fire on every render
  const keysKey = keys.map((k) => k ?? "").join(",");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      keys.forEach((key, i) => {
        if (!key) return;
        fetchShareUrl(token, key).then((url) => {
          if (!cancelled && url) {
            setUrls((prev) => {
              const next = [...prev];
              next[i] = url;
              return next;
            });
          }
        });
      });
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, keysKey]);

  return urls;
}

function CarouselView({
  videos,
  talentName,
  allowDownload,
}: {
  videos: Video[];
  talentName: string | null;
  allowDownload: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const video = useVideoLoader();
  const [playing, setPlaying] = useState(false);
  const activeVideo = videos[activeIndex];
  const activeThumbnailUrl = useThumbnailUrl(activeVideo.thumbnail_key);

  function selectVideo(index: number) {
    if (index === activeIndex) return;
    setActiveIndex(index);
    setPlaying(false);
    video.reset();
  }

  function handlePlay() {
    setPlaying(true);
    video.load(activeVideo.r2_key);
  }

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -200 : 200,
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
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute -left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/70 p-1 text-white/60 backdrop-blur-sm transition-colors hover:text-white sm:flex"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div
          ref={scrollRef}
          className="scrollbar-hide flex gap-2 overflow-x-auto px-1 py-1 sm:gap-3"
        >
          {videos.map((v, i) => (
            <ThumbnailChip
              key={v.id}
              video={v}
              isActive={i === activeIndex}
              priority={i === 0}
              onClick={() => selectVideo(i)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/70 p-1 text-white/60 backdrop-blur-sm transition-colors hover:text-white sm:flex"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Main player — fixed 16:9 aspect ratio */}
      <div className="relative aspect-video overflow-hidden rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06]">
        {video.url ? (
          <CarouselVideoPlayer
            url={video.url}
            videoId={activeVideo.id}
            allowDownload={allowDownload}
          />
        ) : (
          <button
            type="button"
            onClick={playing ? () => video.load(activeVideo.r2_key) : handlePlay}
            disabled={video.loading}
            className="relative flex h-full w-full items-center justify-center transition-colors hover:bg-white/[0.04]"
          >
            {activeThumbnailUrl && (
              <Image
                src={activeThumbnailUrl}
                alt=""
                fill
                sizes="(max-width: 1280px) 100vw, 1024px"
                className="object-cover"
                priority
                unoptimized
              />
            )}

            <div className="relative z-10">
              {video.loading ? (
                <Loader2 className="size-8 animate-spin text-white/30" />
              ) : video.error ? (
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

// ─── Thumbnail chip (memoized) ───────────────────────────────────

const ThumbnailChip = memo(function ThumbnailChip({
  video,
  isActive,
  priority = false,
  onClick,
}: {
  video: Video;
  isActive: boolean;
  priority?: boolean;
  onClick: () => void;
}) {
  const thumbnailUrl = useThumbnailUrl(video.thumbnail_key);

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
          <Image
            src={thumbnailUrl}
            alt=""
            width={160}
            height={90}
            className="h-full w-full object-cover"
            fetchPriority={priority ? "high" : undefined}
            priority={priority}
            unoptimized
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
});

// ─── List mode ───────────────────────────────────────────────────

function ListVideoPlayer({ url, videoId, allowDownload }: { url: string; videoId: string; allowDownload: boolean }) {
  const tracking = useTracking();
  return (
    <video
      src={url}
      controls
      autoPlay
      playsInline
      preload="none"
      {...(!allowDownload && { controlsList: "nodownload", disableRemotePlayback: true })}
      className="h-full w-full"
      onPlay={() => tracking?.onPlay(videoId)}
      onPause={() => tracking?.onPause(videoId)}
      onEnded={() => tracking?.onEnded(videoId)}
    />
  );
}

function ListView({
  videos,
  allowDownload,
}: {
  videos: Video[];
  allowDownload: boolean;
}) {
  return (
    <div className="space-y-10">
      {videos.map((video) => (
        <ListItem key={video.id} video={video} allowDownload={allowDownload} />
      ))}
    </div>
  );
}

const ListItem = memo(function ListItem({
  video,
  allowDownload,
}: {
  video: Video;
  allowDownload: boolean;
}) {
  const { ref, inView } = useInView("400px");
  const thumbnailUrl = useThumbnailUrl(inView ? video.thumbnail_key : null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const token = useToken();

  async function loadVideo() {
    if (videoUrl || loading) return;
    setLoading(true);
    setError(false);

    const url = await fetchShareUrl(token, video.r2_key);
    if (url) {
      setVideoUrl(url);
    } else {
      setError(true);
    }
    setLoading(false);
  }

  return (
    <div ref={ref}>
      {/* Title */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/70">{video.title}</h2>
        {video.duration_seconds && (
          <span className="text-xs tabular-nums text-white/30">
            {formatDuration(video.duration_seconds)}
          </span>
        )}
      </div>

      {/* Player — fixed 16:9 aspect ratio */}
      <div className="relative aspect-video overflow-hidden rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06]">
        {videoUrl ? (
          <ListVideoPlayer url={videoUrl} videoId={video.id} allowDownload={allowDownload} />
        ) : (
          <button
            type="button"
            onClick={loadVideo}
            disabled={loading}
            className="relative flex h-full w-full items-center justify-center transition-colors hover:bg-white/[0.04]"
          >
            {thumbnailUrl && (
              <Image
                src={thumbnailUrl}
                alt=""
                fill
                sizes="(max-width: 1280px) 100vw, 1024px"
                className="object-cover"
                unoptimized
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
              ) : inView ? (
                <div className="flex size-14 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-transform hover:scale-105">
                  <Play className="ml-0.5 size-5 text-white" />
                </div>
              ) : null}
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
});
