// Client-side thumbnail generation from video via canvas

const THUMB_MAX_W = 960;
const THUMB_MAX_H = 540;

export function captureVideoFrame(
  video: HTMLVideoElement,
  quality = 0.92
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    if (!srcW || !srcH) {
      resolve(null);
      return;
    }

    // Downscale to max 480x270 preserving aspect ratio
    const scale = Math.min(1, THUMB_MAX_W / srcW, THUMB_MAX_H / srcH);
    const w = Math.round(srcW * scale);
    const h = Math.round(srcH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/jpeg",
      quality
    );
  });
}

export function seekAndCapture(
  file: File,
  seekTime?: number
): Promise<{ blob: Blob; duration: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const target = seekTime ?? Math.min(2, duration * 0.1);
      video.currentTime = target;
    };

    video.onseeked = async () => {
      const blob = await captureVideoFrame(video);
      const duration = Math.round(video.duration);
      URL.revokeObjectURL(objectUrl);
      if (blob) {
        resolve({ blob, duration });
      } else {
        resolve(null);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    video.src = objectUrl;
  });
}

// ─── Filmstrip extraction ─────────────────────────────────────

const FILMSTRIP_W = 80;
const FILMSTRIP_H = 45;
const FILMSTRIP_QUALITY = 0.5;
const FILMSTRIP_OFFSETS = [0.1, 0.25, 0.5, 0.75, 0.9];

// Frame quality thresholds
const MIN_BRIGHTNESS = 30;
const MIN_VARIANCE = 15;
const MAX_BW_RATIO = 0.7;
const MAX_RETRIES = 3;
const RETRY_OFFSET = 1.5;
const DIVERSITY_THRESHOLD = 20;
const DIVERSITY_OFFSET = 2;

/** Seek a video element to a time and wait */
function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    const onSeeked = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
    setTimeout(() => {
      if (!done) { done = true; video.removeEventListener("seeked", onSeeked); reject(new Error("seek timeout")); }
    }, 5000);
  });
}

type FrameAnalysis = {
  brightness: number;
  variance: number;
  bwRatio: number;
  avgR: number;
  avgG: number;
  avgB: number;
};

/** Analyze pixels of a canvas for quality */
function analyzeCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): FrameAnalysis {
  const data = ctx.getImageData(0, 0, w, h).data;
  const total = w * h;
  let sumR = 0, sumG = 0, sumB = 0, bwCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    sumR += r; sumG += g; sumB += b;
    const lum = (r + g + b) / 3;
    if (lum < 10 || lum > 245) bwCount++;
  }

  const avgR = sumR / total, avgG = sumG / total, avgB = sumB / total;
  const brightness = (avgR + avgG + avgB) / 3;

  let varSum = 0;
  for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel for speed
    varSum += (data[i] - avgR) ** 2 + (data[i + 1] - avgG) ** 2 + (data[i + 2] - avgB) ** 2;
  }
  const sampledCount = Math.ceil(data.length / 16);
  const variance = Math.sqrt(varSum / (sampledCount * 3));

  return { brightness, variance, bwRatio: bwCount / total, avgR, avgG, avgB };
}

function isFrameGood(a: FrameAnalysis): boolean {
  return a.brightness >= MIN_BRIGHTNESS && a.variance >= MIN_VARIANCE && a.bwRatio < MAX_BW_RATIO;
}

function areTooSimilar(a: FrameAnalysis, b: FrameAnalysis): boolean {
  const diff = (Math.abs(a.avgR - b.avgR) + Math.abs(a.avgG - b.avgG) + Math.abs(a.avgB - b.avgB)) / 3;
  return diff < DIVERSITY_THRESHOLD;
}

/** Core extraction: capture a single good frame with retries and quality analysis */
async function captureGoodFrame(
  video: HTMLVideoElement,
  baseTime: number,
  duration: number,
  prevAnalysis: FrameAnalysis | null,
): Promise<{ blob: Blob; analysis: FrameAnalysis } | null> {
  const canvas = document.createElement("canvas");
  canvas.width = FILMSTRIP_W;
  canvas.height = FILMSTRIP_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let time = baseTime;
  let bestBlob: Blob | null = null;
  let bestAnalysis: FrameAnalysis | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const seekTime = Math.max(0.1, Math.min(time, duration - 0.1));
    try {
      await seekVideo(video, seekTime);
      ctx.drawImage(video, 0, 0, FILMSTRIP_W, FILMSTRIP_H);
    } catch {
      time += RETRY_OFFSET;
      continue;
    }

    const analysis = analyzeCanvas(ctx, FILMSTRIP_W, FILMSTRIP_H);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", FILMSTRIP_QUALITY)
    );
    if (!blob) { time += RETRY_OFFSET; continue; }

    // Keep best candidate
    if (!bestBlob || (isFrameGood(analysis) && (!bestAnalysis || !isFrameGood(bestAnalysis)))) {
      bestBlob = blob;
      bestAnalysis = analysis;
    }

    if (isFrameGood(analysis)) {
      // Check diversity against previous frame
      if (prevAnalysis && areTooSimilar(analysis, prevAnalysis)) {
        time += DIVERSITY_OFFSET;
        continue;
      }
      return { blob, analysis };
    }

    time += RETRY_OFFSET;
  }

  // Return best we found even if not ideal
  if (bestBlob && bestAnalysis) return { blob: bestBlob, analysis: bestAnalysis };
  return null;
}

/** Load a video element from a source and wait for metadata */
function loadVideo(src: string, crossOrigin?: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    if (crossOrigin) video.crossOrigin = crossOrigin;
    let resolved = false;
    video.onloadedmetadata = () => { if (!resolved) { resolved = true; resolve(video); } };
    video.onerror = () => { if (!resolved) { resolved = true; reject(new Error("video load error")); } };
    video.src = src;
    setTimeout(() => { if (!resolved) { resolved = true; reject(new Error("video load timeout")); } }, 15000);
  });
}

/** Shared smart extraction: extracts filmstrip frames with quality analysis */
async function extractSmartFrames(
  videoSrc: string,
  crossOrigin?: string,
  cleanup?: () => void,
): Promise<Blob[]> {
  let video: HTMLVideoElement;
  try {
    video = await loadVideo(videoSrc, crossOrigin);
  } catch {
    cleanup?.();
    return [];
  }

  const duration = video.duration;
  if (!duration || duration < 1) {
    cleanup?.();
    return [];
  }

  const blobs: Blob[] = [];
  let prevAnalysis: FrameAnalysis | null = null;

  for (const offset of FILMSTRIP_OFFSETS) {
    const baseTime = Math.max(0.1, duration * offset);
    const result = await captureGoodFrame(video, baseTime, duration, prevAnalysis);
    if (result) {
      blobs.push(result.blob);
      prevAnalysis = result.analysis;
    }
  }

  cleanup?.();
  return blobs;
}

/** Extract filmstrip frames from a video File */
export async function extractFilmstripFrames(file: File): Promise<Blob[]> {
  const objectUrl = URL.createObjectURL(file);
  return extractSmartFrames(objectUrl, undefined, () => URL.revokeObjectURL(objectUrl));
}

/** Extract filmstrip frames from a video URL (for regeneration) */
export async function extractFilmstripFromUrl(videoUrl: string): Promise<Blob[]> {
  return extractSmartFrames(videoUrl, "anonymous");
}

/** Upload filmstrip frames to R2, returns array of r2Keys */
export async function uploadFilmstripFrames(
  blobs: Blob[],
  talentSlug: string,
  videoId: string
): Promise<string[]> {
  const keys: string[] = [];

  for (let i = 0; i < blobs.length; i++) {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: `filmstrip-${i}.jpg`,
        contentType: "image/jpeg",
        talentSlug,
        type: "filmstrip",
        videoId,
        frameIndex: i,
      }),
    });
    if (!res.ok) continue;

    const { presignedUrl, r2Key } = await res.json();
    const uploadRes = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: blobs[i],
    });
    if (uploadRes.ok) keys.push(r2Key);
  }

  return keys;
}

export async function uploadThumbnail(
  blob: Blob,
  talentSlug: string
): Promise<string | null> {
  // Get presigned URL for thumbnail
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "thumbnail.jpg",
      contentType: "image/jpeg",
      talentSlug,
      type: "thumbnail",
    }),
  });

  if (!res.ok) return null;

  const { presignedUrl, r2Key } = await res.json();

  // Upload the JPEG blob
  const uploadRes = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });

  if (!uploadRes.ok) return null;

  return r2Key;
}
