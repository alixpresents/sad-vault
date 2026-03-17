"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Play, Loader2, Camera, RefreshCw } from "lucide-react";
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
import { deleteVideo, updateVideoTitle, replaceVideo } from "@/app/(admin)/uploads/actions";
import { ThumbnailPicker } from "./thumbnail-picker";
import { seekAndCapture, uploadThumbnail } from "@/lib/thumbnail";

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

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
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") { setTitle(initialTitle); setEditing(false); }
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

type ReplaceState = "idle" | "uploading" | "thumbnail" | "saving" | "done" | "error";

export function VideoCard({
  video,
  talentSlug,
}: {
  video: Video;
  talentSlug: string;
}) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showThumbnailPicker, setShowThumbnailPicker] = useState(false);

  // Replace state
  const [replaceState, setReplaceState] = useState<ReplaceState>("idle");
  const [replaceProgress, setReplaceProgress] = useState(0);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceAbortRef = useRef<XMLHttpRequest | null>(null);

  const isReplacing = replaceState !== "idle" && replaceState !== "done" && replaceState !== "error";

  // Load thumbnail presigned URL
  useEffect(() => {
    if (!video.thumbnail_key) return;
    let cancelled = false;
    async function loadThumbnail() {
      const res = await fetch(`/api/video?key=${encodeURIComponent(video.thumbnail_key!)}`);
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

  const handleReplaceFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (replaceInputRef.current) replaceInputRef.current.value = "";

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setReplaceError("Format non supporte. Utilise MP4, MOV ou WebM.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setReplaceError("Fichier trop lourd (max 500 Mo).");
      return;
    }

    setReplaceError(null);
    setReplaceState("uploading");
    setReplaceProgress(0);

    try {
      // 1. Get presigned URL to overwrite the same r2_key
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          talentSlug,
          replaceKey: video.r2_key,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur URL");
      }
      const { presignedUrl } = await res.json();

      // 2. Upload with XHR for progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        replaceAbortRef.current = xhr;
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) setReplaceProgress(Math.round((ev.loaded / ev.total) * 100));
        });
        xhr.addEventListener("load", () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload echoue (${xhr.status})`)));
        xhr.addEventListener("error", () => reject(new Error("Erreur reseau")));
        xhr.addEventListener("abort", () => reject(new Error("Upload annule")));
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      // 3. Generate new thumbnail
      setReplaceState("thumbnail");
      let thumbnailKey: string | null = video.thumbnail_key;
      let duration: number | null = video.duration_seconds;

      const capture = await seekAndCapture(file);
      if (capture) {
        duration = capture.duration;
        const newThumbKey = await uploadThumbnail(capture.blob, talentSlug);
        if (newThumbKey) thumbnailKey = newThumbKey;
      }

      // 4. Update DB
      setReplaceState("saving");
      const result = await replaceVideo(video.id, video.talent_id, {
        file_size_bytes: file.size,
        duration_seconds: duration,
        thumbnail_key: thumbnailKey,
      });

      if (result?.error) throw new Error(result.error);

      setReplaceState("done");
      // Refresh the page to load new thumbnail and updated data
      router.refresh();
    } catch (err) {
      setReplaceState("error");
      setReplaceError(err instanceof Error ? err.message : "Erreur inconnue");
      setTimeout(() => { setReplaceState("idle"); setReplaceError(null); }, 4000);
    } finally {
      replaceAbortRef.current = null;
    }
  }, [video.id, video.talent_id, video.r2_key, video.thumbnail_key, video.duration_seconds, talentSlug]);

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
              disabled={loadingUrl || isReplacing}
              className="relative flex h-full w-full items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              {thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
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
          {!videoUrl && video.duration_seconds && !isReplacing && (
            <span className="absolute bottom-2 right-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] tabular-nums text-white">
              {formatDuration(video.duration_seconds)}
            </span>
          )}

          {/* Replace progress overlay */}
          {isReplacing && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/60">
              <p className="text-[11px] font-medium text-white">
                {replaceState === "uploading" && `Remplacement... ${replaceProgress}%`}
                {replaceState === "thumbnail" && "Generation du thumbnail..."}
                {replaceState === "saving" && "Enregistrement..."}
              </p>
              <div className="mx-auto h-1 w-3/4 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${replaceState === "uploading" ? replaceProgress : 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Replace done overlay */}
          {replaceState === "done" && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
              <p className="text-[12px] font-medium text-emerald-400">Video remplacee</p>
            </div>
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
              onClick={() => replaceInputRef.current?.click()}
              disabled={isReplacing}
              title="Remplacer la video"
            >
              <RefreshCw className={isReplacing ? "animate-spin" : ""} />
            </Button>
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

        {/* Replace error */}
        {replaceError && (
          <div className="border-t border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-600">
            {replaceError}
          </div>
        )}
      </div>

      {/* Hidden file input for replace */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleReplaceFile}
      />

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
