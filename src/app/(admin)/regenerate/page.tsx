"use client";

import { useState, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle, Film } from "lucide-react";

const FILMSTRIP_W = 80;
const FILMSTRIP_H = 45;
const FILMSTRIP_QUALITY = 0.5;
const FILMSTRIP_OFFSETS = [0.1, 0.25, 0.5, 0.75, 0.9];

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
        const blobs = await extractFrames(video.videoUrl);
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

        // 4. Update DB
        const patchRes = await fetch("/api/regenerate-filmstrips", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: video.id, filmstripKeys: uploadedKeys }),
        });
        if (!patchRes.ok) throw new Error("Erreur DB update");

        log(`  OK`, "success");
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

/** Extract filmstrip frames from a video URL using canvas */
function extractFrames(videoUrl: string): Promise<Blob[]> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const blobs: Blob[] = [];
    let index = 0;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!duration || duration < 1) {
        resolve([]);
        return;
      }
      seekNext(duration);
    };

    function seekNext(duration: number) {
      if (index >= FILMSTRIP_OFFSETS.length) {
        resolve(blobs);
        return;
      }
      video.currentTime = Math.max(0.1, duration * FILMSTRIP_OFFSETS[index]);
    }

    video.onseeked = async () => {
      const srcW = video.videoWidth;
      const srcH = video.videoHeight;
      if (srcW && srcH) {
        const canvas = document.createElement("canvas");
        canvas.width = FILMSTRIP_W;
        canvas.height = FILMSTRIP_H;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0, FILMSTRIP_W, FILMSTRIP_H);
            const blob = await new Promise<Blob | null>((res) =>
              canvas.toBlob((b) => res(b), "image/jpeg", FILMSTRIP_QUALITY)
            );
            if (blob) blobs.push(blob);
          } catch {
            // Canvas tainted — skip
          }
        }
      }
      index++;
      seekNext(video.duration);
    };

    video.onerror = () => resolve(blobs);

    // Timeout after 30s per video
    setTimeout(() => resolve(blobs), 30000);

    video.src = videoUrl;
  });
}
