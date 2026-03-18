import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServerClient } from "@/lib/supabase-server";

// Simple in-memory rate limiter (per serverless instance)
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // max requests
const RATE_WINDOW = 60_000; // per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Public endpoint — generates presigned GET URLs for videos/thumbnails in a valid share link
export async function GET(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Trop de requetes. Reessayez dans un instant." },
      { status: 429 }
    );
  }

  const token = request.nextUrl.searchParams.get("token");
  const r2Key = request.nextUrl.searchParams.get("key");

  if (!token || !r2Key) {
    return NextResponse.json(
      { error: "token et key sont requis" },
      { status: 400 }
    );
  }

  // Validate token format (alphanumeric, 16 chars)
  if (!/^[a-z0-9]+$/.test(token) || token.length < 12) {
    return NextResponse.json({ error: "Token invalide" }, { status: 400 });
  }

  const supabase = await createServerClient();

  // Validate token and check expiration
  const { data: link } = await supabase
    .from("share_links")
    .select("id, video_ids, expires_at")
    .eq("token", token)
    .single();

  if (!link) {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: "Lien expire" }, { status: 410 });
  }

  // Verify this r2_key (video, thumbnail, or filmstrip) belongs to one of the videos in the share link
  const { data: videos } = await supabase
    .from("videos")
    .select("id, r2_key, thumbnail_key, filmstrip_keys")
    .in("id", link.video_ids);

  const matchedVideo = (videos as { id: string; r2_key: string; thumbnail_key: string | null; filmstrip_keys: string[] }[] | null)
    ?.find((v) =>
      v.r2_key === r2Key ||
      v.thumbnail_key === r2Key ||
      (v.filmstrip_keys && v.filmstrip_keys.includes(r2Key))
    );

  if (!matchedVideo) {
    return NextResponse.json({ error: "Ressource non autorisee" }, { status: 403 });
  }

  const isThumbnail = r2Key === matchedVideo.thumbnail_key ||
    (matchedVideo.filmstrip_keys && matchedVideo.filmstrip_keys.includes(r2Key));

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
  });

  // 15 min expiry for presigned URLs
  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

  // Cache thumbnail URLs longer (they rarely change), video URLs shorter
  const cacheMaxAge = isThumbnail ? 600 : 120;

  return NextResponse.json(
    { presignedUrl },
    {
      headers: {
        "Cache-Control": `private, max-age=${cacheMaxAge}`,
      },
    }
  );
}
