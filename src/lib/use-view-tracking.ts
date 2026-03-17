"use client";

import { useRef, useCallback, useEffect } from "react";

interface TrackingConfig {
  shareLinkId: string;
  sessionId: string;
}

const DEBOUNCE_MS = 10_000;

/** Sends a view event to the analytics API (debounced) */
function sendEvent(
  config: TrackingConfig,
  videoId: string,
  durationSeconds: number,
  completed: boolean
) {
  // Use sendBeacon for reliability (works on page unload)
  const payload = JSON.stringify({
    share_link_id: config.shareLinkId,
    video_id: videoId,
    session_id: config.sessionId,
    duration_seconds: Math.round(durationSeconds),
    completed,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", new Blob([payload], { type: "application/json" }));
  } else {
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}

/**
 * Hook that returns an `onVideoEvent` callback to attach to video elements.
 * Tracks play, pause, ended, and periodically sends duration updates.
 */
export function useViewTracking(config: TrackingConfig) {
  // Track per-video state: { videoId -> { startTime, lastSentAt, duration } }
  const stateRef = useRef<Map<string, {
    playStartedAt: number | null;
    accumulatedSeconds: number;
    lastSentAt: number;
    completed: boolean;
  }>>(new Map());

  const configRef = useRef(config);
  configRef.current = config;

  const getOrCreate = useCallback((videoId: string) => {
    let s = stateRef.current.get(videoId);
    if (!s) {
      s = { playStartedAt: null, accumulatedSeconds: 0, lastSentAt: 0, completed: false };
      stateRef.current.set(videoId, s);
    }
    return s;
  }, []);

  const flushVideo = useCallback((videoId: string, completed: boolean = false) => {
    const s = getOrCreate(videoId);
    const now = Date.now();

    // Accumulate time if currently playing
    if (s.playStartedAt) {
      s.accumulatedSeconds += (now - s.playStartedAt) / 1000;
      s.playStartedAt = now; // reset for next interval
    }

    if (completed) s.completed = true;

    // Debounce: only send if enough time has passed or if completed
    if (s.accumulatedSeconds > 0 && (completed || now - s.lastSentAt >= DEBOUNCE_MS)) {
      sendEvent(configRef.current, videoId, s.accumulatedSeconds, s.completed);
      s.lastSentAt = now;
    }
  }, [getOrCreate]);

  // Periodic flush every 10s for active videos
  useEffect(() => {
    const interval = setInterval(() => {
      for (const [videoId, s] of stateRef.current) {
        if (s.playStartedAt) {
          flushVideo(videoId);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearInterval(interval);
  }, [flushVideo]);

  // Flush all on page unload
  useEffect(() => {
    const handleUnload = () => {
      for (const [videoId, s] of stateRef.current) {
        if (s.accumulatedSeconds > 0 || s.playStartedAt) {
          if (s.playStartedAt) {
            s.accumulatedSeconds += (Date.now() - s.playStartedAt) / 1000;
            s.playStartedAt = null;
          }
          sendEvent(configRef.current, videoId, s.accumulatedSeconds, s.completed);
        }
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  /** Call this when a video starts playing */
  const onPlay = useCallback((videoId: string) => {
    const s = getOrCreate(videoId);
    if (!s.playStartedAt) {
      s.playStartedAt = Date.now();
    }
    // Send start event immediately (first touch)
    if (s.lastSentAt === 0) {
      sendEvent(configRef.current, videoId, 0, false);
      s.lastSentAt = Date.now();
    }
  }, [getOrCreate]);

  /** Call this when a video pauses */
  const onPause = useCallback((videoId: string) => {
    flushVideo(videoId);
    const s = getOrCreate(videoId);
    if (s.playStartedAt) {
      s.accumulatedSeconds += (Date.now() - s.playStartedAt) / 1000;
      s.playStartedAt = null;
    }
  }, [flushVideo, getOrCreate]);

  /** Call this when a video ends */
  const onEnded = useCallback((videoId: string) => {
    const s = getOrCreate(videoId);
    if (s.playStartedAt) {
      s.accumulatedSeconds += (Date.now() - s.playStartedAt) / 1000;
      s.playStartedAt = null;
    }
    s.completed = true;
    sendEvent(configRef.current, videoId, s.accumulatedSeconds, true);
    s.lastSentAt = Date.now();
  }, [getOrCreate]);

  return { onPlay, onPause, onEnded };
}
