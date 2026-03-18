import sharp from "sharp";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "@/lib/r2";

/** Extract palette colors from filmstrip R2 keys (server-side, using sharp) */
export async function extractPaletteFromR2Keys(
  r2Keys: string[]
): Promise<string[]> {
  const allColors: { r: number; g: number; b: number; h: number; count: number }[] = [];

  for (const key of r2Keys) {
    try {
      // Download the frame from R2
      const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
      const response = await r2.send(command);
      if (!response.Body) continue;

      const bytes = await response.Body.transformToByteArray();

      // Resize to 10x10 with sharp (natural color averaging)
      const { data, info } = await sharp(Buffer.from(bytes))
        .resize(10, 10, { fit: "cover" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Extract colors via quantization
      const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

      for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Skip near-black and near-white
        const brightness = (r + g + b) / 3;
        if (brightness < 20 || brightness > 235) continue;

        // Quantize to multiples of 32
        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;
        const bucketKey = `${qr},${qg},${qb}`;

        const existing = buckets.get(bucketKey);
        if (existing) {
          existing.r += r;
          existing.g += g;
          existing.b += b;
          existing.count++;
        } else {
          buckets.set(bucketKey, { r, g, b, count: 1 });
        }
      }

      // Take top 2-3 colors from this frame
      const sorted = [...buckets.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      for (const bucket of sorted) {
        const avgR = Math.round(bucket.r / bucket.count);
        const avgG = Math.round(bucket.g / bucket.count);
        const avgB = Math.round(bucket.b / bucket.count);
        allColors.push({ r: avgR, g: avgG, b: avgB, h: rgbToHue(avgR, avgG, avgB), count: bucket.count });
      }
    } catch {
      // Skip frames that fail to load/process
      continue;
    }
  }

  if (allColors.length === 0) return [];

  // Sort by hue for a smooth gradient
  allColors.sort((a, b) => a.h - b.h);

  // Convert to hex, deduplicate nearby colors
  const hexColors: string[] = [];
  for (const c of allColors) {
    const hex = rgbToHex(c.r, c.g, c.b);
    // Skip if too similar to the last color added
    if (hexColors.length > 0 && hexColors[hexColors.length - 1] === hex) continue;
    hexColors.push(hex);
  }

  // Cap at 15 colors
  if (hexColors.length <= 15) return hexColors;

  // Evenly sample 15 from the sorted list
  const step = hexColors.length / 15;
  return Array.from({ length: 15 }, (_, i) => hexColors[Math.round(i * step)]);
}

function rgbToHue(r: number, g: number, b: number): number {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return Math.round(h * 360);
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}
