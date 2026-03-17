"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Video } from "@/lib/types";

interface ViewEvent {
  id: string;
  video_id: string;
  session_id: string;
  duration_seconds: number;
  completed: boolean;
  created_at: string;
  user_agent: string | null;
}

interface VideoStats {
  videoId: string;
  title: string;
  totalViews: number;
  avgDuration: number;
  completionRate: number;
}

interface Session {
  sessionId: string;
  date: string;
  totalDuration: number;
  videosWatched: string[];
}

function formatDuration(s: number) {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m${sec > 0 ? ` ${sec}s` : ""}`;
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

export function LinkAnalytics({
  shareLinkId,
  videos,
}: {
  shareLinkId: string;
  videos: Video[];
}) {
  const [events, setEvents] = useState<ViewEvent[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("view_events")
      .select("id, video_id, session_id, duration_seconds, completed, created_at, user_agent")
      .eq("share_link_id", shareLinkId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEvents((data as ViewEvent[]) ?? []);
        setLoading(false);
      });
  }, [shareLinkId]);

  if (loading) {
    return (
      <div className="mt-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Analytics</p>
        <div className="h-32 rounded-lg border border-neutral-200 bg-neutral-50" />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="mt-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Analytics</p>
        <div className="rounded-lg border border-dashed border-neutral-200 py-8 text-center">
          <p className="text-[13px] text-neutral-400">Aucune vue pour le moment</p>
        </div>
      </div>
    );
  }

  // Build video name map
  const videoMap = new Map<string, string>();
  for (const v of videos) videoMap.set(v.id, v.title);

  // Unique sessions
  const uniqueSessions = new Set(events.map((e) => e.session_id));

  // Per-video stats
  const videoStatsMap = new Map<string, { views: number; totalDuration: number; completedCount: number }>();
  for (const e of events) {
    let s = videoStatsMap.get(e.video_id);
    if (!s) {
      s = { views: 0, totalDuration: 0, completedCount: 0 };
      videoStatsMap.set(e.video_id, s);
    }
    s.views++;
    s.totalDuration += e.duration_seconds;
    if (e.completed) s.completedCount++;
  }

  const videoStats: VideoStats[] = Array.from(videoStatsMap.entries()).map(([videoId, s]) => ({
    videoId,
    title: videoMap.get(videoId) || "Video supprimee",
    totalViews: s.views,
    avgDuration: s.views > 0 ? s.totalDuration / s.views : 0,
    completionRate: s.views > 0 ? (s.completedCount / s.views) * 100 : 0,
  }));

  // Recent sessions (last 10)
  const sessionMap = new Map<string, { date: string; totalDuration: number; videoIds: Set<string> }>();
  for (const e of events) {
    let s = sessionMap.get(e.session_id);
    if (!s) {
      s = { date: e.created_at, totalDuration: 0, videoIds: new Set() };
      sessionMap.set(e.session_id, s);
    }
    s.totalDuration += e.duration_seconds;
    s.videoIds.add(e.video_id);
    if (e.created_at > s.date) s.date = e.created_at;
  }

  const recentSessions: Session[] = Array.from(sessionMap.entries())
    .map(([sessionId, s]) => ({
      sessionId,
      date: s.date,
      totalDuration: s.totalDuration,
      videosWatched: Array.from(s.videoIds).map((id) => videoMap.get(id) || "?"),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="mt-8">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Analytics</p>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Sessions</p>
          <p className="mt-0.5 text-[20px] font-semibold tabular-nums text-neutral-900">{uniqueSessions.size}</p>
          <p className="text-[10px] text-neutral-400">visiteurs distincts</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Vues totales</p>
          <p className="mt-0.5 text-[20px] font-semibold tabular-nums text-neutral-900">{events.length}</p>
          <p className="text-[10px] text-neutral-400">lectures de videos</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Duree moyenne</p>
          <p className="mt-0.5 text-[20px] font-semibold tabular-nums text-neutral-900">
            {formatDuration(events.reduce((s, e) => s + e.duration_seconds, 0) / events.length)}
          </p>
          <p className="text-[10px] text-neutral-400">par video</p>
        </div>
      </div>

      {/* Per-video stats */}
      {videoStats.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-[11px] font-medium text-neutral-500">Par video</p>
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <div className="grid grid-cols-[1fr_60px_80px_80px] border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              <span>Video</span>
              <span className="text-right">Vues</span>
              <span className="text-right">Duree moy.</span>
              <span className="text-right">Completion</span>
            </div>
            {videoStats.map((vs) => (
              <div
                key={vs.videoId}
                className="grid grid-cols-[1fr_60px_80px_80px] border-b border-neutral-100 px-3 py-2.5 last:border-b-0"
              >
                <span className="truncate text-[12px] text-neutral-700">{vs.title}</span>
                <span className="text-right text-[12px] tabular-nums text-neutral-900">{vs.totalViews}</span>
                <span className="text-right text-[12px] tabular-nums text-neutral-500">
                  {formatDuration(vs.avgDuration)}
                </span>
                <span className="text-right text-[12px] tabular-nums text-neutral-500">
                  {Math.round(vs.completionRate)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      <div>
        <p className="mb-2 text-[11px] font-medium text-neutral-500">Dernieres sessions</p>
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          {recentSessions.map((session, i) => (
            <div
              key={session.sessionId}
              className={`flex items-center justify-between px-3 py-2.5 ${
                i < recentSessions.length - 1 ? "border-b border-neutral-100" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] text-neutral-700">
                  {session.videosWatched.join(", ")}
                </p>
                <p className="text-[10px] text-neutral-400">
                  {getRelativeTime(session.date)} · {formatDuration(session.totalDuration)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-neutral-500">
                {session.videosWatched.length} video{session.videosWatched.length !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
