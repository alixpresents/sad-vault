import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await request.json();
  const { filename, contentType, talentSlug, type } = body;

  if (!filename || !contentType || !talentSlug) {
    return NextResponse.json(
      { error: "filename, contentType et talentSlug sont requis" },
      { status: 400 }
    );
  }

  const uuid = crypto.randomUUID();
  let r2Key: string;

  if (type === "thumbnail") {
    r2Key = `thumbnails/${talentSlug}/${uuid}.jpg`;
  } else {
    const ext = filename.split(".").pop();
    r2Key = `videos/${talentSlug}/${uuid}.${ext}`;
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    ContentType: contentType,
  });

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

  return NextResponse.json({ presignedUrl, r2Key });
}
