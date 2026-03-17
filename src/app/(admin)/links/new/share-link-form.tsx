"use client";

import { useState, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
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

export function ShareLinkForm({ talents, videos }: { talents: Talent[]; videos: Video[] }) {
  const [title, setTitle] = useState("");
  const [talentId, setTalentId] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expiration, setExpiration] = useState("none");
  const [allowDownload, setAllowDownload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => talentId === "all" ? videos : videos.filter((v) => v.talent_id === talentId), [videos, talentId]);
  const talentMap = useMemo(() => { const m = new Map<string, string>(); talents.forEach((t) => m.set(t.id, t.name)); return m; }, [talents]);

  function toggle(id: string) { setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleAll() { setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((v) => v.id))); }

  async function handleSubmit() {
    if (selected.size === 0) { setError("Selectionnez au moins une video."); return; }
    setError(null); setSubmitting(true);
    const result = await createShareLink({ title: title || null, talent_id: talentId === "all" ? null : talentId, video_ids: Array.from(selected), expires_at: getExpirationDate(expiration), allow_download: allowDownload });
    if (result?.error) { setError(result.error); setSubmitting(false); }
  }

  const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500";
  const inputCls = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-neutral-400";

  return (
    <div className="max-w-md">
      <div className="mb-5">
        <label className={labelCls}>Titre (optionnel)</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reel showroom Mars 2026" className={inputCls} />
      </div>
      <div className="mb-5">
        <label className={labelCls}>Filtrer par talent</label>
        <select value={talentId} onChange={(e) => { setTalentId(e.target.value); setSelected(new Set()); }} className={`${inputCls} cursor-pointer`}>
          <option value="all">Tous les talents</option>
          {talents.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Videos ({selected.size}/{filtered.length})</label>
          {filtered.length > 0 && (
            <button onClick={toggleAll} className="text-[11px] text-neutral-400 transition-colors hover:text-neutral-600">
              {selected.size === filtered.length ? "Tout deselectionner" : "Tout selectionner"}
            </button>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-200 py-8 text-center">
            <p className="text-[13px] text-neutral-400">Aucune video disponible</p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-neutral-200">
            {filtered.map((video, i) => (
              <label key={video.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-neutral-50 ${i < filtered.length - 1 ? "border-b border-neutral-100" : ""}`}>
                <input type="checkbox" checked={selected.has(video.id)} onChange={() => toggle(video.id)} className="h-3.5 w-3.5 accent-neutral-900" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-neutral-700">{video.title}</p>
                  <p className="text-[10px] text-neutral-400">{talentId === "all" && talentMap.get(video.talent_id) ? `${talentMap.get(video.talent_id)} · ` : ""}{formatDuration(video.duration_seconds)}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="mb-5">
        <label className={labelCls}>Expiration</label>
        <select value={expiration} onChange={(e) => setExpiration(e.target.value)} className={`${inputCls} cursor-pointer`}>
          {EXPIRATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="mb-6 flex items-center justify-between rounded-lg border border-neutral-200 p-3">
        <div>
          <p className="text-[12px] font-medium text-neutral-700">Autoriser le telechargement</p>
          <p className="text-[11px] text-neutral-400">Permet au destinataire de telecharger les videos.</p>
        </div>
        <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
      </div>
      {error && <p className="mb-4 text-[12px] text-red-600">{error}</p>}
      <button onClick={handleSubmit} disabled={submitting} className="rounded-md bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50">
        {submitting ? "Creation..." : "Creer le lien"}
      </button>
    </div>
  );
}
