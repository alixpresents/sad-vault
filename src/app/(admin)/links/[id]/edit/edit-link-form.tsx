"use client";

import { useState, useMemo } from "react";
import { Film, GripVertical, X, Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ShareLink, Video, Talent } from "@/lib/types";
import { updateShareLink } from "../../actions";

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
    case "24h":
      now.setHours(now.getHours() + 24);
      break;
    case "7d":
      now.setDate(now.getDate() + 7);
      break;
    case "30d":
      now.setDate(now.getDate() + 30);
      break;
    case "90d":
      now.setDate(now.getDate() + 90);
      break;
  }
  return now.toISOString();
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Sortable item ───────────────────────────────────────────────

function SortableVideoItem({
  video,
  onRemove,
}: {
  video: Video;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-md border p-2 ${
        isDragging ? "z-10 bg-muted shadow-md" : "bg-background"
      }`}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Film className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{video.title}</p>
        <p className="text-xs text-muted-foreground">
          {formatDuration(video.duration_seconds)}
        </p>
      </div>
      <Button variant="ghost" size="icon-xs" onClick={onRemove}>
        <X className="text-muted-foreground" />
      </Button>
    </div>
  );
}

// ─── Main form ───────────────────────────────────────────────────

export function EditLinkForm({
  link,
  allVideos,
  talents,
}: {
  link: ShareLink;
  allVideos: Video[];
  talents: Talent[];
}) {
  const [title, setTitle] = useState(link.title ?? "");
  const [videoIds, setVideoIds] = useState<string[]>(link.video_ids);
  const [expiration, setExpiration] = useState("none");
  const [allowDownload, setAllowDownload] = useState(link.allow_download);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addFilter, setAddFilter] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Video lookup
  const videoMap = useMemo(() => {
    const map = new Map<string, Video>();
    for (const v of allVideos) map.set(v.id, v);
    return map;
  }, [allVideos]);

  // Talent lookup
  const talentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of talents) map.set(t.id, t.name);
    return map;
  }, [talents]);

  // Current videos in order
  const currentVideos = videoIds
    .map((id) => videoMap.get(id))
    .filter(Boolean) as Video[];

  // Videos available to add (not already in the link)
  const availableVideos = useMemo(() => {
    const currentSet = new Set(videoIds);
    let filtered = allVideos.filter((v) => !currentSet.has(v.id));
    if (addFilter !== "all") {
      filtered = filtered.filter((v) => v.talent_id === addFilter);
    }
    return filtered;
  }, [allVideos, videoIds, addFilter]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setVideoIds((ids) => {
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        return arrayMove(ids, oldIndex, newIndex);
      });
    }
  }

  function removeVideo(id: string) {
    setVideoIds((ids) => ids.filter((vid) => vid !== id));
  }

  function addVideos(ids: string[]) {
    setVideoIds((prev) => [...prev, ...ids]);
    setShowAddDialog(false);
  }

  async function handleSubmit() {
    if (videoIds.length === 0) {
      setError("Le lien doit contenir au moins une video.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const result = await updateShareLink(link.id, {
      title: title || null,
      video_ids: videoIds,
      expires_at: getExpirationDate(expiration),
      allow_download: allowDownload,
    });

    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Titre (optionnel)</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Reel showroom Mars 2026"
        />
      </div>

      {/* Video list with drag-and-drop */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Videos ({videoIds.length})</Label>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus />
            Ajouter
          </Button>
        </div>

        {currentVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune video dans ce lien.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={videoIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {currentVideos.map((video) => (
                  <SortableVideoItem
                    key={video.id}
                    video={video}
                    onRemove={() => removeVideo(video.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Expiration */}
      <div className="space-y-2">
        <Label>Nouvelle expiration</Label>
        <Select value={expiration} onValueChange={setExpiration}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPIRATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {link.expires_at && (
          <p className="text-xs text-muted-foreground">
            Expiration actuelle :{" "}
            {new Date(link.expires_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {/* Download toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="allow-download">Autoriser le telechargement</Label>
          <p className="text-xs text-muted-foreground">
            Permet au destinataire de telecharger les videos.
          </p>
        </div>
        <Switch
          id="allow-download"
          checked={allowDownload}
          onCheckedChange={setAllowDownload}
        />
      </div>

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Enregistrement..." : "Enregistrer les modifications"}
      </Button>

      {/* Add videos dialog */}
      <AddVideosDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        videos={availableVideos}
        talents={talents}
        talentMap={talentMap}
        filter={addFilter}
        onFilterChange={setAddFilter}
        onAdd={addVideos}
      />
    </div>
  );
}

// ─── Add videos dialog ───────────────────────────────────────────

function AddVideosDialog({
  open,
  onOpenChange,
  videos,
  talents,
  talentMap,
  filter,
  onFilterChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videos: Video[];
  talents: Talent[];
  talentMap: Map<string, string>;
  filter: string;
  onFilterChange: (v: string) => void;
  onAdd: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    onAdd(Array.from(selected));
    setSelected(new Set());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setSelected(new Set());
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter des videos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filter */}
          <Select value={filter} onValueChange={onFilterChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les talents</SelectItem>
              {talents.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Video list */}
          {videos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucune video disponible a ajouter.
            </p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
              {videos.map((video) => (
                <label
                  key={video.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.has(video.id)}
                    onCheckedChange={() => toggle(video.id)}
                  />
                  <Film className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {video.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {filter === "all" && talentMap.get(video.talent_id)
                        ? `${talentMap.get(video.talent_id)} - `
                        : ""}
                      {formatDuration(video.duration_seconds)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setSelected(new Set());
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleAdd} disabled={selected.size === 0}>
              Ajouter {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
