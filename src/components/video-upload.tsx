"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Upload, X, CheckCircle2, AlertCircle, Film, TriangleAlert, AlertTriangle,
  Pencil, Loader2,
} from "lucide-react";
import type { Talent } from "@/lib/types";
import { createVideo, checkDuplicate, type DuplicateMatch } from "@/app/(admin)/uploads/actions";
import { seekAndCapture, uploadThumbnail } from "@/lib/thumbnail";

// ─── Constants ──────────────────────────────────────────────────

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_FILES = 10;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const HASH_CHUNK_SIZE = 2 * 1024 * 1024;

type FileStatus = "pending" | "checking" | "ready" | "uploading" | "thumbnail" | "saving" | "done" | "error" | "skipped";

interface QueueItem {
  id: string;
  file: File;
  title: string;
  status: FileStatus;
  progress: number;
  error: string | null;
  hash: string | null;
  duplicates: DuplicateMatch[];
  dupDismissed: boolean;
  videoId: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 o";
  const k = 1024, sizes = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fileToTitle(name: string) {
  return titleCase(name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim());
}

async function computeHash(file: File): Promise<string> {
  const buffer = await file.slice(0, HASH_CHUNK_SIZE).arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractVideoFiles(fileList: FileList | null): { files: File[]; rejected: number; capped: boolean; overSize: string[] } {
  if (!fileList) return { files: [], rejected: 0, capped: false, overSize: [] };
  const valid: File[] = [];
  let rejected = 0;
  const overSize: string[] = [];
  let totalSize = 0;

  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    if (!ACCEPTED_TYPES.includes(f.type)) { rejected++; continue; }
    if (f.size > MAX_FILE_SIZE) { overSize.push(f.name); continue; }
    if (totalSize + f.size > MAX_TOTAL_SIZE) break;
    valid.push(f);
    totalSize += f.size;
    if (valid.length >= MAX_FILES) break;
  }

  return { files: valid, rejected, capped: fileList.length > MAX_FILES, overSize };
}

const LEVEL_BORDERS = {
  certain: "border-l-red-500",
  very_likely: "border-l-red-500",
  likely: "border-l-amber-500",
  possible: "border-l-amber-300",
};

// ─── Component ──────────────────────────────────────────────────

export function VideoUpload({ talents, initialTalentId }: { talents: Talent[]; initialTalentId?: string }) {
  const [talentId, setTalentId] = useState(initialTalentId ?? "");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [zoneDragOver, setZoneDragOver] = useState(false);
  const [pageDragOver, setPageDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<XMLHttpRequest | null>(null);
  const dragCounterRef = useRef(0);
  const cancelledRef = useRef(false);

  const selectedTalent = talents.find((t) => t.id === talentId);
  const hasQueue = queue.length > 0;
  const doneCount = queue.filter((q) => q.status === "done").length;
  const totalCount = queue.filter((q) => q.status !== "skipped").length;
  const allDone = hasQueue && queue.every((q) => q.status === "done" || q.status === "error" || q.status === "skipped");

  // ─── Process dropped/selected files ────────────────────────────

  const processFiles = useCallback(async (fileList: FileList | null) => {
    const { files, rejected, capped, overSize } = extractVideoFiles(fileList);
    const warns: string[] = [];
    if (rejected > 0) warns.push(`${rejected} fichier${rejected > 1 ? "s" : ""} ignore${rejected > 1 ? "s" : ""} (format non supporte)`);
    if (overSize.length > 0) warns.push(`${overSize.length} fichier${overSize.length > 1 ? "s" : ""} trop lourd${overSize.length > 1 ? "s" : ""} (> 500 Mo)`);
    if (capped) warns.push(`Maximum ${MAX_FILES} fichiers par drop`);
    if (files.length === 0) { warns.push("Aucun fichier video valide"); setWarnings(warns); return; }
    setWarnings(warns);

    // Build queue items
    const items: QueueItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      title: fileToTitle(f.name),
      status: "checking" as FileStatus,
      progress: 0,
      error: null,
      hash: null,
      duplicates: [],
      dupDismissed: false,
      videoId: null,
    }));

    setQueue((prev) => [...prev, ...items]);

    // Check duplicates for each (in parallel)
    await Promise.all(items.map(async (item) => {
      try {
        const hash = await computeHash(item.file);
        const dups = await checkDuplicate(hash, item.file.size, item.file.name);
        setQueue((prev) => prev.map((q) =>
          q.id === item.id ? { ...q, status: "ready", hash, duplicates: dups } : q
        ));
      } catch {
        setQueue((prev) => prev.map((q) =>
          q.id === item.id ? { ...q, status: "ready" } : q
        ));
      }
    }));
  }, []);

  // ─── Drag & drop handlers ─────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent | DragEvent) => {
    e.preventDefault();
    e.stopPropagation?.();
    setZoneDragOver(false);
    setPageDragOver(false);
    dragCounterRef.current = 0;
    const dt = e instanceof DragEvent ? e.dataTransfer : (e as React.DragEvent).dataTransfer;
    processFiles(dt?.files ?? null);
  }, [processFiles]);

  // Full-page drag
  useEffect(() => {
    if (uploading) return;
    function onEnter(e: DragEvent) { e.preventDefault(); dragCounterRef.current++; if (dragCounterRef.current === 1) setPageDragOver(true); }
    function onLeave(e: DragEvent) { e.preventDefault(); dragCounterRef.current--; if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setPageDragOver(false); } }
    function onOver(e: DragEvent) { e.preventDefault(); }
    function onDrop(e: DragEvent) { handleDrop(e); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { setPageDragOver(false); dragCounterRef.current = 0; } }
    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("dragover", onOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("dragenter", onEnter); document.removeEventListener("dragleave", onLeave); document.removeEventListener("dragover", onOver); document.removeEventListener("drop", onDrop); document.removeEventListener("keydown", onKey); };
  }, [uploading, handleDrop]);

  // ─── Queue management ─────────────────────────────────────────

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setQueue((prev) => prev.map((q) => q.id === id ? { ...q, ...patch } : q));
  }

  function removeItem(id: string) {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }

  function skipItem(id: string) {
    updateItem(id, { status: "skipped" });
  }

  // ─── Upload all ───────────────────────────────────────────────

  async function startUpload() {
    if (!selectedTalent || !talentId) return;
    setUploading(true);
    setCancelled(false);
    cancelledRef.current = false;

    const toUpload = queue.filter((q) => q.status === "ready" || q.status === "pending");

    for (const item of toUpload) {
      if (cancelledRef.current) break;

      // Skip items with certain duplicates that weren't dismissed
      if (item.duplicates.some((d) => d.level === "certain") && !item.dupDismissed) {
        updateItem(item.id, { status: "skipped" });
        continue;
      }

      updateItem(item.id, { status: "uploading", progress: 0 });

      try {
        // 1. Get presigned URL
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: item.file.name, contentType: item.file.type, talentSlug: selectedTalent.slug }),
        });
        if (!res.ok) throw new Error("Erreur URL");
        const { presignedUrl, r2Key } = await res.json();

        if (cancelledRef.current) break;

        // 2. Upload
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          abortRef.current = xhr;
          xhr.upload.addEventListener("progress", (ev) => {
            if (ev.lengthComputable) updateItem(item.id, { progress: Math.round((ev.loaded / ev.total) * 100) });
          });
          xhr.addEventListener("load", () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`${xhr.status}`)));
          xhr.addEventListener("error", () => reject(new Error("Reseau")));
          xhr.addEventListener("abort", () => reject(new Error("Annule")));
          xhr.open("PUT", presignedUrl);
          xhr.setRequestHeader("Content-Type", item.file.type);
          xhr.send(item.file);
        });

        if (cancelledRef.current) break;

        // 3. Thumbnail
        updateItem(item.id, { status: "thumbnail", progress: 100 });
        let thumbnailKey: string | null = null, duration: number | null = null;
        const capture = await seekAndCapture(item.file);
        if (capture) { duration = capture.duration; thumbnailKey = await uploadThumbnail(capture.blob, selectedTalent.slug); }

        // 4. Save to DB
        updateItem(item.id, { status: "saving" });
        const result = await createVideo({
          talent_id: talentId,
          title: item.title,
          r2_key: r2Key,
          file_size_bytes: item.file.size,
          duration_seconds: duration,
          thumbnail_key: thumbnailKey,
          file_hash: item.hash,
          original_filename: item.file.name,
        });
        if (result?.error) throw new Error(result.error);

        updateItem(item.id, { status: "done", videoId: result?.videoId ?? null });

        // Auto-tag in background
        if (result?.videoId && thumbnailKey) {
          fetch("/api/analyze-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ video_id: result.videoId }) }).catch(() => {});
        }
      } catch (err) {
        updateItem(item.id, { status: "error", error: err instanceof Error ? err.message : "Erreur" });
      }
    }

    setUploading(false);
    abortRef.current = null;
  }

  function handleCancel() {
    cancelledRef.current = true;
    setCancelled(true);
    abortRef.current?.abort();
  }

  function handleReset() {
    setQueue([]);
    setWarnings([]);
    setUploading(false);
    setCancelled(false);
    cancelledRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Global progress ─────────────────────────────────────────

  const globalProgress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // ─── Render ───────────────────────────────────────────────────

  const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500";
  const inputCls = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-400";

  return (
    <>
      {/* Full-page overlay */}
      {pageDragOver && !uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-white/40 px-16 py-12">
            <Upload className="h-10 w-10 text-white/70" />
            <p className="text-[18px] font-medium text-white">Deposer les videos</p>
            <p className="text-[12px] text-white/40">MP4, MOV, WebM - max 500 Mo/fichier, 10 fichiers max</p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-lg">
        {/* Talent selector */}
        <div className="mb-5">
          <label className={labelCls}>Talent</label>
          <select value={talentId} onChange={(e) => setTalentId(e.target.value)} disabled={uploading} className={`${inputCls} cursor-pointer`} style={{ opacity: uploading ? 0.5 : 1 }}>
            <option value="">Selectionner un talent</option>
            {talents.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Drop zone (shown when queue is empty) */}
        {!hasQueue && (
          <div className="mb-5">
            <label className={labelCls}>Fichiers video</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setZoneDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setZoneDragOver(false); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setZoneDragOver(false); processFiles(e.dataTransfer.files); }}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border py-10 transition-all duration-150 ${
                zoneDragOver
                  ? "animate-pulse border-solid border-neutral-400 bg-neutral-50 text-neutral-600"
                  : "border-dashed border-neutral-200 text-neutral-400 hover:border-neutral-300 hover:text-neutral-500"
              }`}
            >
              <Upload className="h-6 w-6" />
              <span className="text-[12px]">{zoneDragOver ? "Deposer ici" : "Cliquer ou glisser-deposer des fichiers"}</span>
              <span className="text-[10px] text-neutral-300">MP4, MOV, WebM - max 500 Mo/fichier, jusqu'a 10 fichiers</span>
            </button>
            <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={(e) => processFiles(e.target.files)} />
          </div>
        )}

        {/* Warnings */}
        {warnings.map((w, i) => (
          <div key={i} className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}
          </div>
        ))}

        {/* Global progress */}
        {uploading && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-neutral-500">
              <span>Progression globale : {doneCount}/{totalCount}</span>
              <span>{globalProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${globalProgress}%` }} />
            </div>
          </div>
        )}

        {/* Queue */}
        {hasQueue && (
          <div className="mb-5 space-y-1.5">
            {queue.map((item) => (
              <QueueItemCard
                key={item.id}
                item={item}
                uploading={uploading}
                onTitleChange={(title) => updateItem(item.id, { title })}
                onRemove={() => removeItem(item.id)}
                onSkip={() => skipItem(item.id)}
                onDismissDup={() => updateItem(item.id, { dupDismissed: true })}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        {hasQueue && !allDone && !uploading && (
          <div className="flex gap-2">
            <button
              onClick={startUpload}
              disabled={!talentId || queue.every((q) => q.status !== "ready")}
              className="rounded-md bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
            >
              Lancer l'upload ({queue.filter((q) => q.status === "ready").length} fichier{queue.filter((q) => q.status === "ready").length !== 1 ? "s" : ""})
            </button>
            <button onClick={handleReset} className="rounded-md border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50">
              Annuler
            </button>
          </div>
        )}

        {uploading && (
          <button onClick={handleCancel} className="rounded-md border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50">
            Annuler l'upload
          </button>
        )}

        {/* Done state */}
        {allDone && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {doneCount} video{doneCount !== 1 ? "s" : ""} uploadee{doneCount !== 1 ? "s" : ""} avec succes
              {queue.some((q) => q.status === "error") && `, ${queue.filter((q) => q.status === "error").length} erreur${queue.filter((q) => q.status === "error").length !== 1 ? "s" : ""}`}
            </div>
            <div className="flex gap-2">
              {talentId && (
                <Link
                  href={`/videos`}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
                >
                  Voir dans la galerie
                </Link>
              )}
              <button onClick={handleReset} className="rounded-md border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50">
                Uploader d'autres videos
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Queue item card ────────────────────────────────────────────

function QueueItemCard({
  item, uploading, onTitleChange, onRemove, onSkip, onDismissDup,
}: {
  item: QueueItem;
  uploading: boolean;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
  onSkip: () => void;
  onDismissDup: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  function save() {
    const t = draft.trim();
    if (t) onTitleChange(t);
    setEditing(false);
  }

  const hasDup = item.duplicates.length > 0 && !item.dupDismissed;
  const worstDup = item.duplicates[0];

  let borderLeft = "border-l-neutral-100";
  let statusIcon = null;

  if (item.status === "uploading" || item.status === "thumbnail" || item.status === "saving") {
    borderLeft = "border-l-neutral-900";
    statusIcon = <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" />;
  } else if (item.status === "done") {
    borderLeft = "border-l-emerald-500";
    statusIcon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  } else if (item.status === "error") {
    borderLeft = "border-l-red-500";
    statusIcon = <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
  } else if (item.status === "skipped") {
    borderLeft = "border-l-neutral-300";
    statusIcon = <X className="h-3.5 w-3.5 text-neutral-400" />;
  } else if (item.status === "checking") {
    statusIcon = <div className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-neutral-600" />;
  } else if (hasDup) {
    borderLeft = LEVEL_BORDERS[worstDup.level];
    statusIcon = <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  }

  return (
    <div className={`rounded-lg border border-neutral-100 border-l-[3px] bg-white p-3 transition-all ${borderLeft}`}>
      <div className="flex items-center gap-3">
        {statusIcon ?? <Film className="h-3.5 w-3.5 text-neutral-400" />}
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(item.title); setEditing(false); } }}
              className="w-full rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[12px] font-medium text-neutral-900 outline-none focus:border-neutral-400"
            />
          ) : (
            <button onClick={() => !uploading && setEditing(true)} className="truncate text-left text-[12px] font-medium text-neutral-900 hover:underline" title="Renommer">
              {item.title}
            </button>
          )}
          <p className="text-[10px] text-neutral-400">{formatBytes(item.file.size)}</p>
        </div>

        {/* Progress or status text */}
        <div className="shrink-0 text-right">
          {item.status === "uploading" && (
            <span className="text-[10px] tabular-nums text-neutral-500">{item.progress}%</span>
          )}
          {item.status === "thumbnail" && <span className="text-[10px] text-neutral-400">Thumbnail...</span>}
          {item.status === "saving" && <span className="text-[10px] text-neutral-400">Sauvegarde...</span>}
          {item.status === "checking" && <span className="text-[10px] text-neutral-400">Verification...</span>}
          {item.status === "error" && <span className="text-[10px] text-red-500">{item.error}</span>}
          {item.status === "skipped" && <span className="text-[10px] text-neutral-400">Ignore</span>}
        </div>

        {/* Actions */}
        {!uploading && (item.status === "ready" || item.status === "pending") && (
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => setEditing(true)} className="rounded p-1 text-neutral-300 hover:text-neutral-500" title="Renommer">
              <Pencil className="h-3 w-3" />
            </button>
            <button onClick={onRemove} className="rounded p-1 text-neutral-300 hover:text-red-500" title="Retirer">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Upload progress bar */}
      {item.status === "uploading" && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${item.progress}%` }} />
        </div>
      )}

      {/* Duplicate warning */}
      {hasDup && item.status !== "done" && item.status !== "skipped" && (
        <div className="mt-2 flex items-center justify-between rounded bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-700">
          <span className="truncate">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {worstDup.title} ({worstDup.reason.toLowerCase()})
          </span>
          <div className="flex shrink-0 gap-1.5 pl-2">
            <button onClick={onDismissDup} className="font-medium underline">Ignorer</button>
            <button onClick={onSkip} className="font-medium text-amber-500">Retirer</button>
          </div>
        </div>
      )}
    </div>
  );
}
