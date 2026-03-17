"use client";

import { useState, useMemo } from "react";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Talent, Video } from "@/lib/types";
import { createShareLink } from "../actions";

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

export function ShareLinkForm({
  talents,
  videos,
}: {
  talents: Talent[];
  videos: Video[];
}) {
  const [title, setTitle] = useState("");
  const [talentId, setTalentId] = useState<string>("all");
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    new Set()
  );
  const [expiration, setExpiration] = useState("none");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filter videos by selected talent
  const filteredVideos = useMemo(() => {
    if (talentId === "all") return videos;
    return videos.filter((v) => v.talent_id === talentId);
  }, [videos, talentId]);

  // Build talent name lookup
  const talentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of talents) map.set(t.id, t.name);
    return map;
  }, [talents]);

  function toggleVideo(id: string) {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedVideoIds.size === filteredVideos.length) {
      setSelectedVideoIds(new Set());
    } else {
      setSelectedVideoIds(new Set(filteredVideos.map((v) => v.id)));
    }
  }

  async function handleSubmit() {
    if (selectedVideoIds.size === 0) {
      setError("Selectionnez au moins une video.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const result = await createShareLink({
      title: title || null,
      talent_id: talentId === "all" ? null : talentId,
      video_ids: Array.from(selectedVideoIds),
      expires_at: getExpirationDate(expiration),
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

      {/* Talent filter */}
      <div className="space-y-2">
        <Label>Filtrer par talent</Label>
        <Select
          value={talentId}
          onValueChange={(v) => {
            setTalentId(v);
            setSelectedVideoIds(new Set());
          }}
        >
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
      </div>

      {/* Video selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>
            Videos ({selectedVideoIds.size}/{filteredVideos.length})
          </Label>
          {filteredVideos.length > 0 && (
            <Button variant="ghost" size="xs" onClick={toggleAll}>
              {selectedVideoIds.size === filteredVideos.length
                ? "Tout deselectionner"
                : "Tout selectionner"}
            </Button>
          )}
        </div>

        {filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune video disponible.
            </p>
          </div>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border p-2">
            {filteredVideos.map((video) => (
              <label
                key={video.id}
                className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
              >
                <Checkbox
                  checked={selectedVideoIds.has(video.id)}
                  onCheckedChange={() => toggleVideo(video.id)}
                />
                <Film className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{video.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {talentId === "all" && talentMap.get(video.talent_id)
                      ? `${talentMap.get(video.talent_id)} - `
                      : ""}
                    {formatDuration(video.duration_seconds)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Expiration */}
      <div className="space-y-2">
        <Label>Expiration</Label>
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
      </div>

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Creation..." : "Creer le lien"}
      </Button>
    </div>
  );
}
