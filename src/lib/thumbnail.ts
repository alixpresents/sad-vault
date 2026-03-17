// Client-side thumbnail generation from video via canvas

export function captureVideoFrame(
  video: HTMLVideoElement,
  quality = 0.85
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
