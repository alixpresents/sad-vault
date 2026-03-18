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
const FILMSTRIP_OFFSETS = [0.1, 0.25, 0.5, 0.75, 0.9]; // % of duration

/** Extract 5 filmstrip frames from a video File at fixed % offsets */
export function extractFilmstripFrames(
  file: File
): Promise<Blob[]> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    const blobs: Blob[] = [];
    let index = 0;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!duration || duration < 1) {
        URL.revokeObjectURL(objectUrl);
        resolve([]);
        return;
      }
      seekNext(duration);
    };

    function seekNext(duration: number) {
      if (index >= FILMSTRIP_OFFSETS.length) {
        URL.revokeObjectURL(objectUrl);
        resolve(blobs);
        return;
      }
      const time = Math.max(0.1, duration * FILMSTRIP_OFFSETS[index]);
      video.currentTime = time;
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
          ctx.drawImage(video, 0, 0, FILMSTRIP_W, FILMSTRIP_H);
          const blob = await new Promise<Blob | null>((res) =>
            canvas.toBlob((b) => res(b), "image/jpeg", FILMSTRIP_QUALITY)
          );
          if (blob) blobs.push(blob);
        }
      }
      index++;
      seekNext(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(blobs);
    };

    video.src = objectUrl;
  });
}

/** Extract filmstrip frames from a video URL (for regeneration of existing videos) */
export function extractFilmstripFromUrl(
  videoUrl: string
): Promise<Blob[]> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "use-credentials";

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
      const time = Math.max(0.1, duration * FILMSTRIP_OFFSETS[index]);
      video.currentTime = time;
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
            // Canvas tainted — skip this frame
          }
        }
      }
      index++;
      seekNext(video.duration);
    };

    video.onerror = () => {
      resolve(blobs);
    };

    video.src = videoUrl;
  });
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
