"use client";

import { useState, useRef } from "react";
import { Loader2, Film, Palette } from "lucide-react";
import { extractFilmstripFromUrl } from "@/lib/thumbnail";

type VideoItem = {
  id: string;
  title: string;
  talentSlug: string;
  videoUrl: string;
};

type PaletteItem = {
  id: string;
  title: string;
  filmstripKeys: string[];
};

type LogEntry = {
  time: string;
  message: string;
  type: "info" | "success" | "error";
};

export default function RegeneratePage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [paletteVideos, setPaletteVideos] = useState<PaletteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const cancelledRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  function log(message: string, type: LogEntry["type"] = "info") {
    const time = new Date().toLocaleTimeString("fr-FR");
    setLogs((prev) => [...prev, { time, message, type }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  // ─── Filmstrip scan ─────────────────────────────────────────

  async function fetchVideos() {
    setLoading(true);
    setLogs([]);
    setVideos([]);
    setPaletteVideos([]);
    try {
      const res = await fetch("/api/regenerate-filmstrips");
      if (!res.ok) throw new Error("Erreur API");
      const data = await res.json();
      setVideos(data.videos);
      log(`${data.total} video(s) sans filmstrip`, "info");
    } catch (err) {
      log(`Erreur: ${err instanceof Error ? err.message : "inconnue"}`, "error");
    }
    setLoading(false);
  }

  async function runRegeneration() {
    if (videos.length === 0) return;
    setRunning(true);
    cancelledRef.current = false;
    setProgress({ current: 0, total: videos.length });

    for (let i = 0; i < videos.length; i++) {
      if (cancelledRef.current) { log("Annule", "error"); break; }

      const video = videos[i];
      setProgress({ current: i + 1, total: videos.length });
      log(`[${i + 1}/${videos.length}] ${video.title}...`);

      try {
        const blobs = await extractFilmstripFromUrl(video.videoUrl);
        if (blobs.length === 0) { log(`  Aucune frame extraite`, "error"); continue; }
        log(`  ${blobs.length} frames extraites`);

        const putRes = await fetch("/api/regenerate-filmstrips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: video.id, frameCount: blobs.length }),
        });
        if (!putRes.ok) throw new Error("Erreur presigned URLs");
        const { frames } = await putRes.json();

        const uploadedKeys: string[] = [];
        for (const frame of frames as { index: number; presignedUrl: string; r2Key: string }[]) {
          const uploadRes = await fetch(frame.presignedUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blobs[frame.index],
          });
          if (uploadRes.ok) uploadedKeys.push(frame.r2Key);
        }
        log(`  ${uploadedKeys.length} frames uploadees`);

        log(`  Extraction palette...`);
        const patchRes = await fetch("/api/regenerate-filmstrips", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: video.id, filmstripKeys: uploadedKeys }),
        });
        if (!patchRes.ok) throw new Error("Erreur DB update");
        const patchData = await patchRes.json();
        log(`  OK (${patchData.paletteColors?.length ?? 0} couleurs)`, "success");
      } catch (err) {
        log(`  Erreur: ${err instanceof Error ? err.message : "inconnue"}`, "error");
      }
    }

    setRunning(false);
    log("Termine !", "success");
  }

  // ─── Palette-only extraction ────────────────────────────────

  async function fetchPaletteVideos() {
    setLoading(true);
    setLogs([]);
    setVideos([]);
    setPaletteVideos([]);
    try {
      const res = await fetch("/api/regenerate-filmstrips", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      if (!res.ok) throw new Error("Erreur API");
      const data = await res.json();
      setPaletteVideos(data.videos);
      log(`${data.total} video(s) avec filmstrip mais sans palette`, "info");
    } catch (err) {
      log(`Erreur: ${err instanceof Error ? err.message : "inconnue"}`, "error");
    }
    setLoading(false);
  }

  async function runPaletteExtraction() {
    if (paletteVideos.length === 0) return;
    setRunning(true);
    cancelledRef.current = false;
    setProgress({ current: 0, total: paletteVideos.length });

    for (let i = 0; i < paletteVideos.length; i++) {
      if (cancelledRef.current) { log("Annule", "error"); break; }

      const video = paletteVideos[i];
      setProgress({ current: i + 1, total: paletteVideos.length });
      log(`[${i + 1}/${paletteVideos.length}] ${video.title}...`);

      try {
        const res = await fetch("/api/regenerate-filmstrips", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "extract",
            videoId: video.id,
            filmstripKeys: video.filmstripKeys,
          }),
        });
        if (!res.ok) throw new Error("Erreur extraction");
        const data = await res.json();
        log(`  OK (${data.paletteColors?.length ?? 0} couleurs)`, "success");
      } catch (err) {
        log(`  Erreur: ${err instanceof Error ? err.message : "inconnue"}`, "error");
      }
    }

    setRunning(false);
    log("Termine !", "success");
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 680 }} className="mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Film className="size-5 text-neutral-400" />
        <h1 className="text-lg font-semibold tracking-tight">Regenerer les filmstrips</h1>
      </div>

      <p className="mb-6 text-sm text-neutral-500">
        Genere les frames filmstrip et/ou extrait les palettes de couleurs pour les videos existantes.
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        {/* Filmstrip scan */}
        <button
          onClick={fetchVideos}
          disabled={loading || running}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Chargement...
            </span>
          ) : (
            "Scanner filmstrips"
          )}
        </button>

        {videos.length > 0 && !running && (
          <button
            onClick={runRegeneration}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Generer filmstrips ({videos.length})
          </button>
        )}

        {/* Palette scan */}
        <button
          onClick={fetchPaletteVideos}
          disabled={loading || running}
          className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          <Palette className="size-3.5" />
          Scanner palettes
        </button>

        {paletteVideos.length > 0 && !running && (
          <button
            onClick={runPaletteExtraction}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            <Palette className="size-3.5" />
            Extraire palettes ({paletteVideos.length})
          </button>
        )}

        {running && (
          <button
            onClick={() => { cancelledRef.current = true; }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
          >
            Annuler
          </button>
        )}
      </div>

      {/* Progress */}
      {progress.total > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-neutral-500">
            <span>{progress.current} / {progress.total}</span>
            <span>{Math.round((progress.current / progress.total) * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-neutral-900 transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="max-h-[400px] overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs">
          {logs.map((entry, i) => (
            <div
              key={i}
              className={`flex gap-2 py-0.5 ${
                entry.type === "error" ? "text-red-600" :
                entry.type === "success" ? "text-emerald-600" :
                "text-neutral-600"
              }`}
            >
              <span className="shrink-0 text-neutral-400">{entry.time}</span>
              <span>{entry.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
