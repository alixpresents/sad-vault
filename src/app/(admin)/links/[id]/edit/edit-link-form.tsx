"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { GripVertical, X, Plus, ImageIcon, Palette, SlashIcon, Video as VideoIcon } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Switch } from "@/components/ui/switch";
import type { ShareLink, Video, Talent } from "@/lib/types";
import { updateShareLink } from "../../actions";
import { SlugField } from "../../slug-field";

const EXPIRATION_OPTIONS = [
  { label: "Pas d'expiration", value: "none" },
  { label: "24 heures", value: "24h" },
  { label: "7 jours", value: "7d" },
  { label: "30 jours", value: "30d" },
  { label: "90 jours", value: "90d" },
];

function getExpirationDate(value: string): string | null {
  if (value === "none") return null;
  const now = new Date();
  switch (value) {
    case "24h": now.setHours(now.getHours() + 24); break;
    case "7d": now.setDate(now.getDate() + 7); break;
    case "30d": now.setDate(now.getDate() + 30); break;
    case "90d": now.setDate(now.getDate() + 90); break;
  }
  return now.toISOString();
}

function formatDuration(s: number | null) {
  if (!s) return "--:--";
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// Thumbnail URL cache shared across re-renders
const thumbCache = new Map<string, string>();

function SortableVideoItem({ video, onRemove }: { video: Video; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: video.id });
  const [thumbUrl, setThumbUrl] = useState<string | null>(video.thumbnail_key ? thumbCache.get(video.thumbnail_key) ?? null : null);
  const [playing, setPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Fetch thumbnail
  useEffect(() => {
    const key = video.thumbnail_key;
    if (!key) return;
    if (thumbCache.has(key)) { setThumbUrl(thumbCache.get(key)!); return; }
    let cancelled = false;
    fetch(`/api/video?key=${encodeURIComponent(key)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.presignedUrl && !cancelled) { thumbCache.set(key, d.presignedUrl); setThumbUrl(d.presignedUrl); }
      }).catch(() => {});
    return () => { cancelled = true; };
  }, [video.thumbnail_key]);

  function handleThumbClick() {
    if (playing) { setPlaying(false); setVideoUrl(null); return; }
    setPlaying(true);
    // Fetch video presigned URL
    fetch(`/api/video?key=${encodeURIComponent(video.r2_key)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.presignedUrl) setVideoUrl(d.presignedUrl); else setPlaying(false); })
      .catch(() => setPlaying(false));
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`overflow-hidden rounded-lg border border-neutral-200 bg-white ${isDragging ? "z-10 shadow-md" : ""}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button type="button" className="shrink-0 cursor-grab touch-none text-neutral-300 hover:text-neutral-500" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleThumbClick}
          className="shrink-0 overflow-hidden rounded border border-neutral-100 transition-opacity hover:opacity-80"
          style={{ width: 64, height: 36 }}
        >
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-100">
              <VideoIcon className="size-3.5 text-neutral-300" />
            </div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-neutral-700">{video.title}</p>
          <p className="text-[10px] text-neutral-400">{formatDuration(video.duration_seconds)}</p>
        </div>
        <button onClick={onRemove} className="shrink-0 rounded-md p-1 text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-500">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {playing && videoUrl && (
        <div className="border-t border-neutral-100 bg-black">
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full"
            onEnded={() => { setPlaying(false); setVideoUrl(null); }}
          />
        </div>
      )}
    </div>
  );
}

export function EditLinkForm({ link, allVideos, talents }: { link: ShareLink; allVideos: Video[]; talents: Talent[] }) {
  const [title, setTitle] = useState(link.title ?? "");
  const [customSlug, setCustomSlug] = useState(link.custom_slug ?? "");
  const [videoIds, setVideoIds] = useState<string[]>(link.video_ids);
  const [expiration, setExpiration] = useState("none");
  const [allowDownload, setAllowDownload] = useState(link.allow_download);
  const [filmstripStyle, setFilmstripStyle] = useState<"thumbnails" | "colors" | "none">(link.filmstrip_style ?? "thumbnails");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addFilter, setAddFilter] = useState("all");

  const handleSlugChange = useCallback((slug: string) => setCustomSlug(slug), []);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const videoMap = useMemo(() => { const m = new Map<string, Video>(); allVideos.forEach((v) => m.set(v.id, v)); return m; }, [allVideos]);
  const talentMap = useMemo(() => { const m = new Map<string, string>(); talents.forEach((t) => m.set(t.id, t.name)); return m; }, [talents]);
  const currentVideos = videoIds.map((id) => videoMap.get(id)).filter(Boolean) as Video[];
  const available = useMemo(() => {
    const s = new Set(videoIds);
    let f = allVideos.filter((v) => !s.has(v.id));
    if (addFilter !== "all") f = f.filter((v) => v.talent_id === addFilter);
    return f;
  }, [allVideos, videoIds, addFilter]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) setVideoIds((ids) => arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string)));
  }

  async function handleSubmit() {
    if (videoIds.length === 0) { setError("Le lien doit contenir au moins une video."); return; }
    setError(null); setSubmitting(true);
    const result = await updateShareLink(link.id, { title: title || null, custom_slug: customSlug || null, video_ids: videoIds, expires_at: getExpirationDate(expiration), allow_download: allowDownload, filmstrip_style: filmstripStyle });
    if (result?.error) { setError(result.error); setSubmitting(false); }
  }

  const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500";
  const inputCls = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-400";

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-5">
        <label className={labelCls}>Titre (optionnel)</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reel showroom Mars 2026" className={inputCls} />
      </div>
      <SlugField value={customSlug} onChange={handleSlugChange} title={title} excludeLinkId={link.id} />
      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Videos ({videoIds.length})</label>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
            <Plus className="h-3 w-3" /> Ajouter
          </button>
        </div>
        {currentVideos.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-200 py-8 text-center">
            <p className="text-[13px] text-neutral-400">Aucune video dans ce lien</p>
          </div>
        ) : (
          <DndContext id="link-videos-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={videoIds} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {currentVideos.map((v) => <SortableVideoItem key={v.id} video={v} onRemove={() => setVideoIds((ids) => ids.filter((x) => x !== v.id))} />)}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
      <div className="mb-5">
        <label className={labelCls}>Nouvelle expiration</label>
        <select value={expiration} onChange={(e) => setExpiration(e.target.value)} className={`${inputCls} cursor-pointer`}>
          {EXPIRATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {link.expires_at && (
          <p className="mt-1 text-[11px] text-neutral-400">
            Actuelle : {new Date(link.expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      <div className="mb-6 flex items-center justify-between rounded-lg border border-neutral-200 p-3">
        <div>
          <p className="text-[12px] font-medium text-neutral-700">Autoriser le telechargement</p>
          <p className="text-[11px] text-neutral-400">Permet au destinataire de telecharger les videos.</p>
        </div>
        <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
      </div>
      <FilmstripStylePicker value={filmstripStyle} onChange={setFilmstripStyle} />
      {error && <p className="mb-4 text-[12px] text-red-600">{error}</p>}
      <button onClick={handleSubmit} disabled={submitting} className="rounded-md bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50">
        {submitting ? "Enregistrement..." : "Enregistrer les modifications"}
      </button>

      {/* Add dialog */}
      {showAdd && (
        <AddVideosDialog open={showAdd} onClose={() => setShowAdd(false)} videos={available} talents={talents} talentMap={talentMap} filter={addFilter} onFilterChange={setAddFilter} onAdd={(ids) => { setVideoIds((p) => [...p, ...ids]); setShowAdd(false); }} />
      )}

    </div>
  );
}

const FILMSTRIP_OPTIONS: { value: "thumbnails" | "colors" | "none"; label: string; icon: typeof ImageIcon }[] = [
  { value: "thumbnails", label: "Vignettes", icon: ImageIcon },
  { value: "colors", label: "Palette", icon: Palette },
  { value: "none", label: "Aucun", icon: SlashIcon },
];

function FilmstripStylePicker({ value, onChange }: { value: "thumbnails" | "colors" | "none"; onChange: (v: "thumbnails" | "colors" | "none") => void }) {
  return (
    <div className="mb-6">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Style du filmstrip</label>
      <div className="grid grid-cols-3 gap-2">
        {FILMSTRIP_OPTIONS.map((opt) => {
          const active = value === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
              }`}
            >
              <Icon className="size-4" />
              <span className="text-[11px] font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddVideosDialog({ open, onClose, videos, talents, talentMap, filter, onFilterChange, onAdd }: {
  open: boolean; onClose: () => void; videos: Video[]; talents: Talent[]; talentMap: Map<string, string>; filter: string; onFilterChange: (v: string) => void; onAdd: (ids: string[]) => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  if (!open) return null;

  const inputCls = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors focus:border-neutral-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
        <h3 className="mb-4 text-[14px] font-semibold text-neutral-900">Ajouter des videos</h3>
        <select value={filter} onChange={(e) => onFilterChange(e.target.value)} className={`${inputCls} mb-3 cursor-pointer`}>
          <option value="all">Tous les talents</option>
          {talents.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {videos.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-neutral-400">Aucune video disponible</p>
        ) : (
          <div className="mb-4 max-h-60 overflow-y-auto rounded-lg border border-neutral-200">
            {videos.map((v, i) => (
              <label key={v.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-neutral-50 ${i < videos.length - 1 ? "border-b border-neutral-100" : ""}`}>
                <input type="checkbox" checked={sel.has(v.id)} onChange={() => setSel((p) => { const n = new Set(p); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n; })} className="h-3.5 w-3.5 accent-neutral-900" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-neutral-700">{v.title}</p>
                  <p className="text-[10px] text-neutral-400">{filter === "all" && talentMap.get(v.talent_id) ? `${talentMap.get(v.talent_id)} · ` : ""}{formatDuration(v.duration_seconds)}</p>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={() => { onClose(); setSel(new Set()); }} className="rounded-md border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50">Annuler</button>
          <button onClick={() => { onAdd(Array.from(sel)); setSel(new Set()); }} disabled={sel.size === 0} className="rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-40">
            Ajouter{sel.size > 0 ? ` (${sel.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
