"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, CheckCircle2, AlertCircle, Film, TriangleAlert, AlertTriangle } from "lucide-react";
import type { Talent } from "@/lib/types";
import { createVideo, checkDuplicate, type DuplicateMatch } from "@/app/(admin)/uploads/actions";
import { seekAndCapture, uploadThumbnail } from "@/lib/thumbnail";

type UploadState = "idle" | "checking" | "uploading" | "thumbnail" | "saving" | "done" | "error";

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const WARN_FILE_SIZE = 200 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const HASH_CHUNK_SIZE = 2 * 1024 * 1024;

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
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractVideoFile(files: FileList | DataTransferItemList | null): { file: File | null; ignored: number } {
  if (!files) return { file: null, ignored: 0 };
  let found: File | null = null;
  let total = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files instanceof DataTransferItemList ? files[i].getAsFile() : files[i];
    if (f && ACCEPTED_TYPES.includes(f.type)) {
      total++;
      if (!found) found = f;
    }
  }
  return { file: found, ignored: total > 1 ? total - 1 : 0 };
}

const LEVEL_CONFIG = {
  certain: { border: "border-red-200", bg: "bg-red-50", text: "text-red-700", icon: AlertCircle, prefix: "Cette video est deja uploadee" },
  very_likely: { border: "border-red-200", bg: "bg-red-50", text: "text-red-700", icon: AlertTriangle, prefix: "Un fichier avec le meme nom existe deja" },
  likely: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", icon: AlertTriangle, prefix: "Une video avec un titre similaire existe" },
  possible: { border: "border-neutral-200", bg: "bg-neutral-50", text: "text-neutral-500", icon: AlertTriangle, prefix: "Un fichier de taille identique existe" },
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
  const [dropWarning, setDropWarning] = useState<string | null>(null);
  const [zoneDragOver, setZoneDragOver] = useState(false);
  const [pageDragOver, setPageDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<XMLHttpRequest | null>(null);
  const dragCounterRef = useRef(0);

  const selectedTalent = talents.find((t) => t.id === talentId);

  function clearFile() {
    setFile(null); setFileHash(null); setSizeWarning(null); setSizeBlocked(false);
    setError(null); setDuplicates([]); setDupDismissed(false); setDropWarning(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Shared file processing (used by both input change and drag & drop)
  const processFile = useCallback(async (selected: File) => {
    setSizeWarning(null); setSizeBlocked(false); setError(null);
    setDuplicates([]); setDupDismissed(false); setDropWarning(null);

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError("Format non supporte. Utilise MP4, MOV ou WebM.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError(`Fichier trop lourd (${formatMo(selected.size)}). Limite : 500 Mo.`);
      setSizeBlocked(true);
      return;
    }
    if (selected.size > WARN_FILE_SIZE) {
      setSizeWarning(`Fichier volumineux (${formatMo(selected.size)}). Compresse en 1080p H.264 pour un chargement plus rapide.`);
    }

    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "));

    setState("checking");
    try {
      const hash = await computeFileHash(selected);
      setFileHash(hash);
      const matches = await checkDuplicate(hash, selected.size, selected.name);
      if (matches.length > 0) setDuplicates(matches);
    } catch { /* continue without hash */ }
    setState("idle");
  }, [title]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  }, [processFile]);

  // Zone drag & drop handlers
  const handleZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoneDragOver(true);
  }, []);
  const handleZoneDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoneDragOver(false);
  }, []);
  const handleZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoneDragOver(false);
    setPageDragOver(false);
    dragCounterRef.current = 0;

    const { file: videoFile, ignored } = extractVideoFile(e.dataTransfer.files);
    if (ignored > 0) setDropWarning("Seul le premier fichier video a ete retenu. Upload un fichier a la fois.");
    if (videoFile) processFile(videoFile);
    else if (!ignored) setError("Aucun fichier video valide (MP4, MOV, WebM).");
  }, [processFile]);

  // Full-page drag overlay
  useEffect(() => {
    if (file) return; // Don't show overlay if file already selected

    function handleDragEnter(e: DragEvent) {
      e.preventDefault();
      dragCounterRef.current++;
      if (dragCounterRef.current === 1) setPageDragOver(true);
    }
    function handleDragLeave(e: DragEvent) {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setPageDragOver(false); }
    }
    function handleDragOver(e: DragEvent) { e.preventDefault(); }
    function handleDrop(e: DragEvent) {
      e.preventDefault();
      dragCounterRef.current = 0;
      setPageDragOver(false);

      const { file: videoFile, ignored } = extractVideoFile(e.dataTransfer?.files ?? null);
      if (ignored > 0) setDropWarning("Seul le premier fichier video a ete retenu. Upload un fichier a la fois.");
      if (videoFile) processFile(videoFile);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { setPageDragOver(false); dragCounterRef.current = 0; }
    }

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [file, processFile]);

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
        talent_id: talentId, title, r2_key: r2Key, file_size_bytes: file.size,
        duration_seconds: duration, thumbnail_key: thumbnailKey,
        file_hash: fileHash, original_filename: file.name,
      });
      if (result?.error) throw new Error(result.error);
      setState("done");

      if (result?.videoId && thumbnailKey) {
        fetch("/api/analyze-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ video_id: result.videoId }) }).catch(() => {});
      }
    } catch (err) {
      setState("error"); setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally { abortRef.current = null; }
  }

  function handleCancel() { abortRef.current?.abort(); }
  function handleReset() {
    setFile(null); setFileHash(null); setTitle(""); setProgress(0);
    setState("idle"); setError(null); setSizeWarning(null); setSizeBlocked(false);
    setDuplicates([]); setDupDismissed(false); setDropWarning(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isBusy = state === "uploading" || state === "thumbnail" || state === "saving";
  const isChecking = state === "checking";
  const hasCertainDuplicate = duplicates.some((d) => d.level === "certain") && !dupDismissed;
  const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500";
  const inputCls = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-400";

  return (
    <>
      {/* Full-page drag overlay */}
      {pageDragOver && !file && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-white/40 px-16 py-12">
            <Upload className="h-10 w-10 text-white/70" />
            <p className="text-[18px] font-medium text-white">Deposer la video</p>
            <p className="text-[12px] text-white/40">MP4, MOV, WebM - max 500 Mo</p>
          </div>
        </div>
      )}

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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleZoneDragOver}
              onDragLeave={handleZoneDragLeave}
              onDrop={handleZoneDrop}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border py-10 transition-all duration-150 ${
                zoneDragOver
                  ? "animate-pulse border-solid border-neutral-400 bg-neutral-50 text-neutral-600"
                  : "border-dashed border-neutral-200 text-neutral-400 hover:border-neutral-300 hover:text-neutral-500"
              }`}
            >
              <Upload className="h-6 w-6" />
              <span className="text-[12px]">
                {zoneDragOver ? "Deposer la video ici" : "Cliquer ou glisser-deposer un fichier"}
              </span>
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

        {/* Drop warning (multi-file) */}
        {dropWarning && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{dropWarning}
          </div>
        )}

        {isChecking && (
          <div className="mb-5 flex items-center gap-2 text-[11px] text-neutral-400">
            <div className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-neutral-600" />
            Verification des doublons...
          </div>
        )}

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
                      <p className="mt-0.5 opacity-80">{dup.title}{dup.talentName ? ` (${dup.talentName})` : ""} — {dup.reason}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2">
              <button onClick={clearFile} className="rounded-md border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50">Annuler</button>
              <button onClick={() => setDupDismissed(true)} className="rounded-md px-3 py-1.5 text-[12px] font-medium text-neutral-500 transition-colors hover:text-neutral-700">Uploader quand meme</button>
            </div>
          </div>
        )}

        {sizeWarning && !error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{sizeWarning}
          </div>
        )}

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
    </>
  );
}
