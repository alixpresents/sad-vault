import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { video_id } = await request.json();
  if (!video_id || typeof video_id !== "string") {
    return NextResponse.json({ error: "video_id requis" }, { status: 400 });
  }

  // Get video with thumbnail
  const { data: video } = await supabase
    .from("videos")
    .select("id, thumbnail_key")
    .eq("id", video_id)
    .single();

  if (!video || !video.thumbnail_key) {
    return NextResponse.json({ error: "Video ou thumbnail introuvable" }, { status: 404 });
  }

  // Get presigned URL for thumbnail
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: video.thumbnail_key });
  const thumbnailUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

  // Fetch thumbnail as base64
  const thumbRes = await fetch(thumbnailUrl);
  if (!thumbRes.ok) {
    return NextResponse.json({ error: "Impossible de charger le thumbnail" }, { status: 500 });
  }
  const thumbBuffer = Buffer.from(await thumbRes.arrayBuffer());
  const base64 = thumbBuffer.toString("base64");
  const mediaType = "image/jpeg";

  // Call Claude API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY non configuree" }, { status: 500 });
  }

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Analyze this frame from a professional video production. Generate exactly 4 short tags (1-2 words each) describing: content type (fashion, beauty, sport, music, food, lifestyle...), mood/atmosphere (cinematic, bright, dark, colorful, minimalist...), setting (studio, outdoor, urban, nature...), and one relevant free tag. Reply only in JSON: {"tags": ["tag1", "tag2", "tag3", "tag4"]}. Tags in English, lowercase.`,
            },
          ],
        },
      ],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    return NextResponse.json({ error: `Claude API error: ${err}` }, { status: 500 });
  }

  const claudeData = await claudeRes.json();
  const textContent = claudeData.content?.find((c: { type: string }) => c.type === "text");
  if (!textContent?.text) {
    return NextResponse.json({ error: "Reponse Claude vide" }, { status: 500 });
  }

  // Parse tags from response
  let tags: string[];
  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    tags = Array.isArray(parsed.tags) ? parsed.tags.map((t: string) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 6) : [];
  } catch {
    return NextResponse.json({ error: "Impossible de parser les tags" }, { status: 500 });
  }

  // Update video tags in DB
  const { error } = await supabase
    .from("videos")
    .update({ tags })
    .eq("id", video_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tags });
}
