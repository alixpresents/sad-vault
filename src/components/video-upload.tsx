"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, CheckCircle2, AlertCircle, Film, TriangleAlert, AlertTriangle } from "lucide-react";
import type { Talent } from "@/lib/types";
import { createVideo, checkDuplicate, type DuplicateMatch } from "@/app/(admin)/uploads/actions";
import { seekAndCapture, uploadThumbnail } from "@/lib/thumbnail";

type UploadState = "idle" | "checking" | "uploading" | "thumbnail" | "saving" | "done" | "error";

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const WARN_FILE_SIZE = 200 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const HASH_CHUNK_SIZE = 2 * 1024 * 1024; // 2 Mo

function formatMo(bytes: number) { return (bytes / (1024 * 1024)).toFixed(1) + " Mo"; }
function formatBytes(bytes: number) {
  if (bytes === 0) return "0 o";
  const k = 1024, sizes = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

async function computeFileHash(file: File): Promise<string> {
  const chunk = file.slice(0, HASH_CHUNK_SIZE);
  const buffer = await chunk.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const LEVEL_CONFIG = {
  certain: {
    border: "border-red-200",
    bg: "bg-red-50",
    text: "text-red-700",
    icon: AlertCircle,
    prefix: "Cette video est deja uploadee",
  },
  very_likely: {
    border: "border-red-200",
    bg: "bg-red-50",
    text: "text-red-700",
    icon: AlertTriangle,
    prefix: "Un fichier avec le meme nom existe deja",
  },
  likely: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    icon: AlertTriangle,
    prefix: "Une video avec un titre similaire existe",
  },
  possible: {
    border: "border-neutral-200",
    bg: "bg-neutral-50",
    text: "text-neutral-500",
    icon: AlertTriangle,
    prefix: "Un fichier de taille identique existe",
  },
};

export function VideoUpload({ talents, initialTalentId }: { talents: Talent[]; initialTalentId?: string }) {
  const [talentId, setTalentId] = useState(initialTalentId ?? "");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const [sizeBlocked, setSizeBlocked] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [dupDismissed, setDupDismissed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<XMLHttpRequest | null>(null);

  const selectedTalent = talents.find((t) => t.id === talentId);

  function clearFile() {
    setFile(null); setFileHash(null); setSizeWarning(null); setSizeBlocked(false);
    setError(null); setDuplicates([]); setDupDismissed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setSizeWarning(null); setSizeBlocked(false); setError(null); setDuplicates([]); setDupDismissed(false);

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError("Format non supporte. Utilise MP4, MOV ou WebM.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError(`Fichier trop lourd (${formatMo(selected.size)}). Limite : 500 Mo.`);
      setSizeBlocked(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (selected.size > WARN_FILE_SIZE) {
      setSizeWarning(`Fichier volumineux (${formatMo(selected.size)}). Compresse en 1080p H.264 pour un chargement plus rapide.`);
    }

    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "));

    // Hash + duplicate check
    setState("checking");
    try {
      const hash = await computeFileHash(selected);
      setFileHash(hash);
      const matches = await checkDuplicate(hash, selected.size, selected.name);
      if (matches.length > 0) {
        setDuplicates(matches);
      }
    } catch {
      // Hash failed, continue without
    }
    setState("idle");
  }, [title]);

  async function handleUpload() {
    if (!file || !talentId || !title || !selectedTalent || sizeBlocked) return;
    setError(null); setState("uploading"); setProgress(0);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, talentSlug: selectedTalent.slug }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Erreur URL"); }
      const { presignedUrl, r2Key } = await res.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest(); abortRef.current = xhr;
        xhr.upload.addEventListener("progress", (ev) => { if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100)); });
        xhr.addEventListener("load", () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload echoue (${xhr.status})`)));
        xhr.addEventListener("error", () => reject(new Error("Erreur reseau")));
        xhr.addEventListener("abort", () => reject(new Error("Upload annule")));
        xhr.open("PUT", presignedUrl); xhr.setRequestHeader("Content-Type", file.type); xhr.send(file);
      });

      setState("thumbnail");
      let thumbnailKey: string | null = null, duration: number | null = null;
      const capture = await seekAndCapture(file);
      if (capture) { duration = capture.duration; thumbnailKey = await uploadThumbnail(capture.blob, selectedTalent.slug); }

      setState("saving");
      const result = await createVideo({
        talent_id: talentId,
        title,
        r2_key: r2Key,
        file_size_bytes: file.size,
        duration_seconds: duration,
        thumbnail_key: thumbnailKey,
        file_hash: fileHash,
        original_filename: file.name,
      });
      if (result?.error) throw new Error(result.error);
      setState("done");

      // Auto-tag in background
      if (result?.videoId && thumbnailKey) {
        fetch("/api/analyze-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_id: result.videoId }),
        }).catch(() => {});
      }
    } catch (err) {
      setState("error"); setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally { abortRef.current = null; }
  }

  function handleCancel() { abortRef.current?.abort(); }
  function handleReset() {
    setFile(null); setFileHash(null); setTitle(""); setProgress(0);
    setState("idle"); setError(null); setSizeWarning(null); setSizeBlocked(false);
    setDuplicates([]); setDupDismissed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isBusy = state === "uploading" || state === "thumbnail" || state === "saving";
  const isChecking = state === "checking";
  const hasCertainDuplicate = duplicates.some((d) => d.level === "certain") && !dupDismissed;
  const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500";
  const inputCls = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-400";

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-5">
        <label className={labelCls}>Talent</label>
        <select value={talentId} onChange={(e) => setTalentId(e.target.value)} disabled={isBusy} className={`${inputCls} cursor-pointer`} style={{ opacity: isBusy ? 0.5 : 1 }}>
          <option value="">Selectionner un talent</option>
          {talents.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="mb-5">
        <label className={labelCls}>Titre</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la video" disabled={isBusy} className={inputCls} style={{ opacity: isBusy ? 0.5 : 1 }} />
      </div>
      <div className="mb-5">
        <label className={labelCls}>Fichier video</label>
        {!file ? (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-200 py-10 text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-500">
            <Upload className="h-6 w-6" />
            <span className="text-[12px]">Cliquer pour selectionner un fichier</span>
            <span className="text-[10px] text-neutral-300">MP4, MOV, WebM - max 500 Mo</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
            <Film className="h-4 w-4 shrink-0 text-neutral-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-neutral-700">{file.name}</p>
              <p className="text-[10px] text-neutral-400">{formatBytes(file.size)}</p>
            </div>
            {(state === "idle" || state === "checking") && (
              <button onClick={clearFile} className="shrink-0 rounded-md p-1 text-neutral-300 transition-colors hover:text-neutral-500">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Checking indicator */}
      {isChecking && (
        <div className="mb-5 flex items-center gap-2 text-[11px] text-neutral-400">
          <div className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-neutral-600" />
          Verification des doublons...
        </div>
      )}

      {/* Duplicate warnings */}
      {duplicates.length > 0 && !dupDismissed && !isBusy && state !== "done" && (
        <div className="mb-5 space-y-2">
          {duplicates.map((dup) => {
            const cfg = LEVEL_CONFIG[dup.level];
            const Icon = cfg.icon;
            return (
              <div key={dup.videoId} className={`rounded-lg border p-3 ${cfg.border} ${cfg.bg}`}>
                <div className={`flex items-start gap-2 text-[12px] ${cfg.text}`}>
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <p className="font-medium">{cfg.prefix}</p>
                    <p className="mt-0.5 opacity-80">
                      {dup.title}{dup.talentName ? ` (${dup.talentName})` : ""} — {dup.reason}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2">
            <button onClick={clearFile} className="rounded-md border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
              Annuler
            </button>
            <button onClick={() => setDupDismissed(true)} className="rounded-md px-3 py-1.5 text-[12px] font-medium text-neutral-500 transition-colors hover:text-neutral-700">
              Uploader quand meme
            </button>
          </div>
        </div>
      )}

      {/* Size warning */}
      {sizeWarning && !error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{sizeWarning}
        </div>
      )}

      {/* Progress */}
      {isBusy && (
        <div className="mb-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${state === "uploading" ? progress : 100}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-neutral-400">
            <span>
              {state === "uploading" && `Upload en cours... ${progress}%`}
              {state === "thumbnail" && "Generation du thumbnail..."}
              {state === "saving" && "Enregistrement..."}
            </span>
            {state === "uploading" && <button onClick={handleCancel} className="text-neutral-400 transition-colors hover:text-neutral-600">Annuler</button>}
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />Video uploadee avec succes.
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
        </div>
      )}

      {state === "done" ? (
        <button onClick={handleReset} className="rounded-md bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800">Uploader une autre video</button>
      ) : (
        <button
          onClick={handleUpload}
          disabled={!file || !talentId || !title || isBusy || sizeBlocked || isChecking || (hasCertainDuplicate && !dupDismissed)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
        >
          {isBusy ? "Upload en cours..." : "Uploader"}
        </button>
      )}
    </div>
  );
}
