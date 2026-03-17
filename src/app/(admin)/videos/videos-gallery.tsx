"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, X, Play, Camera, RefreshCw, Trash2, Pencil, ChevronLeft, ChevronRight,
  Link2, CheckSquare, Square, Film,
} from "lucide-react";
import type { Video } from "@/lib/types";
import { deleteVideo, updateVideoTitle, replaceVideo, updateVideoThumbnail } from "@/app/(admin)/uploads/actions";
import { seekAndCapture, uploadThumbnail } from "@/lib/thumbnail";
import { ConfirmDialog } from "@/components/confirm-dialog";

type VideoWithTalent = Video & { talent_name: string; talent_slug: string };
type VideoStats = { link_count: number; view_count: number };
type SortKey = "recent" | "oldest" | "largest" | "az";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Plus recentes" },
  { key: "oldest", label: "Plus anciennes" },
  { key: "largest", label: "Plus lourdes" },
  { key: "az", label: "A-Z" },
];

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

// ─── Helpers ────────────────────────────────────────────────────

function formatDuration(s: number | null) {
  if (!s) return "";
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  const k = 1024, sizes = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getRelativeTime(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD < 30) return `il y a ${diffD}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function sortVideos(videos: VideoWithTalent[], sort: SortKey): VideoWithTalent[] {
  const sorted = [...videos];
  switch (sort) {
    case "recent": return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case "oldest": return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case "largest": return sorted.sort((a, b) => (b.file_size_bytes ?? 0) - (a.file_size_bytes ?? 0));
    case "az": return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default: return sorted;
  }
}

// ─── Main component ─────────────────────────────────────────────

export function VideosGallery({
  videos: allVideos,
  talents,
  stats,
}: {
  videos: VideoWithTalent[];
  talents: { id: string; name: string }[];
  stats: Record<string, VideoStats>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [talentFilter, setTalentFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = allVideos;
    if (talentFilter !== "all") list = list.filter((v) => v.talent_id === talentFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((v) => v.title.toLowerCase().includes(q) || v.talent_name.toLowerCase().includes(q));
    }
    return sortVideos(list, sort);
  }, [allVideos, talentFilter, debouncedSearch, sort]);

  // Multi-select
  function toggleSelect(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAll() { setSelected(new Set(filtered.map((v) => v.id))); }
  function deselectAll() { setSelected(new Set()); }

  // Delete
  async function handleDelete() {
    if (!deleteId) return;
    const video = allVideos.find((v) => v.id === deleteId);
    if (!video) return;
    setDeleting(true);
    await deleteVideo(deleteId, video.talent_id);
    setDeleting(false);
    setDeleteId(null);
    setModalIndex(null);
    router.refresh();
  }

  // Keyboard navigation for modal
  useEffect(() => {
    if (modalIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalIndex(null);
      if (e.key === "ArrowLeft") setModalIndex((i) => i !== null && i > 0 ? i - 1 : i);
      if (e.key === "ArrowRight") setModalIndex((i) => i !== null && i < filtered.length - 1 ? i + 1 : i);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [modalIndex, filtered.length]);

  return (
    <>
      {/* Header */}
      <div className="anim-in anim-d1 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-neutral-900">Videos</h1>
          <span className="text-[12px] text-neutral-400">{allVideos.length} video{allVideos.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-52 rounded-lg border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-[12px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 outline-none transition-colors hover:border-neutral-300"
          >
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Talent filter pills */}
      <div className="anim-in anim-d2 mb-6 flex flex-wrap gap-1">
        <button
          onClick={() => setTalentFilter("all")}
          className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-all ${
            talentFilter === "all"
              ? "bg-white font-semibold text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          Tous
        </button>
        {talents.map((t) => (
          <button
            key={t.id}
            onClick={() => setTalentFilter(t.id)}
            className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-all ${
              talentFilter === t.id
                ? "bg-white font-semibold text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="anim-in anim-d3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-200 py-14 text-center">
            <p className="text-[14px] font-medium text-neutral-500">Aucune video trouvee</p>
            {debouncedSearch && <p className="mt-1 text-[13px] text-neutral-400">Essayez un autre terme de recherche</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((video, idx) => {
              const st = stats[video.id];
              const isSelected = selected.has(video.id);
              return (
                <VideoGridCard
                  key={video.id}
                  video={video}
                  stats={st}
                  isSelected={isSelected}
                  onSelect={() => toggleSelect(video.id)}
                  onPlay={() => setModalIndex(idx)}
                  onDelete={() => setDeleteId(video.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Multi-select bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white px-6 py-3 shadow-lg">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-neutral-900">{selected.size} video{selected.size !== 1 ? "s" : ""} selectionnee{selected.size !== 1 ? "s" : ""}</span>
              <button onClick={selectAll} className="text-[11px] text-neutral-400 hover:text-neutral-600">Tout selectionner</button>
              <button onClick={deselectAll} className="text-[11px] text-neutral-400 hover:text-neutral-600">Deselectionner</button>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/links/new?videos=${Array.from(selected).join(",")}`}
                className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800"
              >
                <Link2 className="h-3.5 w-3.5" />
                Creer un lien
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal player */}
      {modalIndex !== null && filtered[modalIndex] && (
        <VideoModal
          video={filtered[modalIndex]}
          stats={stats[filtered[modalIndex].id]}
          onClose={() => setModalIndex(null)}
          onPrev={modalIndex > 0 ? () => setModalIndex(modalIndex - 1) : undefined}
          onNext={modalIndex < filtered.length - 1 ? () => setModalIndex(modalIndex + 1) : undefined}
          onDelete={() => { setDeleteId(filtered[modalIndex].id); }}
          onRefresh={() => router.refresh()}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer cette video ?"
        message="Cette action est irreversible."
        confirmLabel={deleting ? "Suppression..." : "Supprimer"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}

// ─── Grid card ──────────────────────────────────────────────────

function VideoGridCard({
  video, stats, isSelected, onSelect, onPlay, onDelete,
}: {
  video: VideoWithTalent;
  stats?: VideoStats;
  isSelected: boolean;
  onSelect: () => void;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!video.thumbnail_key) return;
    let cancelled = false;
    fetch(`/api/video?key=${encodeURIComponent(video.thumbnail_key)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && !cancelled) setThumbUrl(d.presignedUrl); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [video.thumbnail_key]);

  return (
    <div className="group">
      {/* Thumbnail */}
      <div
        className="relative aspect-video cursor-pointer overflow-hidden rounded-lg bg-neutral-100 transition-all group-hover:scale-[1.02] group-hover:shadow-md"
        onClick={onPlay}
      >
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {video.thumbnail_key ? (
              <Film className="h-6 w-6 text-neutral-300" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Camera className="h-5 w-5 text-neutral-300" />
                <span className="text-[9px] text-neutral-300">Pas de thumbnail</span>
              </div>
            )}
          </div>
        )}

        {/* Duration badge */}
        {video.duration_seconds && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] tabular-nums text-white">
            {formatDuration(video.duration_seconds)}
          </span>
        )}

        {/* Hover overlay actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
          <div className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white">
            <Play className="ml-0.5 h-4 w-4" />
          </div>
        </div>

        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={`absolute left-2 top-2 rounded transition-all ${
            isSelected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isSelected ? (
            <CheckSquare className="h-5 w-5 text-white drop-shadow" />
          ) : (
            <Square className="h-5 w-5 text-white/70 drop-shadow" />
          )}
        </button>
      </div>

      {/* Info */}
      <div className="mt-2">
        <p className="truncate text-[13px] font-semibold text-neutral-900">{video.title}</p>
        <p className="text-[11px] text-neutral-400">{video.talent_name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-300">
          {video.file_size_bytes && <span>{formatBytes(video.file_size_bytes)}</span>}
          <span>{getRelativeTime(video.created_at)}</span>
        </div>
        {stats && (stats.link_count > 0 || stats.view_count > 0) && (
          <p className="mt-0.5 text-[10px] text-neutral-300">
            {stats.link_count} lien{stats.link_count !== 1 ? "s" : ""} · {stats.view_count} vue{stats.view_count !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Modal player ───────────────────────────────────────────────

function VideoModal({
  video, stats, onClose, onPrev, onNext, onDelete, onRefresh,
}: {
  video: VideoWithTalent;
  stats?: VideoStats;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(video.title);
  const titleRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState(0);

  // Load video URL
  useEffect(() => {
    setLoading(true);
    setVideoUrl(null);
    fetch(`/api/video?key=${encodeURIComponent(video.r2_key)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setVideoUrl(d.presignedUrl); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [video.r2_key]);

  // Reset title when video changes
  useEffect(() => {
    setTitleDraft(video.title);
    setEditingTitle(false);
  }, [video.id, video.title]);

  useEffect(() => {
    if (editingTitle) { titleRef.current?.focus(); titleRef.current?.select(); }
  }, [editingTitle]);

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === video.title) { setEditingTitle(false); setTitleDraft(video.title); return; }
    await updateVideoTitle(video.id, video.talent_id, trimmed);
    setEditingTitle(false);
    onRefresh();
  }

  const handleReplace = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (replaceRef.current) replaceRef.current.value = "";
    if (!file || !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) return;

    setReplacing(true);
    setReplaceProgress(0);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, talentSlug: video.talent_slug, replaceKey: video.r2_key }),
      });
      if (!res.ok) throw new Error();
      const { presignedUrl } = await res.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (ev) => { if (ev.lengthComputable) setReplaceProgress(Math.round((ev.loaded / ev.total) * 100)); });
        xhr.addEventListener("load", () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject());
        xhr.addEventListener("error", () => reject());
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      let thumbnailKey = video.thumbnail_key;
      let duration = video.duration_seconds;
      const capture = await seekAndCapture(file);
      if (capture) {
        duration = capture.duration;
        const newKey = await uploadThumbnail(capture.blob, video.talent_slug);
        if (newKey) thumbnailKey = newKey;
      }

      await replaceVideo(video.id, video.talent_id, { file_size_bytes: file.size, duration_seconds: duration, thumbnail_key: thumbnailKey });
      onRefresh();
    } catch { /* silent */ }
    setReplacing(false);
  }, [video, onRefresh]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-4xl px-4" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} className="absolute -top-10 right-4 rounded-full p-2 text-white/60 transition-colors hover:text-white">
          <X className="h-5 w-5" />
        </button>

        {/* Nav arrows */}
        {onPrev && (
          <button onClick={onPrev} className="absolute -left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/60 transition-colors hover:text-white sm:-left-12">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {onNext && (
          <button onClick={onNext} className="absolute -right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/60 transition-colors hover:text-white sm:-right-12">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {/* Player */}
        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          ) : videoUrl ? (
            <video src={videoUrl} controls autoPlay playsInline className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-white/40">Impossible de charger la video</div>
          )}
          {replacing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
              <p className="text-[12px] text-white">Remplacement... {replaceProgress}%</p>
              <div className="h-1 w-1/2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${replaceProgress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <input
                ref={titleRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(video.title); } }}
                className="w-full rounded border border-white/20 bg-transparent px-1 py-0.5 text-[14px] font-medium text-white outline-none"
              />
            ) : (
              <button onClick={() => setEditingTitle(true)} className="truncate text-left text-[14px] font-medium text-white hover:underline" title="Cliquer pour renommer">
                {video.title}
              </button>
            )}
            <div className="mt-1 flex items-center gap-3 text-[12px] text-white/40">
              <Link href={`/talents/${video.talent_id}`} className="hover:text-white/70" onClick={onClose}>{video.talent_name}</Link>
              {video.duration_seconds && <span>{formatDuration(video.duration_seconds)}</span>}
              {video.file_size_bytes && <span>{formatBytes(video.file_size_bytes)}</span>}
              <span>{getRelativeTime(video.created_at)}</span>
            </div>
            {stats && (
              <p className="mt-1 text-[11px] text-white/30">
                {stats.link_count} lien{stats.link_count !== 1 ? "s" : ""} · {stats.view_count} vue{stats.view_count !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => setEditingTitle(true)} className="rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70" title="Renommer">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => replaceRef.current?.click()} disabled={replacing} className="rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70" title="Remplacer">
              <RefreshCw className={`h-3.5 w-3.5 ${replacing ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onDelete} className="rounded-md p-1.5 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400" title="Supprimer">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <input ref={replaceRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleReplace} />
      </div>
    </div>
  );
}
