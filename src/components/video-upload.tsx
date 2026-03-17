"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Film,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Talent } from "@/lib/types";
import { createVideo } from "@/app/(admin)/uploads/actions";
import { seekAndCapture, uploadThumbnail } from "@/lib/thumbnail";

type UploadState = "idle" | "uploading" | "thumbnail" | "saving" | "done" | "error";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 Mo
const WARN_FILE_SIZE = 200 * 1024 * 1024; // 200 Mo
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

function formatMo(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 o";
  const k = 1024;
  const sizes = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function VideoUpload({
  talents,
  initialTalentId,
}: {
  talents: Talent[];
  initialTalentId?: string;
}) {
  const [talentId, setTalentId] = useState(initialTalentId ?? "");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const [sizeBlocked, setSizeBlocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<XMLHttpRequest | null>(null);

  const selectedTalent = talents.find((t) => t.id === talentId);

  function clearFile() {
    setFile(null);
    setSizeWarning(null);
    setSizeBlocked(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (!selected) return;

      // Reset
      setSizeWarning(null);
      setSizeBlocked(false);
      setError(null);

      // Format check
      if (!ACCEPTED_TYPES.includes(selected.type)) {
        setError("Format non supporte. Utilise MP4, MOV ou WebM.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Size check
      if (selected.size > MAX_FILE_SIZE) {
        setError(
          `Fichier trop lourd (${formatMo(selected.size)}). Limite : 500 Mo. Compresse la video avant d'uploader (Handbrake, 1080p, H.264, 8-12 Mbps).`
        );
        setSizeBlocked(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Size warning
      if (selected.size > WARN_FILE_SIZE) {
        setSizeWarning(
          `Fichier volumineux (${formatMo(selected.size)}). Pour un chargement plus rapide, compresse en 1080p H.264.`
        );
      }

      setFile(selected);

      if (!title) {
        const name = selected.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
        setTitle(name);
      }
    },
    [title]
  );

  async function handleUpload() {
    if (!file || !talentId || !title || !selectedTalent || sizeBlocked) return;

    setError(null);
    setState("uploading");
    setProgress(0);

    try {
      // 1. Get presigned URL for video
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          talentSlug: selectedTalent.slug,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la generation de l'URL");
      }

      const { presignedUrl, r2Key } = await res.json();

      // 2. Upload video with XHR for progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        abortRef.current = xhr;

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload echoue (${xhr.status})`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Erreur reseau")));
        xhr.addEventListener("abort", () => reject(new Error("Upload annule")));

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      // 3. Generate thumbnail + get duration
      setState("thumbnail");
      let thumbnailKey: string | null = null;
      let duration: number | null = null;

      const capture = await seekAndCapture(file);
      if (capture) {
        duration = capture.duration;
        thumbnailKey = await uploadThumbnail(capture.blob, selectedTalent.slug);
      }

      // 4. Save to database
      setState("saving");
      const result = await createVideo({
        talent_id: talentId,
        title,
        r2_key: r2Key,
        file_size_bytes: file.size,
        duration_seconds: duration,
        thumbnail_key: thumbnailKey,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancel() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }

  function handleReset() {
    setFile(null);
    setTitle("");
    setProgress(0);
    setState("idle");
    setError(null);
    setSizeWarning(null);
    setSizeBlocked(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const isBusy = state === "uploading" || state === "thumbnail" || state === "saving";

  return (
    <div className="max-w-lg space-y-6">
      {/* Talent select */}
      <div className="space-y-2">
        <Label>Talent</Label>
        <Select value={talentId} onValueChange={setTalentId} disabled={isBusy}>
          <SelectTrigger>
            <SelectValue placeholder="Selectionner un talent" />
          </SelectTrigger>
          <SelectContent>
            {talents.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Titre</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la video"
          disabled={isBusy}
        />
      </div>

      {/* File input */}
      <div className="space-y-2">
        <Label>Fichier video</Label>
        {!file ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <Upload className="size-8" />
            <span>Cliquer pour selectionner un fichier</span>
            <span className="text-xs">MP4, MOV, WebM - max 500 Mo</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Film className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)}
              </p>
            </div>
            {state === "idle" && (
              <Button variant="ghost" size="icon-xs" onClick={clearFile}>
                <X />
              </Button>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Size warning */}
      {sizeWarning && !error && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {sizeWarning}
        </div>
      )}

      {/* Progress */}
      {isBusy && (
        <div className="space-y-2">
          <Progress value={state === "uploading" ? progress : 100} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {state === "uploading" && `Upload en cours... ${progress}%`}
              {state === "thumbnail" && "Generation du thumbnail..."}
              {state === "saving" && "Enregistrement..."}
            </span>
            {state === "uploading" && (
              <Button variant="ghost" size="xs" onClick={handleCancel}>
                Annuler
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Success */}
      {state === "done" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="size-4 shrink-0" />
          Video uploadee avec succes.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {state === "done" ? (
          <Button onClick={handleReset}>Uploader une autre video</Button>
        ) : (
          <Button
            onClick={handleUpload}
            disabled={!file || !talentId || !title || isBusy || sizeBlocked}
          >
            {isBusy ? "Upload en cours..." : "Uploader"}
          </Button>
        )}
      </div>
    </div>
  );
}
