import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServerClient } from "@/lib/supabase-server";

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ALLOWED_IMAGE_TYPES = ["image/jpeg"];

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await request.json();
  const { filename, contentType, talentSlug, type, replaceKey, videoId, frameIndex } = body;

  if (!filename || !contentType || !talentSlug) {
    return NextResponse.json(
      { error: "filename, contentType et talentSlug sont requis" },
      { status: 400 }
    );
  }

  // Validate talentSlug format
  if (!/^[a-z0-9-]+$/.test(talentSlug)) {
    return NextResponse.json(
      { error: "talentSlug invalide" },
      { status: 400 }
    );
  }

  // Validate content type server-side
  const allowedTypes = (type === "thumbnail" || type === "filmstrip") ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json(
      { error: `Type de fichier non autorise: ${contentType}` },
      { status: 400 }
    );
  }

  let r2Key: string;

  if (replaceKey && typeof replaceKey === "string" && replaceKey.startsWith("videos/")) {
    // Overwrite existing file at the same key
    r2Key = replaceKey;
  } else if (type === "filmstrip") {
    r2Key = `filmstrip/${videoId ?? crypto.randomUUID()}/${frameIndex ?? 0}.jpg`;
  } else if (type === "thumbnail") {
    r2Key = `thumbnails/${talentSlug}/${crypto.randomUUID()}.jpg`;
  } else {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext || !["mp4", "mov", "webm"].includes(ext)) {
      return NextResponse.json(
        { error: "Extension de fichier non autorisee" },
        { status: 400 }
      );
    }
    r2Key = `videos/${talentSlug}/${crypto.randomUUID()}.${ext}`;
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    ContentType: contentType,
  });

  // 5 min expiry for upload URLs
  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

  return NextResponse.json({ presignedUrl, r2Key });
}
