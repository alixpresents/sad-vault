import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServerClient } from "@/lib/supabase-server";

// Public endpoint — generates presigned GET URLs for videos/thumbnails in a valid share link
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const r2Key = request.nextUrl.searchParams.get("key");

  if (!token || !r2Key) {
    return NextResponse.json(
      { error: "token et key sont requis" },
      { status: 400 }
    );
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

  // Verify this r2_key (video or thumbnail) belongs to one of the videos in the share link
  const { data: video } = await supabase
    .from("videos")
    .select("id, r2_key, thumbnail_key")
    .in("id", link.video_ids)
    .or(`r2_key.eq.${r2Key},thumbnail_key.eq.${r2Key}`)
    .limit(1)
    .single();

  if (!video) {
    return NextResponse.json({ error: "Ressource non autorisee" }, { status: 403 });
  }

  const isThumbnail = r2Key === (video as { thumbnail_key: string | null }).thumbnail_key;

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
  });

  // 1h expiry for presigned URLs
  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

  // Cache thumbnail URLs longer (they rarely change), video URLs shorter
  const cacheMaxAge = isThumbnail ? 1800 : 300;

  return NextResponse.json(
    { presignedUrl },
    {
      headers: {
        "Cache-Control": `private, max-age=${cacheMaxAge}`,
      },
    }
  );
}
