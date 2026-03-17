import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServerClient } from "@/lib/supabase-server";

// Public endpoint — generates presigned GET URLs for videos in a valid share link
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

  // Verify this r2_key belongs to one of the videos in the share link
  const { data: video } = await supabase
    .from("videos")
    .select("id")
    .eq("r2_key", r2Key)
    .in("id", link.video_ids)
    .single();

  if (!video) {
    return NextResponse.json({ error: "Video non autorisee" }, { status: 403 });
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
  });

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

  return NextResponse.json({ presignedUrl });
}
