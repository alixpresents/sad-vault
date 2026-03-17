"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Play, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Video } from "@/lib/types";
import { deleteVideo, updateVideoTitle } from "@/app/(admin)/uploads/actions";
import { ThumbnailPicker } from "./thumbnail-picker";

function formatDuration(seconds: number | null) {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "-";
  const k = 1024;
  const sizes = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function InlineTitle({
  videoId,
  talentId,
  initialTitle,
}: {
  videoId: string;
  talentId: string;
  initialTitle: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === initialTitle) {
      setTitle(initialTitle);
      setEditing(false);
      return;
    }

    setSaving(true);
    await updateVideoTitle(videoId, talentId, trimmed);
    setSaving(false);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") {
      setTitle(initialTitle);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="w-full truncate rounded border border-input bg-transparent px-1 py-0 text-sm font-medium outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full truncate text-left text-sm font-medium hover:underline"
      title="Cliquer pour renommer"
    >
      {initialTitle}
    </button>
  );
}

export function VideoCard({
  video,
  talentSlug,
}: {
  video: Video;
  talentSlug: string;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showThumbnailPicker, setShowThumbnailPicker] = useState(false);

  // Load thumbnail presigned URL
  useEffect(() => {
    if (!video.thumbnail_key) return;
    let cancelled = false;

    async function loadThumbnail() {
      const res = await fetch(
        `/api/video?key=${encodeURIComponent(video.thumbnail_key!)}`
      );
      if (res.ok && !cancelled) {
        const data = await res.json();
        setThumbnailUrl(data.presignedUrl);
      }
    }

    loadThumbnail();
    return () => { cancelled = true; };
  }, [video.thumbnail_key]);

  async function handlePlay() {
    if (videoUrl || loadingUrl) return;
    setLoadingUrl(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/video?key=${encodeURIComponent(video.r2_key)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVideoUrl(data.presignedUrl);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingUrl(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteVideo(video.id, video.talent_id);
    setDeleting(false);
    setShowDelete(false);
  }

  return (
    <>
      <div className="group overflow-hidden rounded-lg border transition-colors hover:border-foreground/15">
        {/* Video preview / player */}
        <div className="relative aspect-video bg-muted">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <button
              type="button"
              onClick={handlePlay}
              disabled={loadingUrl}
              className="relative flex h-full w-full items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              {/* Thumbnail background */}
              {thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}

              {/* Play overlay */}
              <div className="relative z-10">
                {loadingUrl ? (
                  <Loader2 className="size-8 animate-spin" />
                ) : loadError ? (
                  <div className="flex flex-col items-center gap-1">
                    <Play className="size-6" />
                    <span className="text-xs">Reessayer</span>
                  </div>
                ) : (
                  <div className={`flex size-10 items-center justify-center rounded-full ${thumbnailUrl ? "bg-black/50 text-white" : ""}`}>
                    <Play className="ml-0.5 size-5" />
                  </div>
                )}
              </div>
            </button>
          )}

          {/* Duration badge */}
          {!videoUrl && video.duration_seconds && (
            <span className="absolute bottom-2 right-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] tabular-nums text-white">
              {formatDuration(video.duration_seconds)}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex items-start justify-between gap-2 p-3">
          <div className="min-w-0 flex-1">
            <InlineTitle
              videoId={video.id}
              talentId={video.talent_id}
              initialTitle={video.title}
            />
            <p className="text-xs text-muted-foreground">
              {formatBytes(video.file_size_bytes)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowThumbnailPicker(true)}
              title="Modifier le thumbnail"
            >
              <Camera />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      {/* Thumbnail picker dialog */}
      <ThumbnailPicker
        video={video}
        talentSlug={talentSlug}
        open={showThumbnailPicker}
        onOpenChange={setShowThumbnailPicker}
      />

      {/* Delete dialog */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette video ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
