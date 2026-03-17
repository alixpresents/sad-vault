"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import type { Video } from "@/lib/types";
import { captureVideoFrame, uploadThumbnail } from "@/lib/thumbnail";
import { updateVideoThumbnail } from "@/app/(admin)/uploads/actions";

type Props = {
  video: Video;
  talentSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ThumbnailPicker({ video, talentSlug, open, onOpenChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load video URL when dialog opens
  useEffect(() => {
    if (!open) {
      setVideoUrl(null);
      setPreview(null);
      setError(null);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    async function loadUrl() {
      setLoading(true);
      try {
        const res = await fetch(`/api/video?key=${encodeURIComponent(video.r2_key)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setVideoUrl(data.presignedUrl);
      } catch {
        setError("Impossible de charger la video.");
      } finally {
        setLoading(false);
      }
    }

    loadUrl();
  }, [open, video.r2_key]);

  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    // Seek to current thumbnail position or 2s
    const target = Math.min(2, v.duration * 0.1);
    v.currentTime = target;
    setCurrentTime(target);
  }

  function handleSliderChange(value: number[]) {
    const v = videoRef.current;
    if (!v) return;
    const time = value[0];
    v.currentTime = time;
    setCurrentTime(time);
    setPreview(null);
  }

  async function handleCapture() {
    const v = videoRef.current;
    if (!v) return;

    setCapturing(true);
    setError(null);

    try {
      const blob = await captureVideoFrame(v);
      if (!blob) throw new Error("Capture echouee");

      // Show preview
      setPreview(URL.createObjectURL(blob));

      // Upload to R2
      const thumbnailKey = await uploadThumbnail(blob, talentSlug);
      if (!thumbnailKey) throw new Error("Upload du thumbnail echoue");

      // Update in database
      const result = await updateVideoThumbnail(video.id, video.talent_id, thumbnailKey);
      if (result?.error) throw new Error(result.error);

      // Close after short delay to show success
      setTimeout(() => onOpenChange(false), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setCapturing(false);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier le thumbnail</DialogTitle>
          <DialogDescription>
            Naviguez dans la video et capturez le frame souhaite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video player */}
          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  crossOrigin="anonymous"
                  muted
                  playsInline
                  preload="auto"
                  onLoadedMetadata={handleLoadedMetadata}
                  className="h-full w-full object-contain"
                />
                {preview && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="text-center">
                      <Camera className="mx-auto size-8 text-green-400" />
                      <p className="mt-2 text-sm font-medium text-white">
                        Thumbnail enregistre
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : error ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : null}
          </div>

          {/* Scrub slider */}
          {duration > 0 && (
            <div className="space-y-2">
              <Slider
                value={[currentTime]}
                min={0}
                max={duration}
                step={0.1}
                onValueChange={handleSliderChange}
                disabled={capturing}
              />
              <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && videoUrl && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Capture button */}
          <div className="flex justify-end">
            <Button
              onClick={handleCapture}
              disabled={!videoUrl || capturing || loading}
            >
              {capturing ? (
                <>
                  <Loader2 className="animate-spin" />
                  Capture en cours...
                </>
              ) : (
                <>
                  <Camera />
                  Capturer ce frame
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
