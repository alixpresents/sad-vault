import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServerClient } from "@/lib/supabase-server";

// Generate a short-lived presigned GET URL for video playback
export async function GET(request: NextRequest) {
  const r2Key = request.nextUrl.searchParams.get("key");

  if (!r2Key) {
    return NextResponse.json({ error: "key est requis" }, { status: 400 });
  }

  // Check auth for admin video access
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
  });

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

  return NextResponse.json({ presignedUrl });
}
