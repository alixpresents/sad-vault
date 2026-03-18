"use client";

import { useState, useRef } from "react";
import { Loader2, Film } from "lucide-react";
import { extractFilmstripFromUrl } from "@/lib/thumbnail";

type VideoItem = {
  id: string;
  title: string;
  talentSlug: string;
  videoUrl: string;
};

type LogEntry = {
  time: string;
  message: string;
  type: "info" | "success" | "error";
};

export default function RegeneratePage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
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

  async function fetchVideos() {
    setLoading(true);
    setLogs([]);
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
      if (cancelledRef.current) {
        log("Annule par l'utilisateur", "error");
        break;
      }

      const video = videos[i];
      setProgress({ current: i + 1, total: videos.length });
      log(`[${i + 1}/${videos.length}] ${video.title}...`);

      try {
        // 1. Extract frames client-side
        const blobs = await extractFilmstripFromUrl(video.videoUrl);
        if (blobs.length === 0) {
          log(`  Aucune frame extraite (video trop courte ou erreur)`, "error");
          continue;
        }
        log(`  ${blobs.length} frames extraites`);

        // 2. Get presigned PUT URLs
        const putRes = await fetch("/api/regenerate-filmstrips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: video.id, frameCount: blobs.length }),
        });
        if (!putRes.ok) throw new Error("Erreur presigned URLs");
        const { frames } = await putRes.json();

        // 3. Upload each frame
        const uploadedKeys: string[] = [];
        for (const frame of frames as { index: number; presignedUrl: string; r2Key: string }[]) {
          const uploadRes = await fetch(frame.presignedUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blobs[frame.index],
          });
          if (uploadRes.ok) {
            uploadedKeys.push(frame.r2Key);
          }
        }
        log(`  ${uploadedKeys.length} frames uploadees`);

        // 4. Update DB + extract palette colors server-side
        log(`  Extraction palette...`);
        const patchRes = await fetch("/api/regenerate-filmstrips", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: video.id, filmstripKeys: uploadedKeys }),
        });
        if (!patchRes.ok) throw new Error("Erreur DB update");
        const patchData = await patchRes.json();
        const colorCount = patchData.paletteColors?.length ?? 0;

        log(`  OK (${colorCount} couleurs)`, "success");
      } catch (err) {
        log(`  Erreur: ${err instanceof Error ? err.message : "inconnue"}`, "error");
      }
    }

    setRunning(false);
    log("Termine !", "success");
  }

  return (
    <div style={{ maxWidth: 680 }} className="mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Film className="size-5 text-neutral-400" />
        <h1 className="text-lg font-semibold tracking-tight">Regenerer les filmstrips</h1>
      </div>

      <p className="mb-6 text-sm text-neutral-500">
        Genere les 5 frames filmstrip pour toutes les videos existantes qui n'en ont pas encore.
        Le process tourne dans le navigateur (extraction canvas), video par video.
      </p>

      <div className="mb-6 flex gap-3">
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
            "Scanner les videos"
          )}
        </button>

        {videos.length > 0 && !running && (
          <button
            onClick={runRegeneration}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Lancer ({videos.length} video{videos.length > 1 ? "s" : ""})
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

