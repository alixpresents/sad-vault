import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServerClient } from "@/lib/supabase-server";

/** GET — return videos that need filmstrip regeneration, with presigned video URLs */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  // Fetch videos without filmstrip_keys (empty array or null)
  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, title, r2_key, talent_id, filmstrip_keys, talents(slug)")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter videos with no filmstrip_keys
  const needsRegen = (videos as {
    id: string;
    title: string;
    r2_key: string;
    talent_id: string;
    filmstrip_keys: string[] | null;
    talents: { slug: string }[] | { slug: string } | null;
  }[])
    .filter((v) => !v.filmstrip_keys || v.filmstrip_keys.length === 0);

  // Generate presigned GET URLs for each video
  const result = await Promise.all(
    needsRegen.map(async (v) => {
      const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: v.r2_key });
      const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 });
      const talentSlug = v.talents
        ? Array.isArray(v.talents) ? v.talents[0]?.slug ?? "" : v.talents.slug
        : "";
      return {
        id: v.id,
        title: v.title,
        talentSlug,
        videoUrl: presignedUrl,
      };
    })
  );

  return NextResponse.json({ videos: result, total: result.length });
}

/** POST — save filmstrip keys for a single video + generate presigned PUT URLs for frames */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { videoId, frameCount } = await request.json();

  if (!videoId || typeof frameCount !== "number") {
    return NextResponse.json({ error: "videoId et frameCount requis" }, { status: 400 });
  }

  // Generate presigned PUT URLs for each frame
  const frames: { index: number; presignedUrl: string; r2Key: string }[] = [];
  for (let i = 0; i < frameCount; i++) {
    const r2Key = `filmstrip/${videoId}/${i}.jpg`;
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      ContentType: "image/jpeg",
    });
    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
    frames.push({ index: i, presignedUrl, r2Key });
  }

  return NextResponse.json({ frames });
}

/** PATCH — update filmstrip_keys and extract palette colors */
export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { videoId, filmstripKeys, paletteColors } = await request.json();

  if (!videoId || !Array.isArray(filmstripKeys)) {
    return NextResponse.json({ error: "videoId et filmstripKeys requis" }, { status: 400 });
  }

  // If palette colors not provided, extract them server-side from the filmstrip frames
  let colors: string[] = paletteColors;
  if (!colors || colors.length === 0) {
    const { extractPaletteFromR2Keys } = await import("@/lib/palette");
    colors = await extractPaletteFromR2Keys(filmstripKeys);
  }

  const { error } = await supabase
    .from("videos")
    .update({
      filmstrip_keys: filmstripKeys,
      palette_colors: colors,
    })
    .eq("id", videoId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paletteColors: colors });
}
